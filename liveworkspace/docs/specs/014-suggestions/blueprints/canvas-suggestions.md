# Canvas suggestions blueprint

Implements [canvas-suggestions.md](../canvas-suggestions.md). Shared code in `packages/suggestions`
(`@liveworkspace/suggestions`); each product keeps thin doors (its route, its accept writer, its schema step, its
room gate, its editor wiring).

## Domain and naming

- `CanvasSuggestion<E>` `{ id, tabId, author, createdAt, ops, base, conflict? }`, generic over a product's element
  union. `id` is `sg_` and 10 base32 characters. `author` is `{ key, name, color }`: the caller's collab key
  (`collabKeyFor(person)`, `@liveworkspace/api-kit/collab-key`), its participant name and colour.
- `SuggestionOp<E>`: `{ kind: 'add', element, at }`, `{ kind: 'update', element }` (whole), `{ kind: 'remove', id }`.
  No reorder. Each element targeted at most once.
- `base`: target id to the product's `elementFingerprint` (canonical JSON without `LIVE_ELEMENT_FIELDS`), null for an
  add.
- UI words: Suggestion, Suggesting, Editing, Accept, Reject, Accept All, Reject All, Take Back, Changed since.

## Files

| File (`packages/suggestions/src/`) | Holds                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `suggestion.ts`                    | types, limits, `mintSuggestionId`, `parseSuggestionOps`, `parseStoredSuggestion`, `parseDecision`     |
| `plan.ts`                          | `baseOf`, `opsMismatch`, `staleTargets`, `planAccept`, `ghostsOf`, `describeSuggestion`, `suggestionOpsBetween` |
| `store.ts`                         | `CANVAS_SUGGESTIONS_SCHEMA`, `suggestionStore(db)` over the room's D1-shaped `DOCUMENT_DB`           |
| `route.ts`                         | `answerSuggestions(action, body, door)`: the role rule, submit, accept, reject                       |
| `review.ts`                        | Suggest Only settings (moved from `@livedocuments/api-schema`, which re-exports it)                  |
| `room-review.ts`                   | `createRoomReview`: cached settings, `suggestByOf`, `joined`, `changed`                               |
| `room-signal.ts`                   | the editor's bus for the room's `suggestions` and `review` system ops                                |
| `client.ts`                        | `suggestionsClient(request)`: list, submit, accept, reject                                           |
| `capture.ts`                       | `createSuggestCapture`: wraps the editor's history commit and tick; gathers a gesture                |
| `react/useSuggestCapture.ts`       | the capture made once per editor, pointer tracking, the bridge                                       |
| `react/useCanvasSuggestions.ts`    | mode, list, refetch on the room's word, submit, accept, reject, notices, telemetry                   |
| `react/suggestions-store.ts`       | the overlay's external store and context                                                             |
| `react/SuggestionGhostOverlay.tsx` | the ghosts, in canvas space                                                                          |
| `react/SuggestionsBar.tsx`         | the bar, the mode switch, the review list                                                            |
| `react/SuggestOnlySection.tsx`     | the Share dialog's Suggestions section                                                               |

Per product (`<api>` is each product's `apps/api/src`):

| Where                                        | What                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `<api>/<room>/…-schema.ts`                   | a step running `CANVAS_SUGGESTIONS_SCHEMA`; a `review` column on the item row (but livedocuments, which has it) |
| `<api>/routes/suggestion-routes.ts`          | the four routes: gates, author, the door                                               |
| `<api>/changesets/accept.ts`                 | `acceptSuggestions`: one changeset through `writeChangeset`, retried like `revert.ts`  |
| `<api>/routes/review-route.ts`               | `GET`/`PUT …/review` (livedocuments' already)                                          |
| `<api>/<room>/…-room-review.ts`              | the room's `createRoomReview`                                                          |
| room message gate                            | refuses a Suggest Only Participant's element ops unless live-only                      |
| editor `useEditorUndoState.ts`               | commit and tick through `capture.wrap`                                                 |
| editor `editor-state/useEditorSuggestions.ts`| the slice composing `useCanvasSuggestions`                                             |
| editor canvas layer and view                 | `SuggestionGhostOverlay` and `SuggestionsBar` mounted; the store provided              |
| editor room-op receive                       | `takeSuggestionsRoomOp` first                                                          |

## Interfaces and contracts

`<items>` is `documents` (livediagram, livedocuments), `designs` (livedesign), `projects` (liveplanner).

| Route                                                      | Who                                   | Answer                                                       |
| ---------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| `GET /api/<items>/:id/tabs/:tabId/suggestions`             | Participant, Editor                   | 200 `{ suggestions }`                                        |
| `POST /api/<items>/:id/tabs/:tabId/suggestions`            | Participant, Editor; body `{ ops }`   | 201 `{ suggestion }`                                         |
| `POST /api/<items>/:id/tabs/:tabId/suggestions/accept`     | Editor; `{ ids }` or `{ all: true }`  | 200 `{ accepted, conflicts, changeset }`; 409 `suggestion_conflict` with `conflicts` when none applied |
| `POST /api/<items>/:id/tabs/:tabId/suggestions/reject`     | Editor; a Participant its own         | 200 `{ rejected }`                                           |
| `GET`/`PUT /api/<items>/:id/review`                        | Editor                                | `{ review }` (livedocuments' contract)                       |

Refusals: 403 `viewer_cannot_suggest`, 403 `editor_only`, 403 `no_collab_key`, 400 `no_ops` `too_many_ops` `bad_op`
`bad_element` `repeated_target` `invalid_decision`, 404 `not_found`, 409 `missing_target` `id_taken`
`too_many_suggestions`, 413 `too_large`, 422 `invalid_change`. A tab a scoped grant can't reach answers as the
product's other tab routes do.

Room system ops (never relayed, never sequenced): `{ kind: 'suggestions', tabId }` to every Participant and Editor
socket after any write to a tab's suggestions (no content); `{ kind: 'review', suggestOnly }` to one Participant's
socket on join and on every change.

## Behaviour and state

- **Submit**: parse the ops with the product's element validator; read the tab; `opsMismatch`; the tab after the ops
  must pass the product's `isValidTab`; at most `SUGGESTIONS_MAX_PER_TAB` waiting; record `baseOf`; store; signal.
- **Accept**: `writeAccepted(decide)` reads the stored tab and calls `decide` on every attempt (a lost race re-reads):
  `planAccept` orders by `createdAt` then id, skips stale ones, applies the rest with the product's
  `applyElementOps`. Nothing applied writes nothing. After the write, accepted rows go, conflicted rows are stored again
  with `conflict`. One changeset, `author` the Editor, no token.
- **Capture**: `capture.wrap(apply)` replaces the history's commit and tick. Not suggesting: `apply`. Suggesting: run
  the map over the tabs as they show with the gathered draft, refuse a change to another tab, the tab set or the tab's
  own fields; pass a live-only change to `apply`; else hold `{ before, after }` and send `suggestionOpsBetween` after
  `SUGGEST_GATHER_MS` of quiet with no pointer held. Turning Suggesting off sends what was gathered.
- **Suggest Only in the editor**: the room's `review` op sets `roomSuggestOnly`; a Participant on it gets an Editor's
  gesture capabilities with capture forced on (the server still holds it to Participant).

## Errors and edge cases

- A tab deleted while suggestions wait: its rows stay unreached; a list of a missing tab answers its suggestions (none
  are shown, the tab is gone).
- An element id a suggestion adds, taken by the time it is accepted: conflict.
- Two Editors accepting at once: the changeset write's revision check makes one lose the race, which re-reads and finds
  the other's accepted rows gone or its own now stale.
- A submit while the room is down: the editor keeps nothing and says **Your suggestion could not be sent. Try again.**

## Security and trust

- The author is the server's: collab key from the grant's person, name and colour from the participant row. Nothing in
  a body names an author.
- Every element is checked by the product's validator on submit; the tab after the ops must be valid.
- A Viewer's socket is never told a suggestion exists; a Viewer's request is refused before anything is read.
- Suggest Only is enforced by the room on every element op of the session, not by the editor.

## Performance and limits

- Nothing on first load: the bar renders nothing without suggestions for a Participant; the list is one indexed query
  (`tab_id, created_at`, LIMIT 100) when a tab opens and when the room says it changed.
- The overlay reads an external store: a suggestion arriving re-renders the overlay alone. `ghostsOf` is linear in
  elements plus ops.
- The capture adds one function call per commit while not suggesting.
- Limits: `SUGGESTION_MAX_OPS` 200, `SUGGESTIONS_MAX_PER_TAB` 100, `SUGGESTION_MAX_BYTES` 192 KiB, removes chunked by
  50 bound parameters.

## Accessibility

- The ghosts are `aria-hidden`; the review list names every suggestion in words. The mode switch is a pressed-state
  button group; the count button has `aria-expanded` and `aria-controls`; Escape closes the list and returns focus.
- Accept and Reject are named buttons with tooltips; a conflicted Accept is disabled.

## Observability

- `[suggestion] made`, `[suggestion] accepted` (counts), `[suggestion] rejected`; `[review] refused` when the room
  refuses a Suggest Only element op.

## Testing

- `packages/suggestions`: every module at 100% (the parsers, the plan, the store, the route's role rules, the room
  review, the capture, the client).
- Each product: the route's roles (Viewer refused, Participant can't accept, Editor accepts as one changeset, a stale
  suggestion flagged), the room refusing a Suggest Only element op, the schema step.

## Constants and configuration

`SUGGESTION_MAX_OPS` 200, `SUGGESTIONS_MAX_PER_TAB` 100, `SUGGESTION_MAX_BYTES` 196608, `SUGGESTION_MAX_NAME` 80,
`SUGGESTION_MAX_KEY` 64, `SUGGEST_GATHER_MS` 500, `SUGGEST_ONLY_MAX_LINKS` 100, `SUGGEST_ONLY_MAX_PEOPLE` 200.

## Assets and external resources

None.

## Presentation and UX

- **Bar**: a white pill (`rounded-full`, border, shadow) centred at the canvas's top edge, below the title bar. Editor:
  `SegmentedToggle` Editing / Suggesting, a divider, the count button. Suggest Only: a brand-tinted **Suggesting** chip
  with a pencil, then the count. The count shows a brand badge with the number.
- **Review list**: a 22rem card under the bar; header with the count in words and Reject All / Accept All; rows with the
  author's dot, name and time, the description, the flag, and round Reject (x) and Accept (check) buttons.
- **Ghosts**: 2px dashed border in the author's colour, 12% tint (18% for your own gathering one), 3px outset, 6px
  radius; removals a solid border and a 135° hatch at 40%; the chip a white pill above the top-left corner.
- **Directions considered**: (1) drawing each suggestion's real elements translucent over the canvas (most faithful,
  but needs each product's element renderer inside the overlay and doubles the canvas's render cost); (2) a side panel
  listing suggestions (heavier, competes with the Properties panel); (3) the chosen bounds ghosts with a floating bar:
  the same in every product, cheap, and readable at any zoom.

## Defaults ledger

SG1 to SG5 in [DEFAULTS.md](DEFAULTS.md).
