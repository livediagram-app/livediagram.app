# Share roles: blueprint

Derived from [Share roles](../share-roles.md), with the room of
[Realtime conflict resolution](../../012-collaboration/realtime-conflict-resolution.md) and
[Collab race hardening](../../012-collaboration/collab-race-hardening.md), the room's queued tab write,
the pass and pill of [Editor app](../../007-editor/editor-app.md#share-dialog), [Embeds](../embeds.md), and the share
types of [Telemetry](../../017-telemetry/telemetry.md). The code sites it answers are catalogued in
`docs/research/access-levels/current-abilities.md`. The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `SRn`.

The spec's [Later](../share-roles.md#later) items (token levels, ownership powers, collaboration keys pinned per
socket) are not derived here.

## Scope, by file

| File                                                                                                                                    | Role                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/access-levels.ts` (new)                                                                                        | `ACCESS_LEVELS`, `AccessLevel`, the ladder, `parseStoredLevel`, `LEVEL_TELEMETRY_TYPE`                                                      |
| `packages/api-schema/src/index.ts`                                                                                                      | `ShareRole` becomes an alias of `AccessLevel`                                                                                               |
| `packages/api-schema/src/room-messages.ts`                                                                                              | `isPresenceOpKind`, `isSystemOpKind`: the op classes the gate reads; the `article` frame's `grow`                                           |
| `packages/document/src/participant-content.ts` (new)                                                                                    | The participant content rule: `applyParticipantOp`, `PARTICIPANT_TEXT_FIELDS`, `participantTabChange`                                       |
| `packages/document/src/participant-article.ts` (new)                                                                                    | The participant writing rule: `applyParticipantArticleOps`, `participantArticlesChange`                                                     |
| `apps/api/migrations/0001_livedocuments_baseline.sql` (new)                                                                             | A `level` column on `share_links` and `shared_with`                                                                                         |
| `apps/api/src/share-link-row.ts`, `db/ws-tickets.ts`, `db/shared.ts`                                                                    | Readers through `parseStoredLevel`                                                                                                          |
| `apps/api/src/auth/document-access.ts`                                                                                                  | Gates compare levels; `canParticipateDocument`                                                                                              |
| `apps/api/src/routes/context.ts`                                                                                                        | `gateParticipate` is the Participant check                                                                                                  |
| `apps/api/src/routes/document-share-routes.ts`                                                                                          | `POST /share` takes three levels                                                                                                            |
| `apps/api/src/routes/document-room-routes.ts`                                                                                           | The ticket and the upgrade carry the effective level                                                                                        |
| `apps/api/src/document-room/document-room.ts`, `room-op-gate.ts`, `room-participant.ts`                                                               | Level on the session; op gate by class; a Participant's `el` ops and `article` frames through the tab write queue (`RoomParticipantWrites`) |
| `apps/api/src/participant-write.ts` (new)                                                                                               | `writeParticipantOp`, `writeParticipantArticle`: compare-and-swap writes of the rules' output                                               |
| `apps/api/src/db/image-grants.ts`                                                                                                       | Image grants from edit collaborators only                                                                                                   |
| `packages/agent-verbs/src/mcp/*`                                                                                                        | `share_document.role` takes three levels, default `participate`                                                                             |
| `apps/editor/lib/editor-capabilities.ts` (new)                                                                                          | `resolveEditorCapabilities`, `EditorCapabilities`                                                                                           |
| `apps/editor/app/document/[id]/*` (`useViewPreview`, `useEditorState`, `useParticipantSession`, `tab-save-flow`, `editor-page-helpers`) | `sessionRole: AccessLevel`; `can`; the participant save flow                                                                                |
| `apps/editor/hooks/editor/useArticles.ts`                                                                                               | `canWrite` (a Participant's writing) beside `canEdit`; `reshape` for an Editor                                                              |
| `apps/editor/components/dialogs/ShareComposer.tsx`, `share-dialog-parts.tsx`                                                            | Three cards                                                                                                                                 |
| `apps/editor/components/chrome/RoleIndicator.tsx`, `app/document/[id]/useRoleIndicator.ts`                                              | Participating pill                                                                                                                          |
| `apps/editor/lib/collaborator-roster.ts`, `app/explorer/views.tsx`                                                                      | Participant badge; Participate chip                                                                                                         |

## Domain and naming

| Term                | Identifier                                                                        | Meaning                                                                      |
| ------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Access level        | `AccessLevel`, `ACCESS_LEVELS` (ascending); wire and column field `role` (SR1)    | What a link or embed admits                                                  |
| Viewer              | `'view'`; card **Viewer**, stub `VIEWER`, pill **Viewing**                        | Looks only; writes nothing                                                   |
| Participant         | `'participate'`; card **Participant**, stub `PARTICIPANT`, pill **Participating** | Edits text and comments                                                      |
| Editor              | `'edit'`; card **Editor**, stub `EDITOR`, pill **Editing**                        | Changes anything                                                             |
| Participant content | `applyParticipantOp`                                                              | The rule a Participant's element change is applied under: text fields only   |
| Participant writing | `applyParticipantArticleOps`                                                      | The rule a Participant's article frame is applied under: writing blocks only |
| Text fields         | `PARTICIPANT_TEXT_FIELDS`, `participantTextFields(type)`                          | The fields a Participant may change, per element kind (an allow-list)        |
| Writing blocks      | `WRITING_BLOCKS` (`paragraph`, `list`, `code`)                                    | The article blocks a Participant may put, change or remove                   |
| Capabilities        | `EditorCapabilities` (`can`)                                                      | The editor's per-level flags; render only, never the rule                    |

Banned: "Collaborator" for the level (it was the working name; "collaborator" stays the roster's word for anyone
present), "commenter", "permission", "createdBy", "adder" (a Participant adds nothing, so nothing records who added
an element).

## Behaviour and state

The ladder is **view < participate < edit**. `levelAtLeast(level, min)` compares ranks. `parseStoredLevel(x)` is `x`
when it is one of the three, else `view`.

Doors by level (server):

| Door                                                                                                        | Needs                             |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Reads (document, tabs, images, comment threads, the Timeline); share resolve; make a copy                   | view                              |
| Room: presence (cursor, select, laser, follow, focus); never `reaction`                                     | view                              |
| Comments: add, reply, resolve, reopen, delete own                                                           | participate (`deniedParticipate`) |
| Room: `reaction`                                                                                            | participate                       |
| Room: `el` `update` through the participant content rule                                                    | participate                       |
| Room: `article` (writing in an article already on the tab) through the participant writing rule             | participate                       |
| Tab PUT, tab DELETE, document PUT; room `tab`, `tab-meta`, `document-meta`, `el` `add`, `remove`, `reorder` | edit                              |
| Room: `el-delta` `check`, `comment-*`; `drag-preview`                                                       | edit                              |

An Editor's `el` op and `article` frame are relayed as today. `gateClientOp` (`room-op-gate.ts`) answers one of
`drop`, `relay`, `participant-content` or `participant-article`. A Participant's frames take the participant path:

1. **Gate.** The session's level is `participate` and the frame's tab passes the tab-scope check (a tab-scoped link
   drops frames for other tabs first). An `el` frame answers `participant-content`, an `article` frame
   `participant-article`; every other mutation from a Participant is dropped. Presence and reactions relay as for
   anyone who takes part.
2. **Queue.** `RoomParticipantWrites` (`room-participant.ts`) puts the write on the room's tab write queue
   (`tabWriteQueue`, SR2), so participant writes on a document run one at a time, at most `PARTICIPANT_PENDING_MAX`
   per socket waiting.
3. **Write.** `writeParticipantOp` (an element op) or `writeParticipantArticle` (an article's `flow` and its ops)
   reads the stored tab, runs the rule and compare-and-swaps the result (up to `TAB_CAS_MAX_ATTEMPTS`). An `article` frame that
   creates or removes an article is never writing and is ignored.
4. **Relay.** An `applied` write that changed the tab is sequenced from the sender to everyone but the sender, with a
   `cursor` frame to the sender, as an Editor's op is: an element update as the patch of the fields the rule took,
   an article frame as its writing ops with `grow: true`, so an Editor that is not the writer grows the pages the
   writing needs (`markArticleGrow`, the path an agent's writing takes;
   [Article pages](../../007-editor/article-pages.md#collaboration)).
   An `applied` write that changed nothing is not relayed. A `refused` element op sends the sender its `correction`
   alone (a `missing` element re-hydrates it instead); a `refused` article frame, and a failed write, send the sender
   `catchup { resync: true }`.

`applyParticipantOp(tab, op)` (pure), returning `{ result: 'applied', tab, op, changed } | { result: 'refused',
correction: ElementOp | null, reason }`:

| Op        | Applied when                                                                                    | Result                                                   | Refusal (correction)                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `add`     | never                                                                                           | n/a                                                      | `not-addable` (`remove` of the id, unless the id is taken)                                             |
| `update`  | The stored element exists, the tab is not locked, same type, not `locked`, its layer not locked | Stored, with its kind's text fields copied from incoming | `missing` (none), `tab-locked`, `type-changed`, `locked`, `invalid` (`update` with the stored element) |
| `remove`  | never                                                                                           | n/a                                                      | `missing` (none), `not-removable` (`add` of the stored element at its index)                           |
| `reorder` | never                                                                                           | n/a                                                      | `reorder` (`reorder` with the stored ids)                                                              |

Text fields by kind (`PARTICIPANT_TEXT_FIELDS`), an allow-list: a field or a kind not listed is refused, so a new
field is an Editor's until someone decides it is text.

| Element                                   | Fields                                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `shape`                                   | `label`, `richText`, `code`, `pageTitle`, `pageSubtitle`                                                       |
| `text`, `sticky`                          | `label`, `richText`                                                                                            |
| `table`                                   | `label`, `cells`: words only; same row count, every row the same length, every cell a string (`sameCellShape`) |
| `image`                                   | `label`, `alt`                                                                                                 |
| `freehand`, `link-card`, `video`, `arrow` | `label`                                                                                                        |
| `article-note`, any other                 | none                                                                                                           |
| `text` with `sizing` set                  | also `width` and `height` (positive): a text box that sizes to its words follows them (SR10)                   |

- An `update` whose merge equals the stored element is `applied` with `changed: false`: no write and no relay.
- The merge must pass `isValidElement`; one that does not is refused `invalid` with the stored element as correction.
- Every field that is not text (position, size, colours, style, `locked`, layer, the picture) stays as stored, so a
  move, resize, restyle, lock or image swap in an update is trimmed away.
- An applied update's `op` is an `ElementPatchOp` (`{ kind: 'patch', id, set, clear? }`) of the fields that changed
  between stored and merged, a room-only op (`RoomElementOp`, `applyRoomElementOp`) that peers apply over their live
  copy. It is never the stored element whole: the stored tab can be behind an Editor's unsaved change.

`applyParticipantArticleOps(tab, flow, ops)` (pure), returning `{ result: 'applied', tab, changed } | { result:
'refused', reason }`:

| Refusal       | When                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| `tab-locked`  | The tab is locked                                                                                              |
| `missing`     | No article `flow` on the tab (a Participant never adds one)                                                    |
| `locked`      | A page of the article is locked                                                                                |
| `not-writing` | An op is a `style` op, puts a block that is not writing, or puts or removes over a zone, divider or page break |

Each op is checked against the article as the ops before it left it; a remove of a block that is not there changes
nothing. Writing blocks are an allow-list (`paragraph`, `list`, `code`), so a new kind of block is an Editor's.

The ticket mint and the upgrade carry the effective level and the document id (`X-Verified-Role`,
`X-Verified-Document`, set on every path, empty when none); the room keeps both on the session attachment.
`RoomTicketResponse` is `{ ticket }`.

Editor state:

| Flag            | Value                                                                         |
| --------------- | ----------------------------------------------------------------------------- |
| `sessionRole`   | owner: `edit`; link: its level; embed: `edit` stays, anything else `view`     |
| `canEdit`       | `sessionRole === 'edit' && !viewPreview` (unchanged)                          |
| `isReadOnly`    | `!canEdit` (unchanged): every structural gate stays shut for a Participant    |
| `can`           | `resolveEditorCapabilities(level)`, in `useParticipantSession(level, notify)` |
| Pill level      | `viewPreview ? 'view' : sessionRole`                                          |
| `canToggleRole` | `sessionRole === 'edit'` (unchanged)                                          |

`EditorCapabilities` is `{ level, takePart, writeText(el), writeArticle }`:

| Flag            | edit | participate             | view  |
| --------------- | ---- | ----------------------- | ----- |
| `takePart`      | true | true                    | false |
| `writeText(el)` | true | true unless `el.locked` | false |
| `writeArticle`  | true | true                    | false |

A Participant's commit: `editsBlocked` is false for a Participant (its text gestures open through `can`), so every
commit passes `guardCommit`, which runs `participantTabChange(before, after)`: the change lands only when the rules
would take it unchanged (every element op through `applyParticipantOp` with nothing trimmed, the tab's other fields
untouched, and its articles changed only as `participantArticlesChange` admits); anything the room would refuse or
trim is held back.

A Participant's save: the autosave runs for a Participant, but takes the participant branch
(`relayParticipantChanges` in `tab-save-flow.ts`): its element ops (`participantElementOps`:
`diffToElementOps(before, after)` without `reorder`) as `el` frames, and its writing as `article` frames
(`tabArticleOps(before, tab)`; none for a tab first seen in this save), sent over the socket; no tab PUT, no tab
delete, no document metadata, no whole `tab`. The socket being closed fails the save, which the autosave retries as
today; the unload flush sends the same frames at once.

Hooks that write a tab's structure, or write without passing `commit`, take `structureBlocked`
(`editsBlocked || isReadOnly`) or `structureCreateBlocked` (`createBlocked || isReadOnly`), never the opened
`editsBlocked`: layers, element helpers, tab canvas, images, swatch overrides, the page panel and the cleanup
preview.
A held-back commit shows `HELD_BACK_NOTICE` at most once per `HELD_BACK_NOTICE_MS`.

Gestures opened for a Participant, each beside `isReadOnly`: inline text edit (`canWriteText`), with the
type-to-edit and Space-to-edit keys; writing in an article (`useArticles` `canWrite`, never `reshape`: no inserts,
slash menu, zones, style, margin notes, page toolbar or layout consequences); comments and reactions (`takePart`);
the Undo/Redo cluster (`takePart`), over its own writing. No palette strip, no add keys; Delete and Backspace do
nothing. A Participant's emptied hugging text box stays (empty) rather than being removed, and its label never
auto-renames the document, tab or layer.

Invariants:

- **I1** Every level gate compares through `levelAtLeast`; no gate reads `role === 'edit'` by itself.
- **I2** Every reader parses through `parseStoredLevel`: an unknown level reads as `view`.
- **I3** A Participant's change reaches D1 and peers only through `applyParticipantOp` or
  `applyParticipantArticleOps`.
- **I4** A Participant's write never adds or removes an element or an article, and never changes a field outside
  `PARTICIPANT_TEXT_FIELDS` or a block outside the writing blocks.
- **I5** The server enforces every level; `can` only decides what renders.

## Interfaces and contracts

`packages/api-schema/src/access-levels.ts`:

```ts
export const ACCESS_LEVELS = ['view', 'participate', 'edit'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];
export const DEFAULT_LINK_LEVEL: AccessLevel = 'edit';
export const DEFAULT_MCP_SHARE_LEVEL: AccessLevel = 'participate';
export function isAccessLevel(value: unknown): value is AccessLevel;
export function parseStoredLevel(value: unknown): AccessLevel; // unknown -> 'view'
export function levelAtLeast(level: AccessLevel, min: AccessLevel): boolean;
export const LEVEL_TELEMETRY_TYPE: Record<AccessLevel, 'View' | 'Participate' | 'Edit'>;
```

`packages/document/src/participant-content.ts`:

```ts
export const PARTICIPANT_TEXT_FIELDS: {
  shape: ['label', 'richText', 'code', 'pageTitle', 'pageSubtitle'];
  text: ['label', 'richText'];
  sticky: ['label', 'richText'];
  table: ['label', 'cells'];
  image: ['label', 'alt'];
  freehand: ['label'];
  'link-card': ['label'];
  video: ['label'];
  arrow: ['label'];
};
export function participantTextFields(type: string): readonly string[]; // none for a kind not listed
export type ParticipantRefusal =
  | 'tab-locked'
  | 'not-addable'
  | 'not-removable'
  | 'missing'
  | 'type-changed'
  | 'locked'
  | 'reorder'
  | 'invalid';
export type ParticipantOpResult =
  | { result: 'applied'; tab: Tab; op: RoomElementOp; changed: boolean }
  | { result: 'refused'; correction: ElementOp | null; reason: ParticipantRefusal };
export function applyParticipantOp(tab: Tab, op: ElementOp): ParticipantOpResult;
export function participantTabChange(before: Tab, after: Tab): Tab | null;
```

`packages/document/src/participant-article.ts`:

```ts
export type ParticipantArticleRefusal = 'tab-locked' | 'missing' | 'locked' | 'not-writing';
export type ParticipantArticleResult =
  | { result: 'applied'; tab: Tab; changed: boolean }
  | { result: 'refused'; reason: ParticipantArticleRefusal };
export function applyParticipantArticleOps(
  tab: Tab,
  flow: string,
  ops: readonly ArticleOp[],
): ParticipantArticleResult;
export function participantArticlesChange(before: Tab, after: Tab): boolean;
```

`apps/api/src/participant-write.ts`:

```ts
export type ParticipantWriteFailure = { ok: false; status: 404 | 409 | 413 };
export type ParticipantWriteResult =
  { ok: true; outcome: ParticipantOpResult } | ParticipantWriteFailure;
export type ParticipantArticleWriteResult =
  { ok: true; outcome: ParticipantArticleResult } | ParticipantWriteFailure;
export function writeParticipantOp(
  env: Env,
  req: { documentId: string; tabId: string; op: ElementOp },
): Promise<ParticipantWriteResult>;
export function writeParticipantArticle(
  env: Env,
  req: { documentId: string; tabId: string; flow: string; ops: readonly ArticleOp[] },
): Promise<ParticipantArticleWriteResult>;
```

`apps/api/src/room-op-gate.ts`: `gateClientOp(op, { role, tabScope })` answers `{ kind: 'drop' } | { kind:
'participant-content' } | { kind: 'participant-article' } | { kind: 'relay'; presence: boolean }`.

`apps/editor/lib/editor-capabilities.ts`:

```ts
export type EditorCapabilities = {
  level: AccessLevel;
  takePart: boolean;
  writeText: (el: Element) => boolean;
  writeArticle: boolean;
};
export function resolveEditorCapabilities(level: AccessLevel): EditorCapabilities;
```

REST: `POST /api/documents/:id/share` takes `role?: 'view' | 'participate' | 'edit'`, omitted `edit`; anything else is
400 `invalid role`. `GET /api/share/:code` answers `role: AccessLevel`. `POST .../room-ticket` answers
`RoomTicketResponse { ticket }`.

MCP: `share_document.role` is `z.enum(['view', 'participate', 'edit']).optional()`, default `participate`; the
description reads `"participate" (default): recipients edit text and comment but cannot add, move or restyle
anything; right for a review. "view": they only look, with no comments or votes. "edit": they can change anything.`

## Data and persistence

| Field                                    | Class      | Notes                                                               |
| ---------------------------------------- | ---------- | ------------------------------------------------------------------- |
| `share_links.role`, `shared_with.role`   | credential | Legacy `CHECK (role IN ('edit', 'view'))`: `view` for a Participant |
| `share_links.level`, `shared_with.level` | credential | `NULL` or a level; set only for `participate` (SR11)                |
| `ws_tickets.role`                        | ephemeral  | The effective level; no CHECK                                       |

The baseline migration, `0001_livedocuments_baseline.sql`: a `level` column on `share_links` and the same on
`shared_with` (`CHECK (level IS NULL OR level IN ('view', 'participate', 'edit'))`). No row changes level (SR11).
Readers take `parseStoredLevel(level ?? role)` (`storedLevelOf`); writers keep `role` two-valued (`legacyRoleColumn`)
and set `level` only for `participate` (`levelColumn`); the Shared lists join on `COALESCE(level, role)`. A
Participant's writes change only text already in the tab, so nothing new is stored on an element or a ticket.
Image grants (`db/image-grants.ts`) come from edit collaborators only: a Participant never places a picture.

## Errors and edge cases

- **E1** `POST /share` with `role: 'admin'`, `null` or a number: 400, nothing written.
- **E2** An editor bundle older than this change opens a Participant link: it reads the level as edit, shows edit
  controls, its tab PUT is refused 403 and `writesForbiddenRef` stops its autosave; its room ops below the
  participant classes are dropped.
- **E3** A Participant adds any element (a crafted client; the editor offers no palette): refused `not-addable`; the
  sender gets `remove`.
- **E4** A Participant deletes an element: refused `not-removable`; the sender gets it back at its index.
- **E5** A Participant moves, resizes or restyles an element while editing its label: applied as the label alone;
  peers get the label's patch. The editor never sends such a change: its commit guard holds it back.
- **E6** A Participant edits an element an Editor deleted meanwhile, or one an Editor added within its autosave window
  (not stored yet): refused `missing`; the sender re-hydrates.
- **E7** A Participant edits a locked element, an element on a locked layer, or anything on a locked tab: refused
  `locked` or `tab-locked`, correction the stored element.
- **E8** The write loses the compare-and-swap `TAB_CAS_MAX_ATTEMPTS` times, the tab is gone, or the tab is over its
  cap: the sender gets `catchup { resync: true }`; nothing is relayed.
- **E9** A Participant's article frame changes the article's style, puts a zone, divider or page break, or writes in
  an article with a locked page: refused `not-writing` or `locked`; the sender re-hydrates.
- **E10** A Participant socket sends `tab`, `tab-meta`, `document-meta`, `reorder`, `check` or `drag-preview`:
  dropped (a `reorder` inside an `el` frame is refused `reorder`, correction the stored order).
- **E11** A tab-scoped Participant link: its frames on another tab are dropped by the scope check first.
- **E12** An embed of a Participant link: renders as a Viewer (SR6).
- **E13** A Participant's text in a table reshapes `cells` (adds a row, or a cell that is not a string): the merge
  keeps the stored cells.
- **E14** A Participant's article frame creates or removes an article: not writing, ignored.
- **E15** A Participant writes past the end of an article's last page: its writing lands; an Editor that is not the
  writer and is in the room grows the pages (`grow: true`, `markArticleGrow`).
- **E16** A socket with `PARTICIPANT_PENDING_MAX` writes waiting sends another: refused, the sender re-hydrates.
- **E17** A Participant empties a text box that sizes to its words: it stays, empty, rather than being removed (a
  remove would be refused).

## Security and trust

- The level is resolved on the server (grant, ticket, `X-Verified-Role`) and enforced per door; the editor's `can` is
  presentation only (I5).
- Every trust header the upgrade forwards is set on every path so a client cannot supply its own.
- Both participant rules are allow-lists (text fields per kind, writing blocks), so a field, element kind or block
  added later is refused to a Participant until someone decides it is text; `participant-content.leak.test.ts` offers
  every stored field of every kind new values and checks only the listed ones land.
- A Participant cannot place a picture, so it never mints an image grant: a document serves an image its owner does
  not own only through an edit collaborator's grant.
- Rate: room frames ride `OP_RATE_CAP`; each applied write is one D1 read and one compare-and-swap.

## Performance and limits

- `gateClientOp` is constant-time on `op.kind`.
- A Participant op or article frame costs one D1 read and one compare-and-swap write of the tab row
  (≤ `MAX_TAB_BYTES`), serialised per document on the tab write queue. Measured CPU for one element op (parse, rule,
  stringify), before the rule narrowed to text: 0.23 ms on a 200-element tab (23 KB), 2.2 ms at 2,000 elements
  (242 KB), 4.5 ms at 5,000 (611 KB). The editor's commit guard (`participantTabChange`) cost 0.10 ms, 1.5 ms and
  1.6 ms on the same tabs, once per commit.
- The autosave's 600 ms debounce batches a person's typing into one op per element and one frame per article. What
  is not bounded is D1 round trips: one per op or frame, and a room of people all writing at once queues behind one
  another. Recorded as a risk; the mitigation, if it bites, is to batch a socket's ops per tab into one write.
- `applyParticipantOp` is linear in the tab's element count for one op; `applyParticipantArticleOps` is linear in
  the article's block count per op.

## Presentation and UX

Share dialog cards, in `LEVEL_ORDER = ['edit', 'participate', 'view']`:

| Level       | Title / blurb                                                                  | Stub          | Glyph              | Solid (stub)                                 |
| ----------- | ------------------------------------------------------------------------------ | ------------- | ------------------ | -------------------------------------------- |
| edit        | **Editor** / "Draws with you in real time."                                    | `EDITOR`      | `lucidePencilLine` | as today                                     |
| participate | **Participant** / "Edits text and comments. Can't add, move or restyle."       | `PARTICIPANT` | `lucideVote`       | `bg-teal-700 text-white dark:bg-teal-600/60` |
| view        | **Viewer** / "Watches, pans and zooms. Can't comment, vote or change a thing." | `VIEWER`      | `lucideEye`        | as today                                     |

- Three cards, one per row at every width (SR8); the pass stub widens to fit `PARTICIPANT` (SR7).
- Arrow keys step through `LEVEL_ORDER`, wrapping; Home and End reach the ends.
- Pill: **Participating**, `bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200`, the vote glyph; static.
- A Participant has no palette strip and adds nothing; it keeps the Undo/Redo cluster. Tab add, rename and delete,
  the page toolbar, the article's inserts and style, and context menus' structural rows are absent.
- A held-back change shows the info toast "As a participant you can edit text and comment." (`HELD_BACK_NOTICE`).
- A Viewer sees no comment composer, resolve or delete (`CommentThreadPopover canComment`),
  no reactions. Its selection holds nothing
  (`RemoteSelector.holds`, `lockedByOther`).
- Badges: "Editor", "Participant", "Viewer". Shared-with-you chip: "Edit", "Participate", "View".

## Accessibility

- The cards stay one `role="radiogroup"` of `role="radio"` cards with roving `tabIndex`.
- `teal-700` under white 10 px bold: 5.47:1; `teal-800` on `teal-100`: 6.73:1. Each level has its own word and glyph.
- A control a Participant cannot use is absent, not disabled-and-unexplained.

## Web Experience

The Share dialog is a lazy chunk; a third card adds no request. A Participant's own edits apply locally at once
(INP unchanged); peers see them after the room's write.

## Observability

| Fingerprint                                                | Where                    |
| ---------------------------------------------------------- | ------------------------ |
| `[access-levels] invalid role <value>`                     | api, share create (warn) |
| `[participant-write] refused <tabId> <reason>`             | room (info)              |
| `[participant-write] article refused <tabId> <reason>`     | room (info)              |
| `[participant-write] flood <documentId> <tabId> <queued>`  | room (warn)              |
| `[participant-write] failed <documentId> <tabId> <status>` | room (error)             |
| `[participant] change held back <tabId>`                   | editor (debugLog)        |

## Testing

| Rule                                                                    | Test                                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Ladder, `parseStoredLevel`, telemetry types                             | `packages/api-schema/src/access-levels.test.ts`                                                              |
| Op classes                                                              | `packages/api-schema/src/room-messages.test.ts`                                                              |
| Every row of the participant content rule, every refusal and correction | `packages/document/src/participant-content.test.ts`                                                          |
| Only listed text fields ever land, for every element kind               | `packages/document/src/participant-content.leak.test.ts`                                                     |
| The participant writing rule: writing blocks, every refusal             | `packages/document/src/participant-article.test.ts`                                                          |
| `mergeLedgerAnswersIntoTab`                                             | `packages/document/src/collab-ledger.test.ts`                                                                |
| Gates compare levels                                                    | `apps/api/src/auth/document-access.test.ts`                                                                  |
| Share create validates three levels                                     | `apps/api/src/routes/document-share-routes.test.ts`                                                          |
| Write: applied, unchanged, refused, CAS retry, 404, 409, 413            | `apps/api/src/participant-write.test.ts`                                                                     |
| Op gate per level: `participant-content`, `participant-article`, drop   | `apps/api/src/room-op-gate.test.ts`                                                                          |
| Room: participant path, corrections, re-hydrate, `grow` relay           | `apps/api/src/room-participant.test.ts`, `document-room-participant.test.ts`, `document-room-routes.test.ts` |
| Capabilities per level                                                  | `apps/editor/lib/editor-capabilities.test.ts`                                                                |
| Held-back notice                                                        | `apps/editor/app/document/[id]/useParticipantSession.test.ts`                                                |
| Participant save branch: element ops and article frames                 | `apps/editor/app/document/[id]/tab-save-flow.test.ts`                                                        |
| Three cards and keys                                                    | `apps/editor/components/dialogs/ShareDialog.test.tsx`                                                        |
| Pill per level                                                          | `apps/editor/components/chrome/RoleIndicator.test.tsx`                                                       |
| MCP default and enum                                                    | `packages/agent-verbs` MCP schema tests                                                                      |

## Constants and configuration

| Constant                  | Value                                | Provenance                          | Safe range          |
| ------------------------- | ------------------------------------ | ----------------------------------- | ------------------- |
| `ACCESS_LEVELS`           | `['view', 'participate', 'edit']`    | Spec, ascending                     | fixed               |
| `DEFAULT_LINK_LEVEL`      | `'edit'`                             | Spec: an omitted role is edit       | fixed               |
| `DEFAULT_MCP_SHARE_LEVEL` | `'participate'`                      | Spec                                | fixed               |
| `LEVEL_ORDER`             | `['edit', 'participate', 'view']`    | Spec's card order                   | fixed               |
| `PARTICIPANT_TEXT_FIELDS` | text fields per element kind (above) | Spec: a Participant edits text only | grows with the spec |
| `TAB_CAS_MAX_ATTEMPTS`    | 8                                    | The room's existing bound           | 3 to 20             |
| `PARTICIPANT_PENDING_MAX` | 64                                   | SR12                                | 8 to 512            |
| `HELD_BACK_NOTICE_MS`     | 4000                                 | SR13                                | 1000 to 30000       |

No new environment variable or binding; self-hosting needs the baseline migration.

## Assets and external resources

No new asset. The Participant glyph is `lucideVote`, already vendored in `packages/icons/src/lucide.generated.ts`
from Lucide (ISC licence).

## Defaults ledger

SR1 to SR13 in [DEFAULTS.md](DEFAULTS.md); SR3, SR4 and SR5 are retired with the adder.
