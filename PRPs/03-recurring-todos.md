# PRP: Recurring Todos

## Feature Overview

Implement recurring todo support so users can automate repeat tasks without manually recreating them.

This feature must support recurring patterns:
- Daily
- Weekly
- Monthly
- Yearly

Core behavior:
- User can assign a recurrence pattern to a todo.
- Completing a recurring todo automatically creates the next instance.
- Next due date is calculated deterministically using Singapore timezone semantics.
- Next instance inherits required metadata from the completed todo.

This PRP defines product requirements, technical contracts, UI expectations, and test criteria for production-ready recurring todos.

## User Stories

1. As an authenticated user, I want a todo to repeat daily/weekly/monthly/yearly so I do not recreate routine tasks.
2. As an authenticated user, I want the next recurring todo to be created when I complete the current one.
3. As an authenticated user, I want recurring todos to preserve key settings (priority, reminders, and recurrence pattern) so each new occurrence behaves consistently.
4. As an authenticated user, I want recurrence calculations to respect Singapore timezone so due dates are predictable.
5. As an authenticated user, I want to stop recurrence by changing pattern to `none`.

## User Flow

### Create Recurring Todo

1. User opens create form.
2. User enters title and optional fields.
3. User selects recurrence pattern (`daily`, `weekly`, `monthly`, `yearly`) or leaves `none`.
4. User submits form.
5. Todo is saved with recurrence metadata and shown in list.

### Complete Recurring Todo

1. User marks a recurring todo complete.
2. UI updates optimistically.
3. Client sends update request for completion.
4. Server marks current todo completed.
5. Server calculates next due date from recurrence pattern.
6. Server creates next todo instance with inherited metadata.
7. Response returns updated current todo and the newly created next instance.
8. Client reconciles list and sort state.

### Disable Recurrence

1. User edits an existing recurring todo.
2. User changes recurrence to `none`.
3. Save succeeds.
4. Future completion no longer auto-creates next instance.

## Technical Requirements

### Data Model

Recurring field contract:

```ts
export type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: number;
  priority: 'high' | 'medium' | 'low';
  recurrence_pattern: RecurrencePattern;
  reminder_minutes: number | null;
  created_at: string;
  updated_at: string;
}
```

Database requirements:
- `recurrence_pattern` must be non-null.
- Default value: `none`.
- Allowed values restricted to `none|daily|weekly|monthly|yearly`.
- Legacy rows without recurrence must be backfilled to `none`.

### API Contracts

All endpoints require authenticated session and user ownership scoping.

Validation:
- Accept recurrence values: `none`, `daily`, `weekly`, `monthly`, `yearly`.
- Reject unknown values with `400`.
- If omitted on create, default recurrence to `none`.

#### POST /api/todos

Request sample:

```json
{
  "title": "Water plants",
  "due_date": "2026-05-23T01:00:00.000Z",
  "recurrence_pattern": "weekly"
}
```

Response `201` sample:

```json
{
  "id": 21,
  "title": "Water plants",
  "description": null,
  "due_date": "2026-05-23T01:00:00.000Z",
  "completed": 0,
  "priority": "medium",
  "recurrence_pattern": "weekly",
  "reminder_minutes": null,
  "created_at": "2026-05-22T10:00:00.000Z",
  "updated_at": "2026-05-22T10:00:00.000Z"
}
```

#### PUT /api/todos/[id] (mark complete for recurring todo)

Request sample:

```json
{
  "completed": 1
}
```

Response `200` sample:

```json
{
  "todo": {
    "id": 21,
    "title": "Water plants",
    "description": null,
    "due_date": "2026-05-23T01:00:00.000Z",
    "completed": 1,
    "priority": "medium",
    "recurrence_pattern": "weekly",
    "reminder_minutes": null,
    "created_at": "2026-05-22T10:00:00.000Z",
    "updated_at": "2026-05-23T01:02:00.000Z"
  },
  "next_todo": {
    "id": 22,
    "title": "Water plants",
    "description": null,
    "due_date": "2026-05-30T01:00:00.000Z",
    "completed": 0,
    "priority": "medium",
    "recurrence_pattern": "weekly",
    "reminder_minutes": null,
    "created_at": "2026-05-23T01:02:00.000Z",
    "updated_at": "2026-05-23T01:02:00.000Z"
  }
}
```

Response notes:
- `next_todo` is returned only when a recurring todo transitions from incomplete to completed.
- If completion request does not trigger recurrence creation, return `next_todo: null`.
- Response payload includes todo scalar fields only; related entities (for example tags/subtasks) are fetched via existing list/detail queries.

#### PUT /api/todos/[id] (change recurrence pattern)

Request sample:

```json
{
  "recurrence_pattern": "none"
}
```

Response: updated todo object.

### Error Contract

Use consistent error payload shape:
- `400`: `{ "error": "Invalid recurrence pattern" }`
- `401`: `{ "error": "Not authenticated" }`
- `404`: `{ "error": "Todo not found" }` (or non-disclosing equivalent)
- `500`: `{ "error": "Internal server error" }`

Error-handling requirements:
- Do not leak stack traces or internal SQL details.
- Keep user-safe, actionable error messages.

### Recurrence Calculation Rules

Definitions:
- Base date = todo `due_date` when present; otherwise use completion timestamp.
- Calculation clock = Singapore timezone business clock.
- Storage format = UTC ISO 8601 timestamps.

Overdue completion policy:
- Catch-up policy is required. If computed next date is less than or equal to completion timestamp, keep advancing by the recurrence pattern until next date is in the future.
- This prevents creating immediate past-due instances when users complete overdue recurring todos.

Pattern logic:
1. `daily`: next date = base + 1 day (same local time)
2. `weekly`: next date = base + 7 days (same local time)
3. `monthly`: next date = same day-of-month next month, with end-of-month clamping
4. `yearly`: next date = same month/day next year, with leap-year handling

Monthly clamping examples:
- Jan 31 monthly -> Feb 28 (or Feb 29 in leap year)
- Mar 31 monthly -> Apr 30

Leap-year example:
- Feb 29 yearly -> Feb 28 in non-leap year

### Metadata Inheritance Rules

When creating the next recurring instance, inherit:
- `title`
- `description`
- `priority`
- `recurrence_pattern`
- `reminder_minutes`
- tag relationships from the completed todo (when tag feature is enabled)

Do not inherit:
- `id`
- `completed` (always reset to `0`)
- `created_at` and `updated_at` (new timestamps)
- completion-only audit fields

Subtasks behavior:
- Recurrence does not duplicate subtasks in this feature.
- If subtasks feature exists, next instance starts without subtasks unless a separate template workflow is used.

### Idempotency and Race Safety

Completion endpoint must prevent duplicate next-instance creation for same occurrence.

Requirements:
- Only create next instance when state changes `completed: 0 -> 1`.
- If todo is already completed, do not create another next instance.
- Use transaction-safe write sequence for completion + next insert.

### Migration Requirements

Use deterministic SQLite migration steps:
1. Add `recurrence_pattern` column with fallback behavior in migration block.
2. Backfill missing/invalid legacy values to `none`.
3. Ensure insert/update code paths enforce allowed enum values.
4. Default missing recurrence to `none` in application layer.

### Implementation Notes

- Database operations are synchronous (`better-sqlite3`).
- Route params are async in Next.js 16 (`const { id } = await params`).
- Use null coalescing for nullable response fields (example: `reminder_minutes: row.reminder_minutes ?? null`).
- Always scope operations to `session.userId`.
- Use Singapore timezone utilities from `lib/timezone.ts` for recurrence calculations (do not use `new Date()` directly for business logic).

## UI Components

Suggested components and behaviors:

1. `RecurrenceSelect`
   - Options: `None`, `Daily`, `Weekly`, `Monthly`, `Yearly`.
   - Default selection: `None`.
2. `RecurringBadge`
   - Badge shown on recurring todos with compact pattern label.
3. `TodoItem`
   - Completion action communicates recurrence outcome (for example, subtle message: "Next weekly task created").
4. `RecurrenceInfoHint`
   - Optional helper text showing next estimated due date before save.

Implementation convention note:
- These are logical UI contracts. If the app is maintaining the monolithic main todo page pattern, implement this behavior inline in the existing page component rather than forcing component extraction.

Example contracts:

```ts
type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

type RecurrenceSelectProps = {
  value: RecurrencePattern;
  onChange: (value: RecurrencePattern) => void;
  disabled?: boolean;
};

type RecurringBadgeProps = {
  pattern: Exclude<RecurrencePattern, 'none'>;
};
```

Accessibility requirements:
- Recurrence label must be text-based, not icon-only.
- Select control must be keyboard operable.
- Success/failure state after completion must be announced via accessible status region.

## Edge Cases

1. Todo has recurrence but no due date.
   - Expected: calculate next due date from completion timestamp in Singapore time.
2. User completes recurring todo twice quickly.
   - Expected: only one next instance created.
3. Monthly recurrence on day 29/30/31.
   - Expected: clamp to valid day in target month.
4. Yearly recurrence from Feb 29.
   - Expected: non-leap years use Feb 28.
5. User changes recurrence from `weekly` to `none` before completion.
   - Expected: completion does not create next instance.
6. API failure after optimistic completion update.
   - Expected: rollback completion state and do not display phantom next item.
7. User completes a long-overdue recurring todo.
  - Expected: next instance uses catch-up policy and is scheduled in the future.

## Acceptance Criteria

1. Todos support recurrence patterns `none`, `daily`, `weekly`, `monthly`, `yearly`.
2. Create/update validation rejects invalid recurrence values.
3. Completing a recurring todo creates exactly one next instance.
4. Next due date is computed correctly for daily/weekly/monthly/yearly rules.
5. Next instance inherits defined metadata and resets completion state.
6. Non-recurring todos do not auto-create a next instance.
7. Recurrence respects Singapore timezone business logic.
8. Recurrence behavior is scoped to authenticated user's own todos only.
9. Overdue completion uses catch-up policy and does not create past-due next instance.
10. Recurrence-generated next instances do not copy subtasks by default.
11. Recurrence-generated next instances preserve tag relationships from the completed todo.

## Testing Requirements

### Unit Tests

1. Recurrence enum validation tests.
2. Date-calculation tests for daily/weekly/monthly/yearly.
3. Month-end clamping tests (31st -> shorter month).
4. Leap-year yearly tests (Feb 29 behavior).
5. Metadata inheritance tests for next-instance creation.
6. Idempotency tests for repeated completion events.
7. Overdue catch-up tests ensure next occurrence is always in the future.
8. Subtask behavior tests verify recurrence does not auto-copy subtasks.
9. Tag inheritance tests verify next instance retains the same tag relationships.

### Integration/API Tests

1. `POST /api/todos` persists recurrence pattern.
2. `POST /api/todos` defaults recurrence to `none` when omitted.
3. `PUT /api/todos/[id]` completion of recurring todo returns `next_todo` and persists it.
4. Re-completing already-completed recurring todo does not create additional instances.
5. Invalid recurrence payload returns `400`.
6. Cross-user completion/update attempts return `404` or equivalent non-disclosing response.
7. Completion of overdue recurring todo creates future next occurrence (not past-due).
8. Completing a tagged recurring todo creates next instance with same tag relationships.

### E2E Tests (Playwright)

1. Create daily recurring todo, complete it, verify next day instance appears.
2. Create weekly recurring todo with due date, complete it, verify +7 day instance.
3. Verify monthly clamping with end-of-month input.
4. Verify recurrence badge and pattern text in UI.
5. Change recurring todo to `none`, complete it, verify no next instance.
6. Simulate network failure on completion and verify optimistic rollback.
7. Complete an overdue recurring todo and verify newly created next instance is scheduled in the future.
8. Complete a tagged recurring todo and verify next instance displays the same tags.

## Out of Scope

- Custom recurrence rules (for example: every 2 weeks, weekdays-only, cron syntax)
- Time-of-day recurrence windows and snooze scheduling
- Bulk generation of historical/future instances beyond next occurrence
- Cross-user shared recurring templates

## Success Metrics

1. 100% acceptance criteria pass in QA and CI.
2. Zero duplicate next-instance creations for a single completion event.
3. All recurrence date-calculation tests pass for boundary cases.
4. User-reported recurrence date defects remain below agreed reliability threshold.

## References

- [README.md](README.md)
- [01-todo-crud-operations.md](01-todo-crud-operations.md)
- [02-priority-system.md](02-priority-system.md)
- [../README.md](../README.md)
- [../USER_GUIDE.md](../USER_GUIDE.md)
- [../.github/copilot-instructions.md](../.github/copilot-instructions.md)

## Architecture Guardrails (Mandatory)

This PRP MUST follow `/home/runner/work/AI-SDLC-Workshop-Day1n2/AI-SDLC-Workshop-Day1n2/.github/copilot-instructions.md`:

- Next.js 16 App Router with React 19 and Tailwind CSS 4.
- API routes are the backend boundary; auth-first checks and strict user scoping on all data operations.
- SQLite via `better-sqlite3` with synchronous DB logic centralized in `lib/db.ts`.
- All date/time logic uses Singapore timezone utilities from `lib/timezone.ts`.
- WebAuthn/passkeys + JWT cookie sessions remain the only authentication model.
- Main todo UX follows existing monolithic client-page pattern unless route-specific behavior requires otherwise.
- Playwright E2E coverage is required for user-critical flows.

## Feature Dependencies & Blockers

### Dependency Plan
- **Depends on:** 01-todo-crud-operations.md, 02-priority-system.md
- **Enables:** 09-export-import.md (stable recurrence payloads)
- **Execution phase:** Phase 2 (Core Behavior)

### Blockers to Clear Before Sign-off
- Due-date handling from Feature 01 must be timezone-correct.
- Completion semantics must prevent duplicate next-instance creation.
- Metadata inheritance contract must be stable before export/import assumptions.

## Evaluation Traceability (EVALUATION.md)

| EVALUATION.md section | PRP coverage sections | Verification artifact |
|---|---|---|
| Feature 03 Implementation Checklist | Data Model, API Contracts, Recurrence Calculation Rules, Metadata Inheritance Rules | Unit tests for recurrence calculations |
| Feature 03 Testing | Testing Requirements (Unit/Integration/E2E) | Playwright recurring scenarios |
| Feature 03 Acceptance Criteria | Acceptance Criteria | Completion-to-next-instance QA evidence |
