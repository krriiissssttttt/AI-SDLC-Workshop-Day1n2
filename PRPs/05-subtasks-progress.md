# PRP: Subtasks & Progress Tracking

## Feature Overview

Implement subtasks for todos with checklist behavior and real-time progress tracking. This feature allows users to break a todo into smaller steps, track completion visually with progress bars, manage subtask order, and rely on cascade deletion when parent todos are removed.

This PRP defines:

- Subtask create/read/update/delete behavior
- Progress calculation and visualization expectations
- Position management rules for ordered subtasks
- Cascade delete expectations and data integrity
- API contracts, validation rules, and test requirements

## User Stories

1. As a user, I want to add subtasks to a todo so I can break work into manageable steps.
2. As a user, I want to check off subtasks as I complete them.
3. As a user, I want to see a visual progress bar showing how much of a todo is done.
4. As a user, I want to reorder subtasks to reflect priority or workflow changes.
5. As a user, I want all subtasks removed automatically when deleting a parent todo.
6. As a user, I want updates to feel immediate with reliable rollback if something fails.

## User Flow

### 1) Add Subtask

1. User opens a todo details area or expanded row.
2. User enters subtask title and submits.
3. UI inserts the subtask immediately (optimistic create).
4. Client sends POST request to create subtask.
5. On success:
   - Optimistic item is replaced with persisted item.
6. On failure:
   - Optimistic item is removed.
   - Error message is shown.

### 2) Toggle Subtask Completion

1. User clicks subtask checkbox.
2. UI toggles completion instantly (optimistic update).
3. Progress bar updates immediately.
4. Client sends PUT/PATCH request.
5. On success:
   - UI remains as shown.
6. On failure:
   - Subtask state and progress revert.
   - Error is surfaced.

### 3) Edit Subtask Title

1. User edits subtask title inline.
2. UI reflects edited value optimistically.
3. Client sends update request.
4. On success:
   - Server value is reconciled.
5. On failure:
   - Previous title is restored.

### 4) Reorder Subtasks

1. User drags and drops or uses move up/down controls.
2. UI updates order immediately.
3. Client sends reordered positions.
4. On success:
   - Order remains and canonical positions are stored.
5. On failure:
   - Previous order is restored.

### 5) Delete Subtask

1. User clicks delete on a subtask.
2. UI removes subtask immediately.
3. Client sends DELETE request.
4. On success:
   - No further action required.
5. On failure:
   - Subtask is restored to original position.

## Technical Requirements

## Data Model

Use existing types and schema conventions from lib/db.ts.

Subtask should include at minimum:

- id
- todo_id
- title
- completed
- position
- created_at
- updated_at

Rules:

- Subtasks belong to a single todo.
- Todo ownership controls subtask access (via parent todo user_id).
- Position is zero-based and must be consistent system-wide.

Required DB constraints:

- FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
- Unique positional integrity per todo (unique(todo_id, position))
- SQLite foreign key enforcement must be enabled at DB initialization (PRAGMA foreign_keys = ON)

## API Endpoints

All endpoints require authentication and ownership validation through parent todo.

Error contract for all non-2xx responses:

- { error: string, details?: Record<string, string> }

### GET /api/todos/[id]/subtasks

Purpose:

- Fetch ordered subtasks for a todo.

Behavior:

- 401 unauthenticated.
- 404 if todo does not exist or is not owned by session user.
- 200 with subtasks sorted by position ascending.

### POST /api/todos/[id]/subtasks

Purpose:

- Create a new subtask in the target todo.

Input payload:

- title (required string)
- position (optional number; default append to end)

Validation rules:

- title: required, trimmed, 1 to 200 chars.
- position: optional integer >= 0.
- If position is provided, shift existing subtasks at and after that position.

Behavior:

- 400 on validation failure.
- 401 unauthenticated.
- 404 if todo missing or not owned.
- 201 with created subtask.

### PUT /api/subtasks/[id]

Purpose:

- Update a subtask title and/or completion status.

Input payload:

- title (optional)
- completed (optional)

Validation rules:

- Reject empty update payload.
- title when provided: trimmed, 1 to 200 chars.
- completed when provided: boolean.

Behavior:

- 400 for invalid payload.
- 401 unauthenticated.
- 404 if subtask missing or not owned via parent todo.
- 200 with updated subtask.

### PUT /api/todos/[id]/subtasks/reorder

Purpose:

- Persist new ordering for all subtasks in a todo.

Input payload:

- orderedSubtaskIds (required array)

Validation rules:

- orderedSubtaskIds must include each existing subtask exactly once.
- IDs must belong to subtasks of todo id route param owned by session user.

Behavior:

- 400 for invalid ordering payload.
- 401 unauthenticated.
- 404 if todo/subtasks not found or not owned.
- 200 with normalized ordered subtasks.

### DELETE /api/subtasks/[id]

Purpose:

- Delete one subtask.

Behavior:

- 401 unauthenticated.
- 404 if subtask missing or not owned.
- 200 with { success: true }.
- Remaining subtasks are reindexed to maintain contiguous positions.

## Checklist Functionality

Requirements:

1. Each subtask has a checkbox bound to completed.
2. Toggling checkbox updates subtask state and todo progress.
3. Toggling subtask completion must not automatically toggle parent todo completed state.
4. Completion updates should be idempotent and resilient to rapid clicks.
5. Keyboard interaction is supported (space/enter where applicable).
6. Accessibility labels describe action and state.

## Visual Progress Bars

Progress formula:

- If totalSubtasks = 0, progress = 0%.
- Else progress = floor((completedSubtasks / totalSubtasks) \* 100).
- Progress bar fill width must be clamped to 0 to 100.

UI expectations:

1. Progress bar updates immediately after optimistic subtask changes.
2. Progress text is shown (for example "3/5 completed" and "60%") for clarity.
3. Visual states should remain readable at low and high completion values.
4. Progress derives from subtasks source of truth, not duplicated mutable counters.
5. Progress bar should expose aria-valuemin=0, aria-valuemax=100, and aria-valuenow.

## Position Management

Position rules:

1. Positions must be contiguous integers without gaps after any create, delete, or reorder.
2. Reorder operation must be atomic at DB level (transaction) to avoid transient duplicates.
3. Concurrent reorder attempts must resolve deterministically (last write wins or version check).
4. API always returns subtasks in canonical position order.

Implementation notes:

- Use DB transactions for bulk position updates.
- Reindex on delete and insert-at-position operations.
- Avoid O(n^2) loops for large lists; batch updates where possible.

## Cascade Delete Behavior

Requirements:

1. Deleting a todo deletes all related subtasks automatically via foreign key cascade.
2. No orphan subtasks can remain after parent deletion.
3. Export/import or backup restore flows must preserve todo-subtask relationship integrity.
4. API behavior after parent deletion:
   - Subtask endpoints for deleted parent should return 404.

Verification expectations:

- Integration tests must confirm cascade behavior using real DB constraints.

## Validation and Error Handling

## Input Validation Strategy

Use schema validation (recommended: zod) in route handlers.

Requirements:

- Trim subtask title input.
- Reject empty/whitespace-only titles.
- Validate integer bounds and array shape for reorder payloads.
- Return deterministic field-level validation errors.

## Error Handling Rules

1. 401 for missing/invalid session.
2. 404 for missing or unauthorized todo/subtask resources.
3. 400 for validation failures.
4. 500 for unexpected server/database errors with generic message.
5. Log server-side error details without leaking internals to clients.

## Optimistic UI Updates

## Client Behavior Requirements

Apply optimistic updates for subtask create/update/delete/reorder.

### Optimistic Create

- Add temporary subtask at intended position.
- Shift following local positions as needed.
- Replace with server row on success.
- Roll back and restore prior ordering on failure.

### Optimistic Toggle/Edit

- Snapshot previous subtask and current progress values.
- Apply local changes instantly.
- Revert snapshot on failure.

### Optimistic Delete

- Remove row immediately and reindex local positions.
- Restore removed row and positions on failure.

### Optimistic Reorder

- Apply local order immediately.
- Store pre-reorder snapshot.
- Ignore stale responses using per-todo mutation versioning/request tokens.
- Revert to snapshot on failure.

## Edge Cases

1. Todo has zero subtasks (progress must show 0%).
2. Rapid repeated toggle on the same subtask before prior request returns.
3. Duplicate IDs or missing IDs in reorder payload.
4. Very long subtask title.
5. User attempts to mutate subtask for another user's todo.
6. Parent todo deleted while subtask request is in-flight.
7. Partial client failure after server reorder success (requires refetch reconciliation).
8. Network timeout during optimistic operations.

## Acceptance Criteria

1. User can add, edit, toggle, reorder, and delete subtasks.
2. Subtask lists are always returned sorted by position.
3. Progress bar and counts update correctly after all subtask actions.
4. Progress is accurate for 0, partial, and full completion states.
5. Reordering persists and remains stable after refresh.
6. Validation errors return structured details and do not write invalid data.
7. All endpoints enforce auth and ownership boundaries.
8. Deleting parent todo removes all subtasks via cascade behavior.
9. Optimistic operations feel immediate and correctly roll back on failure.
10. No orphan subtasks exist after parent todo deletion.
11. Subtask completion changes never auto-change parent todo completed state.
12. Position indexing is zero-based and contiguous after insert/delete/reorder.

## Testing Requirements

## Unit Tests

1. Validation schemas:
   - title constraints
   - reorder payload integrity
   - empty update rejection
2. Progress calculation helper:
   - 0/0 -> 0%
   - n/n -> 100%
   - mixed completion values
3. Position normalization helpers:
   - insert at index
   - delete and reindex
   - reorder canonicalization
4. Optimistic reducer/state logic:
   - create/update/delete/reorder rollback correctness

## Integration Tests (API)

1. GET subtasks returns ordered list for owned todo.
2. POST subtask appends or inserts correctly and shifts positions.
3. PUT subtask updates title/completed with validation.
4. PUT /api/todos/[id]/subtasks/reorder persists full new order atomically.
5. DELETE subtask removes row and reindexes remaining rows.
6. Unauthorized requests return 401.
7. Unauthorized ownership access returns 404.
8. Invalid payloads return 400 with details.
9. Deleting parent todo cascades and removes subtasks in DB.
10. Foreign key enforcement is enabled and validated in test setup.

## E2E Tests (Playwright)

1. Add multiple subtasks and verify checklist interactions.
2. Toggle subtasks and verify progress bar text and width updates.
3. Reorder subtasks and verify persistence after page reload.
4. Delete subtask and verify position/order normalization.
5. Delete parent todo and verify subtasks are gone.
6. Force API failure and verify optimistic rollback behavior.

## Out of Scope

1. Template creation/edit flows beyond subtask data usage.
2. Cross-todo drag and drop moves.
3. Nested subtasks (subtasks of subtasks).
4. Advanced analytics on completion velocity.

These are handled by other PRPs or future enhancements.

## Success Metrics

1. Subtask action success rate >= 99% under normal network conditions.
2. Progress bar update perceived within 100 ms from user action.
3. Zero orphan subtasks after parent deletions.
4. Reorder persistence is correct across refresh and session restart.
5. Validation prevents malformed subtask writes.

## Implementation Checklist

1. Add/verify DB constraints for subtask cascade and positional integrity.
2. Implement subtask CRUD and reorder endpoints with auth + ownership checks.
3. Implement deterministic position normalization for create/delete/reorder.
4. Implement progress calculation and UI progress bar rendering.
5. Add optimistic update logic with rollback and stale response protection.
6. Add unit, integration, and E2E tests mapped to acceptance criteria.

## References

- Project-wide instructions: .github/copilot-instructions.md
- Feature index and dependencies: PRPs/README.md
- User-facing behavior and examples: USER_GUIDE.md

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
- **Enables:** 07-template-system.md
- **Execution phase:** Phase 2 (Core Behavior)

### Blockers to Clear Before Sign-off
- Subtask position and reorder behavior must be deterministic.
- Cascade delete behavior must be enforced at DB and API levels.
- Progress calculation contract must be finalized before template serialization reuse.

## Evaluation Traceability (EVALUATION.md)

| EVALUATION.md section | PRP coverage sections | Verification artifact |
|---|---|---|
| Feature 05 Implementation Checklist | Data Model, API Endpoints, Progress Rules, UI Components | API + unit progress tests |
| Feature 05 Testing | Testing Requirements | Playwright subtask/progress flows |
| Feature 05 Acceptance Criteria | Acceptance Criteria | Cascade + progress QA checks |
