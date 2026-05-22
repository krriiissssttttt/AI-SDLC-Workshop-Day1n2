# PRP: Template System

## Feature Overview

Implement a reusable template system so users can save common todo patterns and create new todos from those templates quickly. Templates include metadata, optional category, and serialized subtasks. When a template is used, due date is computed using a configurable offset relative to current Singapore time.

This PRP defines:

- Template CRUD behavior and contracts
- Save and reuse workflow for todo patterns
- Subtasks JSON serialization format and validation
- Due date offset calculation rules
- Template categories and filtering behavior

## User Stories

1. As a user, I want to save a todo setup as a template so I can reuse it later.
2. As a user, I want template subtasks to be recreated automatically when I use a template.
3. As a user, I want due dates to auto-calculate from an offset so planning is faster.
4. As a user, I want to organize templates by category.
5. As a user, I want to edit and delete templates as my routines evolve.
6. As a user, I want template actions to feel immediate with safe rollback on failure.

## User Flow

### 1) Create Template from Form

1. User opens template manager and chooses create template.
2. User enters template title, optional description, optional category, offset days, and subtasks.
3. UI performs client validation.
4. UI adds template optimistically.
5. Client sends POST request.
6. On success:
   - Optimistic row is replaced with persisted template.
7. On failure:
   - Optimistic row is removed and error is shown.

### 2) Create Template from Existing Todo

1. User opens actions for a todo and selects save as template.
2. App pre-fills fields from todo and subtasks.
3. User confirms template details.
4. Client saves template and shows success feedback.

### 3) Use Template to Create Todo

1. User selects a template and clicks use template.
2. UI shows optional confirmation with calculated due date preview.
3. Client calls use-template endpoint.
4. Server creates todo + subtasks from serialized template data.
5. UI inserts new todo optimistically and reconciles on response.
6. On failure:
   - Optimistic todo is rolled back and error is shown.

### 4) Update Template

1. User edits template fields (title, category, offset, subtasks, etc.).
2. UI updates immediately (optimistic update).
3. Client sends PUT request.
4. On success:
   - Server response reconciles local state.
5. On failure:
   - Previous template snapshot is restored.

### 5) Delete Template

1. User deletes template.
2. UI removes template instantly.
3. Client sends DELETE request.
4. On success:
   - No further action required.
5. On failure:
   - Template is restored.

## Technical Requirements

## Data Model

Use existing DB conventions from lib/db.ts.

Template table should include at minimum:

- id
- user_id
- title
- description (nullable)
- category (nullable)
- due_date_offset_days (integer, nullable)
- priority (nullable or default medium per implementation policy)
- reminder_minutes (nullable)
- recurrence_pattern (nullable or none)
- subtasks_json (JSON string)
- created_at
- updated_at

Subtasks JSON structure (canonical):

- Array of objects: [{ title: string, position: number }]

Data integrity requirements:

- Templates are user-owned and isolated by user_id.
- subtasks_json must always be valid JSON matching canonical structure.
- Position values inside subtasks_json are zero-based contiguous integers.
- SQLite foreign keys must be enabled for downstream todo/subtask writes when template is used.
- If recurrence_pattern is not none, due_date_offset_days is required.
- If reminder_minutes is set, due_date_offset_days is required.

## Template Categories

Category behavior:

1. Category is optional free-text label (for example Work, Personal, Finance).
2. Category max length: 50 characters after trimming.
3. Empty/whitespace category is normalized to null.
4. Category matching for filtering is case-insensitive.

Optional extension:

- If project later introduces dedicated categories table, migration must preserve existing category strings.

## Subtasks JSON Serialization

Serialization rules:

1. Serialize subtasks as JSON string in template storage.
2. Preserve title and intended order position.
3. Reject invalid shapes, missing title, duplicate positions, or invalid numeric positions.
4. Reject empty/whitespace-only subtask titles.
5. Limit subtask count per template (recommended default: 200).

Canonicalization:

- On write, accept unordered/non-contiguous positions, then normalize by sorting position and reindexing to contiguous zero-based values.
- On read, return parsed subtasks in canonical order.

Validation schema example (conceptual):

- subtasks: array of { title: string(1..200), position: int >= 0 }

## Due Date Offset Calculation

All due date calculations must use Singapore timezone utilities from lib/timezone.ts.

Offset semantics:

1. due_date_offset_days represents whole days from Singapore current date/time at template use time.
2. If offset is null, created todo due_date is null unless user explicitly sets one.
3. If offset = 0, due date is now in Singapore context (subject to minimum lead-time rule below).
4. If offset > 0, due date is now + offset days in Singapore context, preserving local wall-clock time.
5. Negative offsets are invalid and must return 400.

Consistency requirements:

- Use getSingaporeNow() as source of now.
- Ensure DST-agnostic behavior through timezone helper usage.
- Apply canonical due date algorithm at template-use time:
  1.  nowSg = getSingaporeNow()
  2.  dueAtSg = nowSg shifted by due_date_offset_days (0 allowed), preserving local wall-clock time
  3.  if dueAtSg < nowSg + 1 minute, set dueAtSg = nowSg + 1 minute
  4.  persist dueAtSg as ISO datetime string format used by todo APIs
- Template use must satisfy todo invariants: recurrence_pattern != none or reminder_minutes set requires non-null due_date.

## API Endpoints

All endpoints require authentication and user scoping.

Error contract for all non-2xx responses:

- { error: string, details?: Record<string, string> }

### GET /api/templates

Purpose:

- Return templates for authenticated user.

Behavior:

- 401 unauthenticated.
- 200 with template list (sorted by updated_at desc, then id desc).
- Supports optional category filter query using contract below:
  - query param: category
  - category omitted: return all templates
  - category empty string: return uncategorized templates (category is null)
  - otherwise: trim + lowercase query and apply exact case-insensitive match

### POST /api/templates

Purpose:

- Create template.

Input payload:

- title (required)
- description (optional)
- category (optional)
- due_date_offset_days (optional integer)
- priority (optional)
- reminder_minutes (optional)
- recurrence_pattern (optional)
- subtasks (optional array; serialized server-side to subtasks_json)

Validation rules:

- title: required, trimmed, 1 to 200 chars.
- description: optional, max 5000 chars.
- category: optional, max 50 chars.
- due_date_offset_days: optional integer >= 0.
- reminder_minutes: if present, must match allowed values.
- recurrence_pattern: must be supported enum.
- subtasks: must match canonical schema.
- recurrence_pattern != none requires due_date_offset_days.
- reminder_minutes set requires due_date_offset_days.

Behavior:

- 400 invalid payload.
- 401 unauthenticated.
- 201 with created template.

### PUT /api/templates/[id]

Purpose:

- Update template fields.

Validation rules:

- Reject empty update payload.
- Apply create rules to provided fields.
- If subtasks provided, reserialize canonically.

Behavior:

- 400 invalid payload.
- 401 unauthenticated.
- 404 if template missing or unowned.
- 200 with updated template.

### DELETE /api/templates/[id]

Purpose:

- Delete template.

Behavior:

- 401 unauthenticated.
- 404 if template missing or unowned.
- 200 with { success: true }.

### POST /api/templates/[id]/use

Purpose:

- Create a todo from template.

Server actions:

1. Validate template ownership.
2. Parse subtasks_json and validate structure.
3. Compute due_date from due_date_offset_days using Singapore timezone.
4. Create todo with inherited fields (title, description, priority, recurrence, reminder).
5. Create subtasks from serialized array with canonical positions.
6. Return created todo with related subtasks.

Idempotency contract:

- Client should send Idempotency-Key header for use-template requests.
- Server stores key scoped by user_id + template_id + request payload hash for a bounded TTL window.
- Repeated request with same valid key returns the previously created todo response and must not create duplicates.

Behavior:

- 401 unauthenticated.
- 404 if template missing or unowned.
- 400 for invalid template data shape (defensive check).
- 201 with created todo payload.
- 200 with previously created payload when replayed under same idempotency key.

## Save and Reuse Todo Patterns

Requirements:

1. Template can be created from scratch or from existing todo data.
2. Using template must produce a new independent todo (not linked for live sync).
3. Edits to source template after use do not mutate previously created todos.
4. Template usage should preserve intended ordering of subtasks.
5. Inherited fields must be explicit and documented in API response.

## UI Components

### Template Manager

- List of templates with title, category, and updated time.
- Search/filter by category.
- Create/edit/delete controls.

### Template Editor

- Inputs for title, description, category, due date offset.
- Subtask editor with order controls.
- Validation messages for invalid JSON-derived structures.

### Use Template Action

- Action button in template list and/or quick action menu.
- Optional preview of generated due date and subtask count.
- Success feedback with navigation/focus to new todo.

## Validation and Error Handling

## Input Validation Strategy

Use schema validation (recommended: zod) for body and query params.

Requirements:

- Trim string fields.
- Normalize empty optional fields to null where appropriate.
- Validate subtasks array shape before serialization.
- Reject malformed JSON when reading existing template payloads.
- Return deterministic field-level errors.

## Error Handling Rules

1. 401 for missing/invalid session.
2. 404 for missing or unowned templates.
3. 400 for validation/data-shape errors.
4. 500 for unexpected server/database failures with generic message.
5. Log errors server-side with context; do not leak internals.

## Optimistic UI Updates

## Client Behavior Requirements

Apply optimistic updates for template create/update/delete and template use action.

### Optimistic Template Create

- Insert temporary template row.
- Replace on success.
- Remove on failure.

### Optimistic Template Update

- Snapshot current template.
- Apply update immediately.
- Revert snapshot on failure.

### Optimistic Template Delete

- Remove template from list immediately.
- Restore snapshot on failure.

### Optimistic Use Template

- Insert temporary todo + subtasks preview state.
- Reconcile with created todo response.
- Revert optimistic insertion on failure.
- Use mutation versioning/request tokens to ignore stale responses.

## Edge Cases

1. Template with empty subtask list.
2. Template with maximum allowed subtasks.
3. Invalid serialized subtasks_json in legacy rows.
4. Negative due date offset.
5. Very large offset values beyond acceptable range.
6. Category with only whitespace.
7. Template deleted in another tab before use request.
8. Use-template request retries after network timeout (idempotency key prevents duplicate todo creation).
9. Source todo changed after saving template (template should remain snapshot-based).

## Acceptance Criteria

1. User can create, read, update, and delete templates.
2. User can create template from existing todo and from scratch.
3. Subtasks serialize to canonical JSON and deserialize correctly.
4. Using a template creates a new todo with expected inherited fields.
5. Due date offset calculation is correct in Singapore timezone.
6. Category is optional, normalized, and filterable.
7. All endpoints enforce authentication and ownership.
8. Validation errors return structured field-level details.
9. Optimistic UI actions are immediate and rollback correctly on failure.
10. No cross-user template data exposure occurs.
11. Template with recurrence or reminder cannot be saved/used without due_date_offset_days.
12. Replayed use-template requests with same idempotency key do not create duplicate todos.

## Testing Requirements

## Unit Tests

1. Serialization helpers:
   - subtask schema validation
   - canonical position reindexing
   - JSON encode/decode integrity
2. Due date offset helper:
   - null offset behavior
   - 0-day offset behavior
   - positive offsets in Singapore timezone
   - negative offset rejection
3. Category normalization:
   - trim to null behavior
   - case-insensitive filter matching
4. Optimistic reducers:
   - template CRUD rollback
   - use-template rollback behavior

## Integration Tests (API)

1. GET /api/templates returns only user templates.
2. POST /api/templates validates payload and stores canonical subtasks_json.
3. PUT /api/templates/[id] updates fields and reserializes subtasks.
4. DELETE /api/templates/[id] removes owned template.
5. POST /api/templates/[id]/use creates todo + subtasks with expected fields.
6. Use-template due date is computed from Singapore now + offset days.
7. Unauthorized requests return 401.
8. Unowned template access returns 404.
9. Invalid subtasks shape returns 400.
10. Template create/update rejects recurrence/reminder without due_date_offset_days.
11. GET /api/templates category filter follows omitted/empty/exact case-insensitive contract.
12. Replayed POST /api/templates/[id]/use with same idempotency key returns prior created todo.

## E2E Tests (Playwright)

1. Create template with subtasks and category, then reuse it.
2. Save existing todo as template and verify field inheritance.
3. Use template and verify generated due date and subtask order.
4. Edit template and verify subsequent uses apply updated version only.
5. Delete template and verify it is removed from manager.
6. Force API failure and verify optimistic rollback behavior.

## Out of Scope

1. Sharing templates across users.
2. Version history/diff for templates.
3. Marketplace/public template gallery.
4. Smart/AI-generated template suggestions.

These can be handled by future PRPs.

## Success Metrics

1. Template use success rate >= 99% in normal network conditions.
2. Template-to-todo creation perceived as instant via optimistic UI.
3. Zero malformed subtasks_json writes after validation rollout.
4. Zero cross-user template access incidents.
5. Due date offset behavior matches Singapore timezone rules in tests.

## Implementation Checklist

1. Implement template CRUD endpoints with strict ownership checks.
2. Implement canonical subtask serialization/deserialization helpers.
3. Implement use-template endpoint with transactional todo+subtask creation.
4. Implement due date offset calculation via timezone helpers.
5. Implement category filtering and normalization.
6. Add optimistic UI flows with rollback and stale response protection.
7. Add unit, integration, and E2E tests mapped to acceptance criteria.

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
- **Depends on:** 01-todo-crud-operations.md, 05-subtasks-progress.md, 06-tag-system.md
- **Enables:** 09-export-import.md (template payload integrity)
- **Execution phase:** Phase 4 (Productivity)

### Blockers to Clear Before Sign-off
- Subtasks JSON schema must be canonical and versioned by contract.
- Due-date offset behavior must be Singapore-timezone consistent.
- Template-to-todo materialization must be transactional to avoid partial creates.

## Evaluation Traceability (EVALUATION.md)

| EVALUATION.md section | PRP coverage sections | Verification artifact |
|---|---|---|
| Feature 07 Implementation Checklist | Data Model, Serialization Rules, API Endpoints, Use Template Flow | Template API tests |
| Feature 07 Testing | Testing Requirements | Playwright template create/use tests |
| Feature 07 Acceptance Criteria | Acceptance Criteria | Offset and subtask materialization QA |
