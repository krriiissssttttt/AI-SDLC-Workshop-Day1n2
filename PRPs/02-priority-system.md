# PRP: Priority System

## Feature Overview

Implement a three-level priority system for todos: `high`, `medium`, and `low`.

This feature helps users quickly identify urgent work, improves task organization, and enables faster decision-making in daily planning.

The priority system must include:
- Priority selection during todo creation and editing
- Color-coded priority badges in list and detail views
- Automatic sorting that favors higher-priority todos
- Filtering by one or multiple priority levels

This PRP defines product requirements, technical contracts, UI expectations, and test criteria for production-ready priority support.

## User Stories

1. As an authenticated user, I want to set a priority when creating a todo so I can indicate urgency.
2. As an authenticated user, I want to change priority later so I can reflect changing importance.
3. As an authenticated user, I want high-priority todos to appear before lower-priority todos so I can focus quickly.
4. As an authenticated user, I want visual priority badges so I can scan my list at a glance.
5. As an authenticated user, I want to filter by priority so I can focus on critical or routine work.

## User Flow

### Create Todo With Priority

1. User opens create form.
2. User enters title and optional fields.
3. User selects priority (`high`, `medium`, or `low`) or leaves default.
4. User submits form.
5. Todo appears with corresponding priority badge and sorting behavior.

### Update Priority

1. User opens edit mode on an existing todo.
2. User changes priority value.
3. UI updates optimistically.
4. Client sends update request.
5. On success: server value is confirmed and list order remains correct.
6. On failure: client rolls back and displays error.

### Sort and Filter by Priority

1. User views todo list.
2. App applies default sort by incomplete first, then priority rank, then recency (unless user selected another explicit sort mode).
3. User toggles priority filters.
4. List updates immediately to show matching todos.
5. Empty state is shown if no todos match.

## Technical Requirements

### Data Model

Use shared todo type contracts from the project's database layer.

Priority field contract:

```ts
export type Priority = 'high' | 'medium' | 'low';

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: number;
  priority: Priority;
  recurrence_pattern: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  reminder_minutes: number | null;
  created_at: string;
  updated_at: string;
}
```

DB requirements:
- `priority` must be non-null.
- Default for new todos: `medium`.
- Allowed values restricted to `high`, `medium`, `low`.
- Existing rows without priority must be backfilled to `medium` during migration.

Migration recipe (SQLite, aligned with project patterns):
1. Add `priority` column with safe fallback in a try/catch migration block.
2. Backfill legacy rows to `medium` where priority is null/empty.
3. Ensure create/update queries always write one of `high|medium|low`.
4. Set default priority to `medium` at insert layer.

### API Contracts

All endpoints require authenticated session (`getSession()`) and user ownership scoping.

Priority validation:
- Accept only `high`, `medium`, `low`.
- Reject unknown values with `400`.
- If omitted on create, assign `medium`.

Error response contract:
- `400`: `{ "error": "Invalid priority value" }`
- `401`: `{ "error": "Not authenticated" }`
- `404`: `{ "error": "Todo not found" }` (or equivalent non-disclosing message)
- `500`: `{ "error": "Internal server error" }`

Error handling requirements:
- Keep response payload shape consistent with a single `error` string field.
- Do not expose stack traces or internal DB details.

#### POST /api/todos

Request body sample:

```json
{
  "title": "Prepare sprint demo",
  "priority": "high"
}
```

Response `201` sample:

```json
{
  "id": 11,
  "title": "Prepare sprint demo",
  "description": null,
  "due_date": null,
  "completed": 0,
  "priority": "high",
  "recurrence_pattern": "none",
  "reminder_minutes": null,
  "created_at": "2026-05-22T10:00:00.000Z",
  "updated_at": "2026-05-22T10:00:00.000Z"
}
```

#### PUT /api/todos/[id]

Request body sample:

```json
{
  "priority": "low"
}
```

Response `200` sample:

```json
{
  "id": 11,
  "title": "Prepare sprint demo",
  "description": null,
  "due_date": null,
  "completed": 0,
  "priority": "low",
  "recurrence_pattern": "none",
  "reminder_minutes": null,
  "created_at": "2026-05-22T10:00:00.000Z",
  "updated_at": "2026-05-22T10:05:00.000Z"
}
```

#### GET /api/todos

Requirements:
- Include `priority` in every returned todo.
- Preserve consistent response shape for all priority values.
- Omit internal ownership fields such as `user_id` from public payload.

### Sorting Rules

Priority ranking:
- `high` rank = 1
- `medium` rank = 2
- `low` rank = 3

Default ordering behavior:
1. Incomplete todos before completed todos.
2. Higher priority before lower priority.
3. More recently created first as tie-breaker.

If product chooses a user-selectable sort mode, priority sort must remain available and deterministic.

### Filtering Rules

Support priority filtering with any combination of levels:
- Single select (example: `high` only)
- Multi select (example: `high` + `medium`)
- Clear filters returns full list

Filtering should execute client-side for immediate responsiveness on typical list sizes.

### Validation Rules

Recommended schema (zod):

```ts
import { z } from 'zod';

export const prioritySchema = z.enum(['high', 'medium', 'low']);

export const createTodoSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  due_date: z.string().datetime().nullable().optional(),
  priority: prioritySchema.optional(),
});

export const updateTodoSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  due_date: z.string().datetime().nullable().optional(),
  completed: z.number().int().min(0).max(1).optional(),
  priority: prioritySchema.optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field is required',
});
```

Validation behavior:
- Reject invalid enum values.
- Normalize missing `priority` to `medium` on create.
- Keep update partial semantics while validating provided fields only.

### Timezone and Timestamp Behavior

Priority logic is timezone-independent, but todo timestamp handling must still follow the project's Singapore timezone utilities:
- Use Singapore time utilities for business logic clock access.
- Persist timestamp fields as UTC ISO strings.
- Render timestamps in Singapore local time in UI.

### Implementation Notes

- Database operations remain synchronous (`better-sqlite3`).
- API route params are async in Next.js 16 (`const { id } = await params`).
- Use null coalescing for nullable response fields (example: `reminder_minutes: row.reminder_minutes ?? null`).
- Scope all read/write operations to `session.userId`.

## UI Components

Suggested UI components and behavior in the main client todo page:

1. `PrioritySelect`
   - Dropdown or segmented control with `High`, `Medium`, `Low`.
   - Default selected state: `Medium`.
2. `PriorityBadge`
   - Visible in every todo row.
   - Color and label represent priority.
3. `PriorityFilterBar`
   - Toggle chips or checkboxes for `High`, `Medium`, `Low`.
   - Supports multi-select filtering.
4. `TodoList`
   - Applies sorting and filtering pipeline consistently.

Example component contracts:

```ts
type Priority = 'high' | 'medium' | 'low';

type PrioritySelectProps = {
  value: Priority;
  onChange: (value: Priority) => void;
  disabled?: boolean;
};

type PriorityBadgeProps = {
  priority: Priority;
};

type PriorityFilterBarProps = {
  selected: Priority[];
  onChange: (selected: Priority[]) => void;
};
```

Suggested visual mapping (preserve app design system if already defined):
- `high`: strong red tone + high-contrast text
- `medium`: amber/yellow tone + dark text
- `low`: green tone + high-contrast text

Accessibility requirements:
- Do not rely on color alone; include text label.
- Ensure badge and filter contrast meet WCAG AA.
- Keyboard operable selection and filtering controls.

## Edge Cases

1. Create request omits `priority`.
   - Expected: todo saved with `medium`.
2. Client sends unknown priority (example: `urgent`).
   - Expected: `400` validation error.
3. Existing legacy todos have null/missing priority after migration.
   - Expected: normalize and treat as `medium`.
4. User changes priority while network fails.
   - Expected: optimistic UI rollback and error message.
5. Multiple todos share same completion and priority.
   - Expected: deterministic tie-breaker order by recency.
6. User filters by priority resulting in zero matches.
   - Expected: empty state with clear-filter action.

## Acceptance Criteria

1. Todos support exactly three priority values: `high`, `medium`, `low`.
2. New todos default to `medium` when priority is omitted.
3. Invalid priority values are rejected with `400`.
4. Priority is visible in todo list with text + color badge.
5. List supports filtering by one or many priority levels.
6. Default list ordering prioritizes incomplete and high-priority todos.
7. Updating priority persists correctly and reorders list as expected.
8. Priority behavior is user-scoped and cannot affect other users' todos.

## Testing Requirements

### Unit Tests

1. Priority validation tests:
   - Accept `high`, `medium`, `low`.
   - Reject any other string.
2. Sorting tests:
   - Verify ordering by completed state, priority rank, recency.
3. Filtering tests:
   - Verify single and multi-select behavior.
4. Defaulting tests:
   - Verify missing priority resolves to `medium`.

### Integration/API Tests

1. `POST /api/todos` persists provided priority.
2. `POST /api/todos` applies `medium` when missing.
3. `PUT /api/todos/[id]` updates priority.
4. `GET /api/todos` always returns a valid priority value.
5. Invalid priority payload returns `400`.
6. Cross-user update attempt returns `404` (or non-disclosing equivalent).

### E2E Tests (Playwright)

1. Create todos with all three priorities and verify badge rendering.
2. Edit a todo priority and verify immediate UI update plus persistence after reload.
3. Verify default sort places high-priority incomplete todo above medium/low.
4. Apply `high` filter and verify only high-priority todos display.
5. Apply multi-select filter (`high` + `medium`) and verify combined results.
6. Trigger API failure during priority update and verify optimistic rollback.

## Out of Scope

- Custom priority levels beyond `high`, `medium`, `low`
- User-configurable priority color themes
- SLA/escalation engines or automatic priority assignment by AI
- Priority history/audit timeline

## Success Metrics

1. 100% acceptance criteria coverage in QA validation.
2. Zero invalid priority values persisted in database.
3. All priority integration and E2E tests pass in CI.
4. Users can identify high-priority tasks within 3 seconds in usability checks.

## References

- [../.github/copilot-instructions.md](../.github/copilot-instructions.md)
- [../README.md](../README.md)
- [README.md](README.md)
- [01-todo-crud-operations.md](01-todo-crud-operations.md)

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
- **Depends on:** 01-todo-crud-operations.md
- **Enables:** 08-search-filtering.md
- **Execution phase:** Phase 1 (Foundation)

### Blockers to Clear Before Sign-off
- Todo type/schema must already include a stable priority field default.
- Existing todos need deterministic fallback/default behavior.
- Sort order contract must be finalized before filter composition in Feature 08.

## Evaluation Traceability (EVALUATION.md)

| EVALUATION.md section | PRP coverage sections | Verification artifact |
|---|---|---|
| Feature 02 Implementation Checklist | Data Model, API Endpoints, UI Components, Sorting Rules | API contract tests + UI snapshots |
| Feature 02 Testing | Testing Requirements | Playwright priority tests |
| Feature 02 Acceptance Criteria | Acceptance Criteria | Filter/sort validation report |
