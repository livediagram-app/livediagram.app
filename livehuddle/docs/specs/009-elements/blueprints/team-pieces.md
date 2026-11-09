# Team pieces: blueprint

Derived from [Team pieces](../team-pieces.md). Implementation detail only; the spec decides.

## Domain and naming

| Term (spec)      | Identifier                             | Where                                                |
| ---------------- | -------------------------------------- | ---------------------------------------------------- |
| Calendar Wall    | shape kind `calendar-wall`             | `packages/document/src/office-team.ts`               |
| Suggestion Box   | shape kind `suggestion-box`            | same                                                 |
| Signpost         | shape kind `signpost`                  | same                                                 |
| Team Photo Wall  | shape kind `photo-wall`                | same                                                 |
| A note's day     | `NoticeNote.day` (`YYYY-MM-DD`)        | `office-social.ts` (`isNoteDay`, `noteDay`)          |
| Note pieces      | `NOTE_PIECE_KINDS`, `holdsNotes(kind)` | `office-social.ts`                                   |
| A suggestion     | `Suggestion { id, text, day }`         | `packages/api-schema/src/suggestions.ts`             |
| The store        | table `suggestions`                    | `apps/api/src/document-room/document-schema.ts` (V5) |
| Signpost places  | `signpostPlaces(post, places)`         | `apps/editor/lib/wayfinding.ts`                      |
| Photo wall faces | `photoWallFaces(people)`               | `apps/editor/lib/photo-wall.ts`                      |

## Behaviour and state

### Calendar Wall

- The face (`TeamFaces.tsx` `CalendarWallFace`) reads `useMinuteNow()` and draws `calendarMonth(year, month)` from
  `lib/calendar-month.ts`: 6 rows of 7 cells, Monday first, each cell `{ day: 'YYYY-MM-DD', inMonth, isToday }`.
  Notes are bucketed by `noteDay(note)` (its `day`, else the viewer's local day of `at`), once per render, in a `Map`.
- The popover and the reader share `CalendarNotes` (`CalendarWallPopover.tsx`): state `{ cursor: { year, month },
selected: 'YYYY-MM-DD' }`, starting on today. ‹ and › step `cursor` a month (`stepMonth`, held to
  `NOTE_DAY_YEAR_MIN` January to `NOTE_DAY_YEAR_MAX` December; `canStepMonth` disables the arrow at either end);
  Today resets both. A day button sets `selected` (and the cursor to its month when it was a spill-over day); a
  spill-over day `isNoteDay` refuses (December 1999, January 2101) is an empty grid cell, never a button.
- Pin: `{ kind: 'notice-pin', note: { ...NoticeNote, day: selected } }` through `editor.applyElementDelta`; unpin:
  `{ kind: 'notice-unpin', noteId, by }`. Who may pin and unpin is the Notice Board's rule exactly (`mayPin`,
  `mayUnpin`), factored into `components/canvas/collab/useNoteSigner.ts` so both pieces read one copy.
- `applyElementDelta` (`element-deltas.ts`): `openNoticeBoard` becomes `openNotePiece`, true for every
  `holdsNotes(el.shape)` kind. `participant-content.ts` merges `noticeNotes` for every `holdsNotes` kind.
  The room's signer rule and the ledger already key on the delta kind, not the shape.

### Suggestion Box

- Face (`SuggestionBoxFace`): a **Suggest** pill (`data-piece-main`) opening `SuggestionBoxPopover` (select mode) or
  `SuggestionBoxReader` (walking); both render `SuggestionBoxPanel`.
- The panel's state machine: `mode` from the session: `offline` (a This Browser Space: `isOfflineIdSync`, or no
  `imageContext`), `viewer` (`can.level === 'view'`), `participant`, `editor`. `editor` loads on open
  (`apiListSuggestions`), status `loading | ready | failed`, and again on **Refresh**. Drop: status `idle | sending |
sent | failed`, the text cleared on `sent`.

### Signpost

- `signpostPlaces(post, places, max = SIGNPOST_BOARDS)`: `tabPlaces` of the active tab, sorted by squared distance
  from the post's foot (`x + width / 2`, `y + height`) to each place's `arrival`, ties by place id, first `max`, each
  with `dir: 'left' | 'right'` (`arrival.x < foot.x` is left).
- `SignpostFace` (`components/canvas/wayfinding/SignpostFace.tsx`) reads the wayfinding store's `tabs` and `activeTabId`, memoised on
  the active tab's elements and the post's box. Each board is a button (`pieceControlProps`) whose click calls
  `wayfinding.actions.walkThere(place)`. The top board carries `data-piece-main`, so a walking click on the post
  walks to it.

### Team Photo Wall

- `PhotoWallFace` (`components/canvas/wayfinding/PhotoWallFace.tsx`) reads the wayfinding store's `people` (already the Directory's
  order, self first) and maps it through `photoWallFaces(people, PHOTO_FRAMES)`: `{ shown, overflow }`, `shown` at
  most `PHOTO_FRAMES` (8), or 7 plus an overflow of the rest when there are more than 8.
- `WayPerson` gains an optional `config` (the character's look): the self's from `avatarLook.config`, a walking
  peer's from its presence (`parseAvatarConfig`), none for someone on the tab bar only. `peopleKey` includes the look,
  so a look change re-renders the wall and nothing else.

## Interfaces and contracts

- `isNoticeNote` accepts `day` when it is a real calendar date `YYYY-MM-DD` (`isNoteDay`: four-digit year
  `NOTE_DAY_YEAR_MIN` 2000 to `NOTE_DAY_YEAR_MAX` 2100, month 1 to 12, day within the month); anything else refuses the note (its delta lands nowhere, its tab
  fails validation).
- `POST …/suggestions` body `{ elementId: string, text: string }`: `text` trimmed, 1 to `SUGGESTION_TEXT_MAX` (500)
  characters else 400 `missing text` / `text too long`; `elementId` missing 400. The box must be an element of the
  tab with `shape: 'suggestion-box'`, else 404; 200 notes 409 `box_full`. 201 `{}`.
- `GET …/suggestions?elementId=`: 400 without `elementId`; 200 `SuggestionsResponse { suggestions: Suggestion[] }`.
- `DELETE …/suggestions/:suggestionId`: 204, 404.
- Editor client: `lib/api/suggestions.ts` `apiDropSuggestion`, `apiListSuggestions`, `apiRemoveSuggestion`, each
  `(ownerId, documentId, tabId, …, shareCode)`.

## Data and persistence

- `noticeNotes[].day`: optional, persistent, part of the element (validated by `validate-shape.ts`'s `noticeNotes`
  rule). Old notes have none and read on their pin day. No migration.
- `suggestions` (schema step V5, created on first use with the rest):
  `id TEXT PRIMARY KEY, document_id TEXT NOT NULL, tab_id TEXT NOT NULL, element_id TEXT NOT NULL, text TEXT NOT
NULL, day TEXT NOT NULL`, index `(document_id, tab_id, element_id)`. Listed `ORDER BY rowid DESC`. Deleting a tab
  (`deleteTabRow`) deletes its rows. Never copied, exported or pushed to the index.
- Signpost and Photo Wall: no fields.

## Errors and edge cases

- A day button for a spill-over day (last or next month) selects that day and moves the cursor to its month.
- A pin while full: the button disables and the panel says so (the Notice Board's copy, with "calendar").
- Suggestion drop failures: 409 `box_full` shows its sentence; anything else **Couldn't drop it.
  Try again.**, the text kept.
- An Editor's list failing shows **Couldn't load the notes.** with **Try Again**.
- A signpost on a tab with no places: no boards, the empty tooltip. A place deleted while its board shows: the board
  goes on the next render (the tab changed).
- A photo wall with nobody (an export or preview: no wayfinding store): every frame empty.

## Security and trust

- Anonymity: the suggestion row has no column that could hold a caller; `console.info('[suggestions] dropped', {
documentId, tabId })` logs neither the caller nor the text; the drop is not relayed to the room or pushed to the
  index or the audit log. `day` is UTC so the stored day does not betray a writer's time zone.
- Reading is `gateEdit`, the same gate as writing the tab: a Participant or a Viewer is refused 403 and its editor
  never calls the GET. Dropping is `gateParticipate` (a Viewer 403). A tab-scoped link reaches its own tab only.
- Abuse: the per-owner write rate limit (API "Rate limits") meters drops; a box holds at most 200, so a flood fills
  one box, which an Editor empties.
- Calendar notes keep the Notice Board's rules: signed with the room-verified adder key, a Participant unpins only
  its own.

## Performance and limits

- Calendar face: 42 cells, one `Map` of at most 50 notes, recomputed when the notes or the minute change. Measured in
  `calendar-month.test.ts`: `calendarMonth` under a 1 ms CPU budget for 1,200 months.
- Signpost: `tabPlaces` is linear in the tab's elements (as the Directory's list), run only when the tab changes.
- Photo wall: at most 8 sprites, re-rendered on a `peopleKey` change only (never on a step).
- Suggestion list: at most 200 rows of 500 characters (~100 KB) read only when an Editor opens the box.

## Presentation and UX

- Copy is the spec's. Buttons Title Case: **Calendar**, **Pin to 5 Nov**, **Today**, **Suggest**, **Drop It In**,
  **Refresh**, **Remove**, **Try Again**. Empty states: **No Notes Yet** (calendar day and box), the signpost's tooltip,
  the photo wall's silhouettes.
- Faces lay over the drawn rectangle (`Overlay`), in the art's grid, so they scale with the piece.

## Accessibility

- Every control is a `button` with a name: day cells `aria-label="5 November, 2 notes"` and `aria-pressed` for the
  selected day; boards `aria-label="Walk to Kitchen"`; the photo wall is `role="img"` with the people's names.
- Popovers and readers trap focus and close on Escape (AnchoredPopover, ReaderShell).
- No motion on these pieces.

## Observability

- `[suggestions] dropped|listed|removed|refused` with `documentId`, `tabId` and, for a refusal, its code
  (`logRefusal`). Never the caller, never the text.

## Testing

| Rule                                               | Test                                                            |
| -------------------------------------------------- | --------------------------------------------------------------- |
| A note's day is validated                          | `packages/document/src/office-team.test.ts`                     |
| Calendar pins and unpins as a board's              | `packages/document/src/notice-note-deltas.test.ts`              |
| A Participant's calendar notes merge as a board's  | `packages/document/src/participant-content.test.ts`             |
| Kinds registered, walk classes                     | `office.test.ts`, `shape-kind.test.ts`, `packages/avatar` tests |
| Suggestion routes: roles, anonymity, caps, cleanup | `apps/api/src/routes/suggestion-routes.test.ts`                 |
| Month grid                                         | `apps/editor/lib/calendar-month.test.ts`                        |
| Signpost places                                    | `apps/editor/lib/wayfinding.test.ts`                            |
| Photo wall frames                                  | `apps/editor/lib/photo-wall.test.ts`                            |
| Faces and panels per role                          | `apps/editor/components/canvas/collab/team-faces.test.tsx`      |

## Constants and configuration

| Constant              | Value | Why                                                     |
| --------------------- | ----- | ------------------------------------------------------- |
| `SUGGESTION_TEXT_MAX` | 500   | Longer than a note (280): an idea needs a few sentences |
| `SUGGESTIONS_MAX`     | 200   | A quarter's ideas for a team; bounds a flood            |
| `SIGNPOST_BOARDS`     | 3     | What reads on a post at 100%                            |
| `PHOTO_FRAMES`        | 8     | Two rows of four on the panel                           |
| `NOTES_MAX`           | 50    | The Notice Board's, shared                              |

## Assets and external resources

- Art is parts tables in `office-team.ts` (MIT, this repo), drawn by FurnitureView and svg-render-faces; palette
  glyphs in `palette-icons-team.tsx`. Portraits are `@liveworkspace/avatar`'s `AvatarSprite`.

## Defaults ledger

- Weeks start Monday (ISO 8601) whatever the locale, so every screen's grid lines up.
- The suggestion's day is UTC.
- The signpost measures from the post's foot.
