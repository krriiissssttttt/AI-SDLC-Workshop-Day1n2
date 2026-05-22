# PRP: Reminders & Notifications

## Feature Overview

Implement reminder scheduling and browser notifications so users receive timely alerts before todo due dates.

This feature must provide:
- Configurable reminder offsets from 15 minutes to 1 week before due date
- Backend reminder checks with authenticated user scoping
- Client polling to discover due reminders
- Duplicate-prevention so the same reminder is not repeatedly sent
- Singapore-timezone-consistent reminder timing

This PRP defines product requirements, technical contracts, and testing expectations for production-ready reminders and notifications.

## User Stories

1. As an authenticated user, I want to set a reminder for a todo so I get notified before the due time.
2. As an authenticated user, I want reminders to trigger reliably even if I keep the app open for a long session.
3. As an authenticated user, I do not want duplicate notifications for the same reminder window.
4. As an authenticated user, I want reminder calculations to match Singapore time so alerts are predictable.
5. As an authenticated user, I want to disable a reminder by clearing reminder settings.

## User Flow

### Configure Reminder

1. User creates or edits a todo.
2. User selects reminder offset (`15m`, `30m`, `1h`, `2h`, `1d`, `2d`, `1w`) or `none`.
3. User saves changes.
4. Todo is persisted with `reminder_minutes` set to selected offset or `null` when disabled.

### Notification Permission

1. User opens app with reminders enabled.
2. App checks browser notification permission.
3. If permission is default, app requests permission at an appropriate user-triggered moment.
4. If denied, app continues without browser notifications and shows non-blocking guidance.

### Poll and Trigger Notifications

1. Client starts polling reminder-check endpoint at a fixed interval.
2. Backend returns reminders that are due and not yet sent.
3. Client displays browser notifications for returned reminders.
4. After successful client handling, client acknowledges each reminder to backend.
5. Backend records reminder as sent to prevent duplicates.
5. Polling continues while app is active.

## Technical Requirements

### Data Model

Todo reminder fields:

```ts
export interface Todo {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: number;
  priority: 'high' | 'medium' | 'low';
  recurrence_pattern: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string;
}
```

Reminder field requirements:
- `reminder_minutes` allowed values: `15`, `30`, `60`, `120`, `1440`, `2880`, `10080`, or `null`.
- `reminder_minutes = null` means reminders disabled.
- `last_notification_sent` tracks most recent reminder dispatch time for deduplication.
- Completed todos must not generate reminder notifications.

### API Contracts

All endpoints require authenticated session and user ownership scoping.

#### PUT /api/todos/[id] (set reminder)

Request sample:

```json
{
  "reminder_minutes": 60
}
```

Response `200` sample:

```json
{
  "id": 45,
  "title": "Submit expenses",
  "description": null,
  "due_date": "2026-05-25T02:00:00.000Z",
  "completed": 0,
  "priority": "medium",
  "recurrence_pattern": "none",
  "reminder_minutes": 60,
  "last_notification_sent": null,
  "created_at": "2026-05-22T10:00:00.000Z",
  "updated_at": "2026-05-22T10:10:00.000Z"
}
```

Disable reminder request sample:

```json
{
  "reminder_minutes": null
}
```

Validation requirements:
- Reject unsupported reminder values with `400`.
- Reject non-null reminder configuration when `due_date` is missing with `400`.
- If an update removes `due_date`, server must force `reminder_minutes = null` in the same write.

#### GET /api/notifications/check

Purpose:
- Return reminders that are due for the authenticated user and not yet sent in the current reminder window.

Response `200` sample:

```json
{
  "notifications": [
    {
      "todo_id": 45,
      "title": "Submit expenses",
      "description": null,
      "due_date": "2026-05-25T02:00:00.000Z",
      "reminder_minutes": 60,
      "trigger_at": "2026-05-25T01:00:00.000Z"
    }
  ]
}
```

Response notes:
- `notifications` can be empty.
- Entries must belong only to the current user.
- Notification payload includes only fields needed to render browser notifications.

#### POST /api/notifications/ack

Purpose:
- Confirm client successfully handled a reminder so backend can mark it delivered.

Request sample:

```json
{
   "todo_id": 45,
   "trigger_at": "2026-05-25T01:00:00.000Z"
}
```

Response `200` sample:

```json
{
   "success": true
}
```

Ack requirements:
- Acknowledgment must be idempotent.
- Ack must be user-scoped and reject cross-user todo IDs.
- Backend updates `last_notification_sent` only after valid ack.
- If browser notifications are unavailable but app shows in-app reminder indicator, ack is still sent after successful in-app handling.
- Backend must validate `trigger_at` before accepting ack:
   - `trigger_at` must match computed reminder trigger for current todo occurrence.
   - `trigger_at` must be less than or equal to current time.
   - Mismatch or future trigger acknowledgment returns `400`.

### Error Contract

Use consistent payload shape for all reminder endpoints:
- `400`: `{ "error": "Invalid reminder value" }` (or similarly specific validation error)
- `401`: `{ "error": "Not authenticated" }`
- `404`: `{ "error": "Todo not found" }` (or non-disclosing equivalent)
- `500`: `{ "error": "Internal server error" }`

Error handling requirements:
- Never leak stack traces or SQL internals.
- Keep messages user-safe and actionable.

### Reminder Timing Rules

Definitions:
- Reminder trigger time = `due_date - reminder_minutes`.
- Business clock and comparisons use Singapore timezone semantics.
- Persist timestamps in UTC ISO format for storage consistency.

Eligibility to notify:
1. Todo is incomplete.
2. Todo has non-null `due_date`.
3. Todo has valid non-null `reminder_minutes`.
4. Current time is greater than or equal to trigger time.
5. Reminder has not already been sent for this occurrence.

Duplicate-prevention rules:
- Use `last_notification_sent` to suppress repeat notifications.
- Only send one reminder per todo occurrence after ack.
- For recurring todos, a newly created next instance starts with `last_notification_sent = null`.
- If check endpoint returns same reminder again before ack, client should de-duplicate by `(todo_id, trigger_at)` within session.

### Polling Requirements

Client polling behavior:
- Poll `GET /api/notifications/check` on a fixed cadence (recommended: every 60 seconds).
- Pause polling when document is hidden if product chooses battery/network optimization.
- Resume polling when document becomes visible and perform an immediate check.

Reliability requirements:
- Polling failure must not crash app UI.
- Transient failures should retry on next interval.
- Notification handling must be idempotent from client perspective.

### Permission and Browser Notification Rules

Permission states:
- `granted`: show notifications.
- `default`: request permission through user-initiated interaction.
- `denied`: do not repeatedly prompt; show inline guidance instead.

Notification content:
- Title: todo title.
- Body: relative reminder context (for example, "Due in 1 hour") or due timestamp.
- Optional click behavior: focus/open app and highlight todo.

Accessibility and UX:
- Provide in-app fallback indicator when browser notifications are unavailable.
- Keep error messaging non-blocking.

### Security and Ownership Rules

- Every reminder-check query must be scoped to authenticated `user_id`.
- Do not expose other users' reminder data.
- Do not allow unauthenticated reminder polling.

### Implementation Notes

- Database operations are synchronous (`better-sqlite3`).
- Next.js route params are async where applicable.
- Use null coalescing for nullable fields in API responses.
- Use project Singapore timezone utilities for date/time logic instead of ad-hoc date arithmetic.

## UI Components

Suggested UI contracts for notification feature behavior:

1. `ReminderSelect`
   - Options: `None`, `15m`, `30m`, `1h`, `2h`, `1d`, `2d`, `1w`.
   - Disabled when todo has no due date.
2. `NotificationPermissionBanner`
   - Shown when notifications are not yet granted.
   - Includes action to request permission.
3. `NotificationStatusIndicator`
   - Shows active/disabled reminder state per todo.
4. `ReminderErrorToast`
   - Displays non-blocking polling or permission errors.

Example contracts:

```ts
type ReminderMinutes = 15 | 30 | 60 | 120 | 1440 | 2880 | 10080 | null;

type ReminderSelectProps = {
  value: ReminderMinutes;
  dueDate: string | null;
  onChange: (value: ReminderMinutes) => void;
  disabled?: boolean;
};

type NotificationPermissionBannerProps = {
  permission: NotificationPermission;
  onRequestPermission: () => Promise<void>;
};
```

Implementation convention note:
- These are logical UI contracts. If the app keeps a monolithic main todo page, implement behavior inline rather than forcing separate component extraction.

## Edge Cases

1. Todo has reminder set but due date removed later.
   - Expected: reminder is automatically cleared (`reminder_minutes = null`) when due date is removed.
2. User denies notification permission.
   - Expected: polling can continue but browser notifications are skipped with in-app hint.
3. Poll request returns same due todo repeatedly.
   - Expected: repeated pre-ack entries are possible; client de-duplicates by `(todo_id, trigger_at)` and sends ack after successful handling.
4. Browser/tab sleeps and wakes after trigger time.
   - Expected: next poll catches due reminders and sends at most once.
5. Reminder set on completed todo.
   - Expected: no reminder notifications should be sent.
6. Network failure during polling.
   - Expected: recover on next interval without user data loss.

## Acceptance Criteria

1. User can set reminder offset to one of the supported values or `none`.
2. Reminder configuration is validated and rejects unsupported values.
3. Reminder cannot be enabled without a due date.
4. Polling endpoint returns only due reminders for the authenticated user.
5. Browser notifications are shown when permission is granted.
6. Duplicate notifications are prevented for same todo occurrence.
7. Recurring todo next instance can notify again independently of previous instance.
8. Reminder time calculations follow Singapore timezone semantics.
9. Polling failures do not break core todo functionality.
10. Reminder delivered-state is persisted only after explicit client acknowledgment.
11. Removing due date automatically clears reminder settings.
12. Ack endpoint rejects mismatched or future `trigger_at` values.

## Testing Requirements

### Unit Tests

1. Validate supported reminder values and reject invalid values.
2. Compute trigger time from due date and reminder offset correctly.
3. Ensure deduplication logic blocks repeat notifications.
4. Ensure completed todos are excluded from reminder eligibility.
5. Ensure recurring next instance resets notification tracking.

### Integration/API Tests

1. `PUT /api/todos/[id]` persists valid `reminder_minutes`.
2. `PUT /api/todos/[id]` rejects invalid reminder value with `400`.
3. `PUT /api/todos/[id]` rejects reminder with missing due date.
4. `GET /api/notifications/check` returns only authenticated user's due reminders.
5. `GET /api/notifications/check` omits already-notified reminders.
6. Unauthenticated notification check returns `401`.
7. `POST /api/notifications/ack` marks notification as sent and is idempotent.
8. Removing due date clears `reminder_minutes` automatically.
9. `POST /api/notifications/ack` rejects invalid/future `trigger_at` with `400`.

### E2E Tests (Playwright)

1. Set `1h` reminder and verify notification appears when trigger window is reached.
2. Verify no duplicate notification for same todo during repeated polls.
3. Deny notification permission and verify graceful in-app fallback.
4. Verify reminder for recurring todo notifies once per occurrence.
5. Simulate polling network failure and verify recovery on subsequent poll.
6. Verify reminder is not suppressed unless ack is sent.

## Out of Scope

- Push notifications to mobile devices
- Email/SMS reminder channels
- User-custom reminder offsets beyond predefined options
- Cross-device notification sync guarantees outside browser session behavior

## Success Metrics

1. 100% acceptance criteria pass in QA and CI.
2. Duplicate reminder rate is effectively zero for single todo occurrence.
3. Reminder checks remain performant under expected user todo volume.
4. Notification delivery reliability meets agreed product threshold.

## References

- [README.md](README.md)
- [01-todo-crud-operations.md](01-todo-crud-operations.md)
- [02-priority-system.md](02-priority-system.md)
- [03-recurring-todos.md](03-recurring-todos.md)
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
- **Depends on:** 01-todo-crud-operations.md, 03-recurring-todos.md
- **Enables:** None (consumer feature)
- **Execution phase:** Phase 2 (Core Behavior)

### Blockers to Clear Before Sign-off
- Reminder trigger math must be timezone-accurate and recurrence-aware.
- Notification acknowledgment/deduplication protocol must be finalized.
- Browser permission flow and fallback UX must be defined before E2E hardening.

## Evaluation Traceability (EVALUATION.md)

| EVALUATION.md section | PRP coverage sections | Verification artifact |
|---|---|---|
| Feature 04 Implementation Checklist | Data Model, API Endpoints, Trigger Calculation, Duplicate Prevention | Notification API tests |
| Feature 04 Testing | Testing Requirements (Manual + E2E + Unit) | Browser permission + reminder evidence |
| Feature 04 Acceptance Criteria | Acceptance Criteria | Reminder timing verification logs |
