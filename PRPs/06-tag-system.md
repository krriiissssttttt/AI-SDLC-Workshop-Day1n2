# PRP: Tag System

## Feature Overview

Implement a complete tag system for todos using color-coded labels and many-to-many relationships. Users should be able to create, read, update, and delete tags, assign tags to todos, and filter todo lists by selected tags.

This PRP defines:

- Tag CRUD behavior and API contracts
- Color-coded label rules and validation
- Many-to-many data model and relationship integrity
- Todo filtering by one or more tags
- Error handling, optimistic UI, and testing requirements

## User Stories

1. As a user, I want to create custom tags so I can organize todos by category.
2. As a user, I want each tag to have a color so I can quickly scan my list visually.
3. As a user, I want to edit or rename tags when my organization needs change.
4. As a user, I want to assign multiple tags to a single todo.
5. As a user, I want to remove tags from a todo without deleting the todo.
6. As a user, I want to filter todos by tag so I can focus on relevant tasks.
7. As a user, I want tag actions to feel instant with reliable rollback when requests fail.

## User Flow

### 1) Create Tag

1. User opens tag management UI.
2. User enters tag name and selects a color.
3. UI adds new tag immediately (optimistic create).
4. Client sends POST request.
5. On success:
   - Optimistic tag is replaced with persisted tag.
6. On failure:
   - Optimistic tag is removed.
   - Validation/server error is displayed.

### 2) Update Tag

1. User edits tag name and/or color.
2. UI updates tag label immediately (optimistic update).
3. Client sends PUT request.
4. On success:
   - Server response reconciles local state.
5. On failure:
   - Previous tag state is restored.

### 3) Delete Tag

1. User deletes a tag from tag management.
2. UI removes tag immediately.
3. Client sends DELETE request.
4. On success:
   - Tag is removed from all todo associations.
5. On failure:
   - Tag and associations are restored locally.

### 4) Assign/Unassign Tag on Todo

1. User opens todo tag picker.
2. User selects/deselects one or more tags.
3. UI updates selected chips instantly.
4. Client sends mutation request.
5. On success:
   - Associations remain as shown.
6. On failure:
   - Selection is rolled back and error shown.

### 5) Filter Todos by Tag

1. User selects one or more tags in filter controls.
2. Todo list updates in real time.
3. User can clear filters to return to full list.
4. Filter state remains stable during background refetches.

## Technical Requirements

## Data Model

Use shared types and DB conventions in lib/db.ts.

Tables:

- tags
  - id
  - user_id
  - name
  - color
  - created_at
  - updated_at
- todo_tags (join table)
  - todo_id
  - tag_id

Relationship requirements:

- User owns tags (tags.user_id).
- A todo can have many tags.
- A tag can be linked to many todos.
- Tag names must be unique per user in a case-insensitive way at DB level using normalized_name = lower(trim(name)).
- Enforce unique(user_id, normalized_name) and map DB unique constraint conflicts to 409.
- Join table enforces uniqueness on (todo_id, tag_id).
- Join table uses foreign keys with cascade deletes:
  - ON DELETE CASCADE for todo_id and tag_id.
- SQLite foreign keys must be enabled at DB initialization (PRAGMA foreign_keys = ON).

Ownership and isolation:

- Users must never access or mutate other users' tags or associations.
- Tag assignment is allowed only when both todo and tag belong to session.userId.

## Color-Coded Labels

Supported format:

- Hex color string in #RRGGBB format (recommended canonical form).

Validation rules:

- color is required for tag create.
- color must match /^#[0-9A-Fa-f]{6}$/.
- Server stores canonical uppercase value for consistency (for example #3B82F6).

Rendering rules:

1. Tag chip background/border/text contrast should remain readable.
2. Color is presentation metadata only and must not affect filtering logic.
3. If invalid legacy color data exists, UI falls back to a safe default color.
4. Color contrast must meet WCAG AA for normal text (minimum 4.5:1).
5. If provided color fails contrast, UI must auto-select contrasting text color and apply a visible border fallback.

## API Endpoints

All endpoints require authentication with getSession().

Error contract for all non-2xx responses:

- { error: string, details?: Record<string, string> }

### GET /api/tags

Purpose:

- Return all tags for authenticated user.

Behavior:

- 401 unauthenticated.
- 200 with tags sorted by name ascending.

### POST /api/tags

Purpose:

- Create a tag for authenticated user.

Input payload:

- name (required string)
- color (required string)

Validation rules:

- name: required, trimmed, 1 to 50 chars.
- color: required, hex #RRGGBB.
- tag name uniqueness per user is case-insensitive.

Behavior:

- 400 for validation errors.
- 401 unauthenticated.
- 409 for duplicate tag name within same user scope.
- 201 with created tag.

### PUT /api/tags/[id]

Purpose:

- Update tag name and/or color.

Input payload:

- name (optional)
- color (optional)

Validation rules:

- Reject empty update payload.
- name when provided: trimmed, 1 to 50 chars.
- color when provided: valid hex #RRGGBB.
- Updated name must remain unique per user (case-insensitive).

Behavior:

- 400 invalid payload.
- 401 unauthenticated.
- 404 if tag missing or not owned.
- 409 duplicate name conflict.
- 200 with updated tag.

### DELETE /api/tags/[id]

Purpose:

- Delete tag and its associations.

Behavior:

- 401 unauthenticated.
- 404 if tag missing or not owned.
- 200 with { success: true }.
- Related rows in todo_tags removed via cascade.

### PUT /api/todos/[id]/tags

Purpose:

- Replace todo tag associations with provided tag set.

Input payload:

- tagIds (required array of tag IDs)

Validation rules:

- tagIds must contain unique IDs.
- Every tagId must exist and be owned by session user.
- Todo must exist and be owned by session user.

Behavior:

- 400 invalid payload.
- 401 unauthenticated.
- 404 if todo not found or not owned.
- 404 if one or more tags are missing/not owned.
- 200 with updated todo tags.

### GET /api/todos?tagIds=1,2,3&tagMode=any|all

Purpose:

- Filter todos by selected tags.

Filter semantics:

- tagMode=any (default): return todos that have at least one selected tag.
- tagMode=all: return todos that have all selected tags.

Behavior:

- 401 unauthenticated.
- 200 with filtered todos scoped to user.
- Empty tagIds means no tag filtering.

## Tag Management (CRUD)

Requirements:

1. User can create tag with name and color.
2. User can rename tag and change color.
3. User can delete tag safely.
4. Duplicate tag names are prevented per user (case-insensitive).
5. Tag updates propagate immediately anywhere the tag is displayed.

## Many-to-Many Relationship Integrity

Requirements:

1. A todo can reference zero or many tags.
2. A tag can reference zero or many todos.
3. Duplicate associations (same todo_id + tag_id) must be prevented.
4. Association mutations must be transactional.
5. Deleting a todo or tag must clean join rows via cascade.
6. API reads must avoid N+1 patterns for tags on todo lists.

Implementation notes:

- Use set-based SQL for replace-association flows.
- For list endpoints, prefer joined/aggregated query patterns over per-row lookups.

## Filtering by Tag

Client behavior:

1. Filter controls show available tags with color chips.
2. Multiple tags can be selected.
3. User can switch between any/all matching modes.
4. Clear filters resets list to unfiltered results.

Server behavior:

1. Parse and validate tagIds query list.
2. Ignore duplicates after validation normalization.
3. Reject malformed IDs with 400.
4. Ensure selected tags belong to session user before applying filter.
5. If any requested tagId is missing or not owned by session user, return 404 with a generic error.

Performance expectations:

1. Filtering must remain responsive for large todo lists.
2. DB indexes should support join/filter path:
   - unique(todo_id, tag_id)
   - idx_todo_tags_tag_id_todo_id
   - idx_todo_tags_todo_id_tag_id
   - idx_tags_user_id_name
3. all mode queries must be optimized for grouped/having patterns using the composite indexes above.

## UI Components

### Tag Manager

- Create/edit/delete tag modal or panel.
- Inputs: tag name and color picker.
- Validation feedback for duplicate names and invalid colors.

### Todo Tag Picker

- Multi-select control on each todo.
- Shows selected tags as chips.
- Supports add/remove without leaving todo context.

### Tag Filter Bar

- Displays all available tags as selectable filter chips.
- Supports any/all mode selection.
- Includes clear filters action and empty state messaging.

### Tag Chip Rendering

- Uses stored color for chip presentation.
- Applies accessible text color and fallback border rules.
- Handles overflow/ellipsis gracefully for long tag names.

## Validation and Error Handling

## Input Validation Strategy

Use schema validation (recommended: zod) for route payloads and query params.

Requirements:

- Trim tag name and collapse accidental extra spaces where policy allows.
- Normalize color to uppercase canonical hex before persistence.
- Return deterministic field-level validation errors.
- Never expose stack traces in API responses.

## Error Handling Rules

1. 401 for unauthenticated access.
2. 404 for missing/unowned resources.
3. 400 for invalid payload/query formats.
4. 409 for duplicate tag name conflicts.
5. 500 for unexpected failures with generic error message.
6. Log server errors with context without exposing internals.

## Optimistic UI Updates

## Client Behavior Requirements

Apply optimistic updates for tag create/update/delete and todo-tag assignment.

### Optimistic Tag Create

- Add temporary tag locally with temporary ID.
- Replace with persisted tag on success.
- Remove and notify on failure.

### Optimistic Tag Update

- Snapshot previous tag values.
- Apply local rename/color change immediately.
- Revert snapshot on failure.

### Optimistic Tag Delete

- Remove tag chips from local tag list and affected todos.
- Snapshot previous associations for rollback.
- Restore tag and associations on failure.

### Optimistic Todo-Tag Assignment

- Apply selected tag IDs instantly.
- Use per-todo mutation versioning/request tokens to ignore stale responses.
- Revert to previous selection on failure.

## Edge Cases

1. Tag name differs only by case from an existing tag.
2. Tag color format invalid or empty.
3. Empty tag name after trimming whitespace.
4. Deleting tag currently used by many todos.
5. Assigning tags when one selected tag no longer exists.
6. Concurrent edits to same tag from multiple tabs.
7. Filtering with unknown or unauthorized tag IDs.
8. No tags exist (empty state in manager and filters).
9. Todo has many tags causing chip overflow in UI.

## Acceptance Criteria

1. User can perform tag CRUD operations successfully.
2. Tags render as color-coded labels consistently.
3. Todo-tag associations support many-to-many correctly.
4. Duplicate associations are prevented.
5. Tag deletion removes join rows and leaves no orphan associations.
6. Filtering by one or more tags returns correct results for any/all modes.
7. All tag and association endpoints enforce auth and ownership checks.
8. Validation and conflict errors return consistent structured responses.
9. Optimistic tag and association mutations are immediate and roll back on failure.
10. Query performance remains acceptable with indexes in place.
11. If any filter tagId is missing or unowned, endpoint returns 404 with generic error.
12. Tag associations remain correct through export/import round-trip flows.

## Testing Requirements

## Unit Tests

1. Validation schemas:
   - name trimming/length
   - color format and canonicalization
   - query parsing for tagIds and tagMode
2. Filter logic helpers:
   - any mode behavior
   - all mode behavior
   - empty filter behavior
3. Optimistic state reducers:
   - tag CRUD rollback
   - association update rollback

## Integration Tests (API)

1. GET /api/tags returns only current user's tags.
2. POST /api/tags creates valid tag and rejects invalid payload.
3. POST /api/tags returns 409 for case-insensitive duplicates.
4. PUT /api/tags/[id] updates owned tag and enforces uniqueness.
5. DELETE /api/tags/[id] removes tag and cascades todo_tags rows.
6. PUT /api/todos/[id]/tags replaces associations atomically.
7. Unauthorized requests return 401.
8. Unowned resources return 404.
9. Filtered GET /api/todos returns correct any/all results.
10. Foreign key enforcement and join-table uniqueness are verified.
11. GET /api/todos filtering returns 404 when any tagId is missing or unowned.
12. Duplicate-case tag creates are prevented by DB-level uniqueness under concurrent requests.
13. Export/import round-trip preserves todo-tag associations.

## E2E Tests (Playwright)

1. Create tag, assign color, and verify chip rendering.
2. Rename tag and verify updates across todo list views.
3. Assign multiple tags to a todo and persist after refresh.
4. Filter todos by single and multiple tags in any/all modes.
5. Delete tag in use and verify todos remain without that tag.
6. Force API failure and verify optimistic rollback behavior.

## Out of Scope

1. Hierarchical or nested tags.
2. Shared global tags across different users.
3. Tag analytics dashboards.
4. AI-generated auto-tagging.

These can be handled in future enhancements.

## Success Metrics

1. Tag CRUD success rate >= 99% under normal network conditions.
2. Filter interactions update visible list within perceived instant response thresholds.
3. Zero cross-user data leakage for tags and associations.
4. Zero orphan todo_tags rows after todo/tag deletions.
5. Conflict and validation handling prevents invalid tag states.

## Implementation Checklist

1. Implement/verify tags and todo_tags constraints and indexes.
2. Implement tag CRUD endpoints with ownership enforcement.
3. Implement todo-tag association replace endpoint transactionally.
4. Implement tag-based filtering (any/all) with validated query parsing.
5. Add optimistic UI paths with rollback and stale response protection.
6. Add unit, integration, and E2E tests mapped to acceptance criteria.

## References

- Project-wide instructions: .github/copilot-instructions.md
- Feature index and dependencies: PRPs/README.md
- User-facing behavior and examples: USER_GUIDE.md
