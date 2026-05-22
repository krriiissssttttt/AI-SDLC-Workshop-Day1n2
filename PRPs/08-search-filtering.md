# PRP: Search & Filtering

## Feature Overview

Implement a responsive search and filtering system for todos that supports real-time text search, advanced matching across title and tags, multi-criteria filtering, and strong client-side performance for large lists.

This PRP defines:

- Real-time query behavior and debounce rules
- Advanced search scope and matching semantics
- Multi-criteria filter contracts and precedence
- Client-side performance constraints and optimization strategies
- API/query contracts, validation, and test requirements

## User Stories

1. As a user, I want to search todos in real time so I can find tasks quickly.
2. As a user, I want search to match both todo titles and tag names.
3. As a user, I want to combine filters (status, priority, tags, date range) to narrow results.
4. As a user, I want filter state to be stable and predictable while data refreshes.
5. As a user, I want search interactions to remain fast even with many todos.

## User Flow

### 1) Real-Time Search

1. User types into search input.
2. UI updates local query state immediately.
3. Search execution is debounced.
4. Visible todo list updates without full-page reload.
5. Clearing query restores list using currently active non-text filters.

### 2) Advanced Search (Title + Tags)

1. User enters keyword.
2. System evaluates match against todo title and associated tag names.
3. Matched terms are highlighted in UI where feasible.
4. Result count and empty state update in sync.

### 3) Multi-Criteria Filtering

1. User adjusts one or more filter controls.
2. UI applies changes as a single composed filter set.
3. Search + filters produce intersection results.
4. User can reset one filter or all filters.

### 4) State Persistence and Refresh

1. User refreshes page or navigates away and back.
2. Search and filter state is restored from URL query params.
3. Results are recomputed deterministically.

## Technical Requirements

## Search Scope and Matching Rules

Default searchable fields:

- todo title
- associated tag names

Matching semantics:

1. Case-insensitive matching.
2. Deterministic normalization: normalize searchable text and query with NFC, then apply locale-independent lowercase before tokenization.
3. Substring matching by default.
4. Trim surrounding whitespace from query.
5. Empty query means no text filter.
6. If normalize support is unavailable, use a shared polyfill path so behavior remains consistent across runtimes.

Token behavior:

- Split query by whitespace into tokens.
- All tokens must match somewhere in the searchable fields (AND token semantics).

## Multi-Criteria Filters

Supported filters:

- status: all | active | completed
- priority: all | high | medium | low
- tagIds: array of selected tags
- tagMode: any | all (for multi-tag matching)
- dueFrom: optional ISO datetime
- dueTo: optional ISO datetime
- hasDueDate: all | yes | no
- sortBy: createdAt | updatedAt | dueDate | priority | title
- sortDir: asc | desc

Composition rules:

1. Final result set = intersection of all active criteria.
2. Text query applies before pagination.
3. Tag filter semantics:
   - tagMode any: todo must include at least one selected tag.
   - tagMode all: todo must include every selected tag.
   - If tagIds is empty, tag filtering is inactive regardless of tagMode.
4. dueFrom and dueTo are inclusive boundaries.
5. If dueFrom > dueTo, return validation error.
6. hasDueDate yes/no applies before dueFrom/dueTo checks.

## Singapore Timezone Handling

Date filtering and due-date grouping must use Singapore timezone utilities.

Requirements:

1. Use timezone helpers from lib/timezone.ts for boundary calculations.
2. Do not compare date-only strings using local browser timezone assumptions.
3. Interpret dueFrom and dueTo in Singapore context.
4. Serialize date query params in ISO format expected by APIs.
5. Accepted date input formats are RFC3339 datetime or date-only YYYY-MM-DD.
6. Date-only normalization in Singapore context:
   - dueFrom date-only maps to 00:00:00.000 Asia/Singapore.
   - dueTo date-only maps to 23:59:59.999 Asia/Singapore.

## API Contracts

All endpoints require authentication and user scoping.

Error contract for all non-2xx responses:

- { error: string, details?: Record<string, string> }

### GET /api/todos/search

Purpose:

- Return todos for authenticated user using search + filter criteria.

Query parameters:

- q: optional text query
- status: optional enum
- priority: optional enum
- tagIds: optional comma-separated IDs
- tagMode: optional enum any|all, default any
- dueFrom: optional ISO datetime
- dueTo: optional ISO datetime
- hasDueDate: optional enum all|yes|no, default all
- sortBy: optional enum, default updatedAt
- sortDir: optional enum asc|desc, default desc
- page: optional integer >= 1
- limit: optional integer 1..200, default 50

Validation behavior:

- 400 for malformed query params.
- 400 when dueFrom > dueTo.
- 404 when any tagIds include missing/unowned tags.
- 400 when q length exceeds 256 characters.
- 400 when q token count exceeds 10.

Success behavior:

- 200 with paginated todos.

Required response shape:

- {
  success: true,
  data: Todo[],
  meta: {
  total: number,
  page: number,
  limit: number
  }
  }

### GET /api/todos (Compatibility Path)

If project keeps a single list endpoint, the same query contract above must be supported on GET /api/todos.

Sort determinism:

- Primary sort uses requested sortBy and sortDir.
- Required tie-break order: updatedAt desc, then id asc.

## Client-Side Performance

Performance targets:

1. Typing interaction remains smooth at 60 fps on the reference profile.
2. Debounced search execution within 150 to 250 ms after input pause.
3. Perceived filter update time below 100 ms on the reference profile.
4. No UI blocking on query parsing or filtering operations.

Reference performance profile:

- Dataset: 5,000 todos, 200 tags, average 2 tags per todo.
- Client: Chromium-class desktop browser on standard laptop hardware.
- Network for server-backed search: 100 ms RTT baseline.
- Target measurement should include p50 and p95 for core interactions.

Implementation requirements:

1. Debounce text input updates before expensive computations/network requests.
2. Memoize derived filtered/sorted lists.
3. Avoid unnecessary re-renders through stable references and keyed rendering.
4. Use incremental rendering or virtualization for very large lists.
5. Cancel stale in-flight requests when a newer query starts.
6. Apply latest-response-only policy via request tokens/versioning.

Data strategy:

- Prefer local filtering when dataset is reasonably small and already loaded.
- Prefer server-side filtering for larger datasets or paginated views.
- Hybrid mode must keep visible results deterministic.
- In hybrid mode, server response is authoritative when request completes; keep prior results visible until replacement is ready.

## UI Components

### Search Bar

- Single text input with clear action.
- Debounced real-time search.
- Keyboard accessible and screen-reader labeled.

### Filter Panel

- Controls for status, priority, tags, due date range, and hasDueDate.
- Clear all and per-filter reset.
- Compact and expanded layouts for mobile/desktop.

### Active Filter Chips

- Visual chips showing currently active filters.
- One-click removal of individual filters.
- Count of active criteria.

### Result List and Empty States

- Sorted todo list reflecting active criteria.
- Contextual empty states:
  - no todos available
  - no results for current filters
- Optional matched-term highlighting for title and tags.

## Validation and Error Handling

## Input Validation Strategy

Use schema validation for query params and client-side filter state.

Requirements:

1. Normalize q by trimming and collapsing repeated spaces.
2. Parse tagIds into numeric/identifier array and deduplicate.
3. Validate enums strictly.
4. Validate date range coherence.
5. Return deterministic field-level errors for invalid requests.
6. Enforce q max length of 256 and maximum token count of 10.

## Error Handling Rules

1. 401 for unauthenticated access.
2. 404 for missing/unowned tag references in filters.
3. 400 for malformed filter/query payloads.
4. 500 for unexpected failures with generic message.
5. Preserve previous valid results in UI when transient request fails.

## Optimistic and Responsive UX Behavior

Search/filter interactions are usually read operations, but UX must still feel immediate.

Requirements:

1. Input and control states update instantly.
2. Show lightweight loading indicators for in-flight queries.
3. Do not clear existing results until replacement results are ready.
4. Ignore stale server responses that do not match latest request token.
5. Keep filter controls interactive during loading.

## Edge Cases

1. Empty query with multiple active filters.
2. Query containing only whitespace.
3. Very long query string.
4. Unknown tag IDs in filter query.
5. dueFrom later than dueTo.
6. tagMode all with empty tagIds must behave as no tag filter.
7. Rapid typing causing overlapping requests.
8. Switching filters during pending request.
9. No matches found with strict criteria.
10. Large dataset with many tags and frequent input changes.

## Acceptance Criteria

1. Search updates results in real time with debounce.
2. Search matches both title and tag names.
3. Multi-criteria filters compose deterministically.
4. Tag filter supports any and all modes correctly.
5. Date range filters use Singapore timezone boundaries.
6. Invalid query combinations return clear validation errors.
7. Unknown/unowned tag filters return 404 generic resource error.
8. Client ignores stale responses and shows latest query result.
9. Performance targets are met for expected data sizes.
10. URL query params can restore equivalent search/filter state.
11. Search success response uses the required response shape.
12. Sorting is stable with defined tie-breakers.

## Testing Requirements

## Unit Tests

1. Query normalization helpers:
   - trim/collapse spacing
   - token split behavior
2. Search matching logic:
   - case-insensitive title match
   - case-insensitive tag match
   - multi-token AND semantics
3. Filter composition logic:
   - status + priority + tags intersection
   - dueFrom/dueTo inclusive boundaries
   - hasDueDate behavior
4. Sorting logic:
   - each sortBy field and direction
   - stable tie-breaking
5. Request orchestration:
   - debounce timing behavior
   - stale response suppression

## Integration Tests (API)

1. GET search endpoint returns only authenticated user data.
2. q filters title and tags correctly.
3. tagMode any and all return expected sets.
4. status and priority filters compose correctly.
5. dueFrom and dueTo apply inclusive boundaries in Singapore context.
6. Invalid enums/date ranges return 400 with details.
7. Unknown/unowned tagIds return 404.
8. Sorting and pagination metadata are correct.
9. Empty tagIds with any or all mode behaves as no tag filter.
10. Oversized q or excessive token count returns 400 with field-level details.

## E2E Tests (Playwright)

1. Typing in search updates visible results without full reload.
2. Search by tag name and title returns expected todos.
3. Apply several filters together and verify intersection output.
4. Toggle tagMode any/all and validate result changes.
5. Refresh page and verify URL-restored filter state.
6. Simulate slow network and verify stale response is ignored.

## Out of Scope

1. Full-text ranking/scoring algorithms.
2. Fuzzy typo-tolerant matching with edit distance.
3. Semantic search embeddings.
4. Saved named filter presets.

These can be addressed in future PRPs.

## Success Metrics

1. Median search-to-render latency under 150 ms for target dataset size.
2. Filter interaction latency perceived as instant for common workflows.
3. Zero cross-user data leakage in filtered responses.
4. Error rate for malformed queries handled without crashes.
5. Stale response overwrite incidents reduced to zero.

## Implementation Checklist

1. Define and validate unified query schema for search and filters.
2. Implement search endpoint or extend GET /api/todos with equivalent contract.
3. Implement title + tag matching with deterministic token semantics.
4. Implement multi-criteria composition and Singapore-safe date filters.
5. Add client debounce, stale-request cancellation, and latest-response policy.
6. Add memoization/virtualization paths for client-side performance.
7. Add unit, integration, and E2E tests mapped to acceptance criteria.

## References

- Project-wide instructions: .github/copilot-instructions.md
- Feature dependency reference: PRPs/README.md
- Tag behavior reference: PRPs/06-tag-system.md
- User behavior reference: USER_GUIDE.md
