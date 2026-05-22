# PRP: Todo CRUD Operations

## Feature Overview

Implement full Todo CRUD (Create, Read, Update, Delete) as the foundation of the application. This feature must support timezone-safe date behavior for Singapore, robust validation and error handling, and responsive optimistic UI updates that keep the interface fast and trustworthy.

This PRP defines:

- User flows for creating and managing todos
- API contracts for CRUD endpoints
- Validation and error response rules
- Optimistic UI strategy and rollback behavior
- Acceptance criteria and test requirements

## User Stories

1. As a user, I want to create a todo quickly so I can capture tasks immediately.
2. As a user, I want to view all my todos so I can understand my workload.
3. As a user, I want to edit title, description, due date, and completion status so my list remains accurate.
4. As a user, I want to delete todos I no longer need so my list stays clean.
5. As a user, I want due dates and time behavior to follow Singapore timezone consistently.
6. As a user, I want immediate UI feedback for actions, even before the server responds.

## User Flow

### 1) Create Todo

1. User enters todo title and optional fields (description, due date, priority, recurrence, reminder).
2. User submits form.
3. UI immediately inserts a temporary todo (optimistic state).
4. Client sends POST request to create todo.
5. On success:
   - Temporary item is replaced with server item.
   - UI reflects persisted values and IDs.
6. On failure:
   - Temporary item is removed.
   - Error message is shown with actionable text.

### 2) Read Todos

1. User opens app home page.
2. Client requests todo list for authenticated session user.
3. UI shows loading state and then renders list.
4. Empty state is shown when no todos exist.

### 3) Update Todo

1. User edits todo content or toggles completion.
2. UI updates immediately (optimistic patch).
3. Client sends PUT request with changed fields.
4. On success:
   - Server response reconciles optimistic values.
5. On failure:
   - Todo reverts to previous state.
   - Error is surfaced inline or via toast.

### 4) Delete Todo

1. User triggers delete on a todo.
2. UI removes todo immediately (optimistic delete).
3. Client sends DELETE request.
4. On success:
   - No further action required.
5. On failure:
   - Todo is restored to previous position and state.
   - Error message is displayed.

## Technical Requirements

## Data Model

Use existing database schema and types from lib/db.ts. Todo record should include at least:

- id
- user_id
- title
- description (nullable)
- completed
- due_date (nullable, ISO date/time string)
- created_at
- updated_at
- priority
- recurrence_pattern
- reminder_minutes

Note:

- All DB operations use better-sqlite3 and are synchronous.
- Never query todos without user scoping.

## Timezone Handling (Singapore Mandatory)

All date/time logic must use helpers in lib/timezone.ts, not direct new Date() for business logic.

Required principles:

- Use getSingaporeNow() for "now" operations.
- Format dates with Singapore-aware helpers before rendering or comparison.
- Validate due dates against Singapore-local interpretation.
- Server-side defaults for created_at/updated_at should be generated consistently.

Examples of behavior:

- A due date selected at 00:30 Singapore time remains on that Singapore date.
- Filtering by today/overdue must be based on Singapore date boundaries.

## API Endpoints

All endpoints must enforce authentication with getSession().

Error contract for all endpoints:

- All non-2xx responses must use: { error: string, details?: Record<string, string> }

### GET /api/todos

Purpose:

- Return todos for the authenticated user.

Behavior:

- 401 when unauthenticated.
- 200 with list of todos on success.
- Results scoped by session.userId only.

Success payload:

- Array of todo objects.

Error payload:

- { error: string }

### POST /api/todos

Purpose:

- Create a new todo.

Input payload:

- title (required string)
- description (optional string)
- due_date (optional string)
- completed (optional boolean, default false)
- priority (optional, default medium)
- recurrence_pattern (optional, default none)
- reminder_minutes (optional number or null)

Validation rules:

- title: required, trimmed, 1 to 200 chars.
- description: optional, max 5000 chars.
- due_date: optional, must parse as valid date.
- due_date: if provided, must be at least 1 minute after current Singapore time.
- reminder_minutes: if present, must be one of allowed values (15, 30, 60, 120, 1440, 2880, 10080).
- priority: one of high, medium, low.
- recurrence_pattern: one of none, daily, weekly, monthly, yearly.
- recurrence_pattern != none requires due_date.
- reminder_minutes requires due_date.

Behavior:

- 400 with field-specific validation errors when invalid.
- 401 when unauthenticated.
- 201 with created todo on success.

### PUT /api/todos/[id]

Purpose:

- Update an existing todo.

Input payload:

- Partial update allowed for editable fields.

Validation rules:

- id must refer to an existing todo owned by session.userId.
- Same field rules as create, for provided fields only.
- Reject empty update payload.
- If recurrence_pattern is set to a value other than none, due_date must be provided in the same request or already exist on the todo.
- If reminder_minutes is provided, due_date must be provided in the same request or already exist on the todo.

Behavior:

- 400 for invalid payload.
- 401 unauthenticated.
- 404 if todo does not exist or is not owned by user.
- 200 with updated todo.

### DELETE /api/todos/[id]

Purpose:

- Delete todo owned by authenticated user.

Behavior:

- 401 unauthenticated.
- 404 if todo does not exist or is not owned by user.
- 200 with success response: { success: true }.
- Cascade behavior should remove related subtasks and mapping rows where configured.

## Validation and Error Handling

## Input Validation Strategy

Use a schema-first validator (recommended: zod) in route handlers.

Requirements:

- Trim and sanitize text fields.
- Return deterministic error shape for invalid fields.
- Do not expose internal stack traces in API responses.
- Log server-side errors with structured context.

Recommended error response shape:

- { error: string, details?: Record<string, string> }

Examples:

- Missing title: { error: "Validation failed", details: { title: "Title is required" } }
- Invalid due date: { error: "Validation failed", details: { due_date: "Invalid date" } }

## Error Handling Rules

1. Authentication errors return 401.
2. Authorization/resource ownership mismatches return 404 (avoid leaking existence).
3. Validation errors return 400 with field details.
4. Unexpected server errors return 500 with generic message.
5. Database errors should be caught and mapped to user-safe responses.

## Optimistic UI Updates

## Client Behavior Requirements

Implement optimistic updates for create, update, and delete actions.

### Optimistic Create

- Generate a temporary client ID (for example temp-<timestamp>-<random>).
- Add temporary todo to local list immediately.
- Mark with local-only status (isOptimistic: true) if needed.
- Replace with server item on success.
- Remove and show error on failure.

### Optimistic Update

- Snapshot previous todo state before patch.
- Apply local patch instantly.
- On failure, restore snapshot and notify user.

### Optimistic Delete

- Remove item from list immediately.
- Keep backup (item + original index) for rollback.
- Restore on failure at original position.

### UX Expectations

- Loading state should be visible but non-blocking.
- Failed actions should provide clear retry path.
- Avoid duplicate submissions for same action while request is in-flight.

## API and UI Contract Notes

1. Server remains source of truth.
2. Client must reconcile optimistic items with server responses.
3. If list refetch occurs during optimistic transitions, preserve local consistency.
4. Keep idempotent behavior where practical to reduce accidental duplication.
5. Use per-todo mutation versioning (or request tokens) so stale responses are ignored.
6. Collapse repeated rapid toggles to latest intent, or block overlapping same-field mutations.

## Edge Cases

1. Empty title or whitespace-only title.
2. Very long title/description beyond limits.
3. Invalid or malformed date strings.
4. Due date earlier than Singapore now plus 1 minute should be rejected with 400 and due_date details.
5. Race condition: user toggles completion repeatedly before first request returns.
6. Network timeout during optimistic update.
7. Delete request succeeds server-side but client fails to receive response.
8. User session expires during mutation request.
9. Concurrent edits in multiple tabs.
10. User attempts to update/delete another user's todo by id.

## Acceptance Criteria

1. User can create a todo and see it immediately in UI.
2. User can read all their todos after page load.
3. User can update todo fields and completion state.
4. User can delete a todo successfully.
5. All CRUD endpoints enforce authentication.
6. All todo queries are scoped to session.userId.
7. Validation rejects malformed inputs with field-level details.
8. API errors use consistent shape and status codes.
9. Singapore timezone helpers are used for date logic.
10. Optimistic create/update/delete each support rollback on failure.
11. No unhandled promise rejections or silent failures in client CRUD actions.

## Testing Requirements

## Unit Tests

1. Validation schema tests:
   - title required and length boundaries
   - optional fields accepted when valid
   - invalid enum/date/reminder values rejected
2. Timezone utility tests:
   - Singapore "today" boundary correctness
   - formatting and parsing behavior
3. Optimistic state reducer/helpers:
   - create success and rollback
   - update success and rollback
   - delete success and rollback

## Integration Tests (API)

1. GET /api/todos returns only authenticated user's todos.
2. POST /api/todos creates todo with defaults.
3. PUT /api/todos/[id] updates allowed fields only.
4. DELETE /api/todos/[id] removes owned todo.
5. Unauthorized requests return 401.
6. Ownership mismatch returns 404.
7. Invalid payload returns 400 with details.
8. Server error path returns 500 generic error.

## E2E Tests (Playwright)

1. Create todo from UI and verify persistence after refresh.
2. Edit todo title and completion state.
3. Delete todo and verify removal.
4. Force network/API failure and verify optimistic rollback behavior.
5. Verify due date behavior matches Singapore timezone expectations.
6. Verify expired session redirects/blocks protected operations.

## Out of Scope

1. Subtasks and progress tracking.
2. Tags and tag filtering.
3. Recurring instance generation logic details.
4. Calendar month visualization.
5. Import/export workflows.

These are covered in dedicated PRPs.

## Success Metrics

1. CRUD success rate >= 99% in normal operation.
2. P95 API latency under target environment threshold.
3. Zero data-leak incidents across users.
4. Optimistic UI perceived response under 100 ms for local state change.
5. Validation/error handling prevents malformed writes.

## Implementation Checklist

1. Define or confirm validation schemas for create/update payloads.
2. Ensure all CRUD routes enforce session checks and user scoping.
3. Confirm Singapore timezone utilities are used in all relevant logic.
4. Implement optimistic create/update/delete with rollback.
5. Add unit, integration, and E2E tests mapped to acceptance criteria.
6. Verify no regressions in related flows (notifications, recurring, templates).

## References

- Project-wide patterns: .github/copilot-instructions.md
- Feature index and workflow: PRPs/README.md
- User behavior expectations: USER_GUIDE.md
