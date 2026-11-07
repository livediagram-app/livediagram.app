# Share roles: blueprint

Derived from [Share roles](../share-roles.md), with the room of
[Realtime conflict resolution](../../012-collaboration/realtime-conflict-resolution.md) and
[Collab race hardening](../../012-collaboration/collab-race-hardening.md), the queued tab write of the
[Q&A board](../../012-collaboration/qa-board.md), the baton of [Facilitator](../../012-collaboration/facilitator.md),
the pass and pill of [Editor app](../../007-editor/editor-app.md#share-dialog), [Embeds](../embeds.md), and the share
types of [Telemetry](../../017-telemetry/telemetry.md). The code sites it answers are catalogued in
`docs/research/access-levels/current-abilities.md`. The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `SRn`.

livediagram's [Later](../../../../../livediagram/docs/specs/013-workspace/share-roles.md#later) items (token levels, ownership powers, collaboration keys pinned per
socket, the answers route, a look-only Viewer) are not derived here; their earlier draft is in git history
(`70a6f843f`).

## Scope, by file

| File                                                                                                           | Role                                                                                          |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `../packages/api-schema/src/access-levels.ts` (new)                                                            | `ACCESS_LEVELS`, `AccessLevel`, the ladder, `parseStoredLevel`, `LEVEL_TELEMETRY_TYPE`        |
| `packages/api-schema/src/index.ts`                                                                             | `ShareRole` becomes an alias of `AccessLevel`                                                 |
| `packages/api-schema/src/room-messages.ts`                                                                     | `PARTICIPATION_OP_KINDS`, `PARTICIPATION_DELTA_KINDS`, `isParticipationOp`                    |
| `packages/document/src/participant-content.ts` (new)                                                           | The participant content rule: `applyParticipantOp`, the piece fields, `participantTabChange`  |
| `packages/document/src/element-types.ts`, `validate.ts`                                                        | `addedBy?: string` on `StickyElement` and `TextElement`; validated                            |
| `packages/document/src/collab-ledger.ts`                                                                       | `mergeLedgerAnswersIntoTab`: reactions only (responses and ideas gone in part 4, votes later) |
| `../liveworkspace/apps/index/migrations/0001_index.sql`                                                        | A `level` column on `share_links`                                                             |
| `apps/api/src/room-op-gate.ts`, `apps/api/src/adder-key.ts`                                                    | Readers through `parseStoredLevel`; the room's `adderKeyFor`                                  |
| `apps/api/src/routes/context.ts`                                                                               | Gates compare levels on the index's grant                                                     |
| `apps/api/src/routes/context.ts`                                                                               | `gateParticipate` is the Participant check                                                    |
| `../liveworkspace/apps/index/src/sharing.ts`                                                                   | The index's share route takes three levels                                                    |
| `apps/api/src/adder-key.ts` (new)                                                                              | `adderKeyFor(documentId, ownerId)`                                                            |
| `apps/api/src/routes/document-room-routes.ts`                                                                  | The ticket carries `adderKey` for a Participant; the upgrade forwards `X-Verified-Adder`      |
| `apps/api/src/document-room/document-room.ts`, `room-op-gate.ts`, `document-room-rules.ts`                     | Level on the session; op gate by class; participant `el` ops through the tab write queue      |
| `apps/api/src/participant-write.ts` (new)                                                                      | `writeParticipantOp`, `writeParticipantAnswers`: compare-and-swap writes of the rule's output |
| `packages/agent-verbs/src/mcp/*`                                                                               | `share_document.role` takes three levels, default `participate`                               |
| `apps/editor/lib/editor-capabilities.ts` (new)                                                                 | `resolveEditorCapabilities`, `EditorCapabilities`                                             |
| `apps/editor/app/document/[id]/*` (`useViewPreview`, `useEditorState`, `tab-save-flow`, `editor-page-helpers`) | `sessionRole: AccessLevel`; `can`; the participant save flow                                  |
| `../packages/explorer/src/dialogs/share/ShareComposer.tsx`, `parts.tsx`                                        | Three cards                                                                                   |
| `apps/editor/components/chrome/RoleIndicator.tsx`, `app/document/[id]/useRoleIndicator.ts`                     | Participating pill                                                                            |
| `apps/editor/lib/collaborator-roster.ts`, `../packages/explorer/src/explorer/SharedList.tsx`                   | Participant badge; Participate chip                                                           |

## Domain and naming

| Term                | Identifier                                                                        | Meaning                                                                       |
| ------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Access level        | `AccessLevel`, `ACCESS_LEVELS` (ascending); wire and column field `role` (SR1)    | What a link or embed admits                                                   |
| Viewer              | `'view'`; card **Viewer**, stub `VIEWER`, pill **Viewing**                        | Looks only; writes nothing                                                    |
| Participant         | `'participate'`; card **Participant**, stub `PARTICIPANT`, pill **Participating** | Takes part and changes content                                                |
| Editor              | `'edit'`; card **Editor**, stub `EDITOR`, pill **Editing**                        | Changes anything; may hold the baton                                          |
| Participation act   | `PARTICIPATION_OP_KINDS`, `PARTICIPATION_DELTA_KINDS`                             | A response or an idea (the dot left with the vote)                            |
| Participant content | `applyParticipantOp`                                                              | The rule a Participant's element change is applied under                      |
| Adder               | `addedBy` (element), `adderKeyFor`, `adderKey` (ticket), `X-Verified-Adder`       | Who added an element, as a server-derived key; only stamped for a Participant |
| Capabilities        | `EditorCapabilities` (`can`)                                                      | The editor's per-level flags; render only, never the rule                     |

Banned: "Collaborator" for the level (it was the working name; "collaborator" stays the roster's word for anyone
present), "commenter", "permission", "createdBy".

## Behaviour and state

The ladder is **view < participate < edit**. `levelAtLeast(level, min)` compares ranks. `parseStoredLevel(x)` is `x`
when it is one of the three, else `view`.

Doors by level (server):

| Door                                                                                       | Needs                             |
| ------------------------------------------------------------------------------------------ | --------------------------------- |
| Reads (document, tabs, images, comment threads, the Timeline); share resolve; make a copy  | view                              |
| Room: presence (cursor, select, follow, focus); never `reaction`                           | view                              |
| Comments: add, reply, resolve, reopen, delete own                                          | participate (`deniedParticipate`) |
| Room: `reaction`                                                                           | participate                       |
| Room: `el-delta` `comment-react`                                                           | participate                       |
| Room: `el` (`add`, `update`, `remove`) through the participant rule                        | participate                       |
| Tab PUT, tab DELETE, document PUT; room `tab`, `tab-meta`, `document-meta`, `el` `reorder` | edit                              |
| Room: `el-delta` `check`, other `comment-*`; `drag-preview`                                | edit                              |
| Facilitator baton                                                                          | edit (`canHold`, unchanged)       |

An Editor's `el` op is relayed as today. A Participant's `el` op takes the participant path:

1. **Gate.** The session's level is `participate`, the op's tab passes the tab-scope check, and the op kind is `add`,
   `update` or `remove`. A `reorder` is dropped.
2. **Queue.** The op joins the room's tab write queue (`tabWriteQueue`, SR2), so a document's participant writes
   run one at a time. (The Q&A board's writes shared it until part 4 of Work Tracker #423 removed the board.)
3. **Write.** `writeParticipantOp(env, { documentId, tabId, ops: [op], adderKey })` reads the stored tab, runs
   `applyParticipantOp` and compare-and-swaps the result (up to `TAB_CAS_MAX_ATTEMPTS`).
4. **Relay.** An `applied` op is sequenced from the sender to everyone but the sender when it equals what the sender
   sent, and to everyone including the sender when the rule changed it (SR3). A `refused` op sends the sender its
   `correction` alone. A failed write sends the sender `catchup { resync: true }`.

`applyParticipantOp(tab, op, adderKey)` (pure), returning `{ result: 'applied', tab, op } | { result: 'refused',
correction: ElementOp | null, reason }`:

A Participant changes no element but through a piece ([A Participant walks](../share-roles.md#a-participant-walks),
owner 2026-11-05): before, it added stickies, text and images and wrote on others' elements; those rows are gone.

| Op        | Applied when                         | Result                                                                                           | Refusal correction                       |
| --------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `add`     | never (`not-addable`)                | n/a                                                                                              | `remove` of the id (unless id existed)   |
| `update`  | The stored element exists, same type | Stored, with the piece fields below copied from incoming; its own earlier element no differently | `update` with the stored element         |
| `remove`  | never (`not-own`)                    | n/a                                                                                              | `add` of the stored element at its index |
| `reorder` | never                                | n/a                                                                                              | `reorder` with the stored ids            |

Piece fields a Participant may change, on anyone's element:

| Element                 | Fields                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `shape` `door`          | `doorClosed`                                                                                          |
| `shape` `notice-board`  | `noticeNotes`, through `mergeNoticeNotes`: notes signed with its adder key added or removed, no other |
| `shape` `calendar-wall` | `noticeNotes`, as a `notice-board` (`holdsNotes`)                                                     |

Every other field stays as stored, so a stale or crafted update that also moves, recolours or rewrites an element
lands as its piece change alone, or as nothing (`changed: false`).

- An `update` whose merge equals the stored element is `applied` with no write (`unchanged`) and no relay.
- The applied tab must pass `isValidTab`; one that does not is refused with the stored element as correction.
- Live fields (`LIVE_ELEMENT_FIELDS`) always come from stored: answers travel as deltas, never through an update.
- An applied update's `op` is an `ElementPatchOp` (`{ kind: 'patch', id, set, clear? }`) of the fields that changed
  between stored and merged, a room-only op (`RoomElementOp`, `applyRoomElementOp`) that peers apply over their live
  copy. It is never the stored element whole: the stored tab can be behind an Editor's unsaved change.

Answers as self: a Participant's `response`
delta must name a `participantId` equal to its session's presence `key` (`answersAsSelf`); an `idea` names nobody. Anything else is dropped.

Answers persistence: after the room sequences a Participant's `response` or `idea`, it schedules one
`writeParticipantAnswers` for that tab `ANSWERS_FLUSH_MS` later (coalesced per tab), which reads the stored tab,
applies `mergeLedgerAnswersIntoTab(tab, ledger)` and compare-and-swaps it, through the same queue. An Editor's
answers persist as today, through its own save.

Adder key: `adderKeyFor(documentId, ownerId)` is the first `ADDER_KEY_LENGTH` hex characters of
SHA-256(`livehuddle:adder:v1:<documentId>:<ownerId>`) (SR4). The ticket mint stores it on the ticket when the
effective level is `participate` and an owner resolves, and answers it beside the ticket (`RoomTicketResponse`) so the
editor knows which elements are its own; the upgrade forwards it as `X-Verified-Adder` and the document id as
`X-Verified-Document` (both set on every path, empty when none); the room keeps both on the attachment. A Participant
session always mints a ticket. A Participant session without one (an older
bundle's `?s=` upgrade, or a failed mint) may update but never add or remove (SR5).

Editor state:

| Flag            | Value                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| `sessionRole`   | owner: `edit`; link: its level; embed: `edit` stays, anything else `view`    |
| `canEdit`       | `sessionRole === 'edit' && !viewPreview` (unchanged)                         |
| `isReadOnly`    | `!canEdit` (unchanged): every structural gate stays shut for a Participant   |
| `can`           | `resolveEditorCapabilities({ level, adderKey })`, in `useParticipantSession` |
| Session gates   | `roleGates(can, runBlocked)`: `run`, `shape`, `takePart` (below)             |
| Pill level      | `viewPreview ? 'view' : sessionRole`                                         |
| `canToggleRole` | `sessionRole === 'edit'` (unchanged)                                         |

`EditorCapabilities` for a session that is not an Editor; an Editor holds every flag:

| Flag            | participate | view  |
| --------------- | ----------- | ----- |
| `takePart`      | true        | false |
| `addContent`    | false       | false |
| `writeText(el)` | false       | false |
| `move(el)`      | false       | false |
| `resize(el)`    | false       | false |
| `recolour(el)`  | false       | false |
| `remove(el)`    | false       | false |
| `swingDoor(el)` | true        | false |
| `alwaysWalks`   | true        | false |

`roleGates(can, runBlocked)` answers the canvas's role gates from `can`, never from `isReadOnly`: `run` is
`level === 'edit' && !runBlocked` (start, end, reveal or configure a session tool; Bring Focus), `shape` is
`level === 'edit'` (the template start; an estimate's scale), `takePart` is `can.takePart` (answers, reactions,
speech, comments). `isReadOnly` is `!canEdit`, which equals `can.level !== 'edit'` in every session, preview and
ended workbench included, so the switch changes no behaviour.

A walking click on a control piece reads the same gates through the face's press: Bring Focus gets one on `run`
(`EditorCanvasHost` passes `onPressFocusButton` only then), a Selection Mode button on `!can.alwaysWalks`, a Timer or
Stopwatch on `takePart`. With none, `avatarPressOutcome(kind, hasMain)` (`lib/avatar-click-intent.ts`) answers
`nothing` for the `NO_READER_KINDS` (those four), so the gesture neither walks nor opens the reader; every other Use
piece with no main still reads. `FocusButtonFace` draws its inert target in a hover card saying who may press it.

A Participant's commit: `editsBlocked` is false for a Participant (its gestures open through `can`), so every commit
passes `guardCommit`, which runs `participantTabChange(before, after, adderKey)`: the change lands, with `addedBy`
stamped on what it adds, only when the rule would take it unchanged; anything the room would refuse or trim is
held back. Running a session stays shut through `sessionToolsBlocked` (the baton's block, or `isReadOnly`).

A Participant's save: the autosave runs for a Participant, but takes the participant branch
(`relayParticipantChanges`): the ops are `diffToElementOps(before, after)` without `reorder`, sent over the socket as
`el` ops; no tab PUT, no tab delete, no document metadata, no whole `tab`. The socket being closed fails the save,
which the autosave retries as today; the unload flush sends the same ops at once.

Hooks that write a tab's structure, or write without passing `commit`, take `structureBlocked`
(`editsBlocked || isReadOnly`) or `structureCreateBlocked` (`createBlocked || isReadOnly`), never the opened
`editsBlocked`: lane settling, element helpers, tab canvas, images, paths, the eraser, swatch overrides, the cleanup preview, board scenes and library inserts.
A held-back commit shows `HELD_BACK_NOTICE` at most once per `HELD_BACK_NOTICE_MS`.

Gestures opened for a Participant, each beside `isReadOnly`: answering session tools (`takePart`), the pieces
(`swingDoor`, a Notice Board's pin and unpin, a Timer's controls) and the walk. It has no palette strip (the
`participate` category and `participantPaletteCategories` are gone), no tile keys, and the keyboard treats it as a
Viewer (`useEditorKeyboardShortcuts` takes no `participant` flag). `can.alwaysWalks` (a Participant's and a
Viewer's, `resolveEditorCapabilities`; [Always walking](../share-roles.md#always-walking)) holds it in Avatar mode:
`useCanvasTool`'s `holdWalking` reports `'avatar'` and refuses every other tool, from an editing key, Search, a
Selection Mode button, an Avatar Pad, the palette reach and a change of tab alike; the Edit | Walk toggle is not
drawn for it (`walkToggle` false), and a Selection Mode button's face is inert. `stripPaletteFor` gives it the avatar
palette, and the Call dock (`CallDock`, whose call group is `CallStripGroup`) holds its call controls.

Invariants:

- **I1** Every level gate compares through `levelAtLeast`; no gate reads `role === 'edit'` by itself.
- **I2** Every reader parses through `parseStoredLevel`: an unknown level reads as `view`.
- **I3** A Participant's content change reaches storage and peers only through `applyParticipantOp`.
- **I4** `addedBy` is written only by `applyParticipantOp`, from the room's verified adder key; an Editor's save
  keeps whatever the stored element carries.
- **I5** The baton is held only at edit.
- **I6** The server enforces every level; `can` only decides what renders.

## Interfaces and contracts

`../packages/api-schema/src/access-levels.ts`:

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
export type ParticipantOpResult =
  | { result: 'applied'; tab: Tab; op: ElementOp; changed: boolean }
  | { result: 'refused'; correction: ElementOp | null; reason: ParticipantRefusal };
export type ParticipantRefusal =
  | 'not-addable'
  | 'no-adder'
  | 'id-taken'
  | 'missing'
  | 'type-changed'
  | 'not-own'
  | 'reorder'
  | 'invalid';
export function applyParticipantOp(
  tab: Tab,
  op: ElementOp,
  adderKey: string | null,
): ParticipantOpResult;
export function participantTabChange(before: Tab, after: Tab, adderKey: string | null): Tab | null;
```

`../packages/model-core/src/adder.ts`: `ADDER_KEY_LENGTH = 32`.

`apps/api/src/participant-write.ts`:

```ts
export type ParticipantWriteResult =
  { ok: true; outcome: ParticipantOpResult } | { ok: false; status: 404 | 409 | 413 };
export function writeParticipantOp(
  env: Env,
  req: { documentId: string; tabId: string; op: ElementOp; adderKey: string | null },
): Promise<ParticipantWriteResult>;
export function writeParticipantAnswers(
  env: Env,
  req: { documentId: string; tabId: string; ledger: TabLedger },
): Promise<{ ok: true; changed: boolean } | { ok: false; status: 404 | 409 | 413 }>;
```

REST: `POST /api/documents/:id/share` takes `role?: 'view' | 'participate' | 'edit'`, omitted `edit`; anything else is
400 `invalid role`. `GET /api/share/:code` answers `role: AccessLevel`. `POST .../room-ticket` answers
`RoomTicketResponse { ticket, adderKey? }`, the key only for a Participant.

MCP: `share_document.role` is `z.enum(['view', 'participate', 'edit']).optional()`, default `participate`; the
description reads `"participate" (default): recipients add stickies, write and comment but cannot reshape it. "view":
they only look, with no comments. "edit": they can change anything.`

## Data and persistence

| Field                             | Class      | Notes                                                              |
| --------------------------------- | ---------- | ------------------------------------------------------------------ |
| `share_links.level` (the index's) | credential | `CHECK (level IN ('view', 'participate', 'edit'))`                 |
| Room ticket level                 | ephemeral  | The index's grant; the effective level, ten minutes like the grant |
| Room ticket adder key             | ephemeral  | Derived at the upgrade (`adderKeyFor`); never stored               |
| Element `addedBy`                 | content    | Optional, ≤ `ADDER_KEY_LENGTH` chars; on `sticky` and `text` only  |
| Room attachment `adderKey`        | ephemeral  | Per socket, survives hibernation                                   |

The level lives in liveworkspace's index (`share_links.level`, `../liveworkspace/apps/index/migrations/0001_index.sql`);
this api stores none. Readers in the room take `parseStoredLevel` on the session's role. Copies,
exports, templates and duplicates keep `addedBy` as data (it identifies nobody outside its document); a Make a copy
lands in a new document, where no adder key matches it.

## Errors and edge cases

- **E1** `POST /share` with `role: 'admin'`, `null` or a number: 400, nothing written.
- **E2** An editor bundle older than this change opens a Participant link: it reads the level as edit, shows edit
  controls, its tab PUT is refused 403 and `writesForbiddenRef` stops its autosave; its room ops below the
  participant classes are dropped.
- **E3** A Participant adds anything, a sticky or text included (crafted client, a paste): refused `not-addable`;
  the sender gets `remove`.
- **E4** A Participant deletes any element, its own earlier sticky included: refused `not-own`; the sender gets it
  back at its index.
- **E5** A Participant's update that moves a Door as it swings it: applied as the swing alone (`doorClosed`); the
  sender gets the merged element. One that rewrites a label or moves a sticky: applied with nothing changed.
- **E6** A Participant edits an element an Editor deleted meanwhile: refused `missing`, no correction (the Editor's
  remove reaches the sender too).
- **E8** The write loses the compare-and-swap `TAB_CAS_MAX_ATTEMPTS` times, the tab is gone, or the tab is over its
  cap: the sender gets `catchup { resync: true }`; nothing is relayed.
- **E9** A Participant socket without an adder key pins a note: the merge keeps the stored notes (no note is its own).
- **E10** A Participant socket sends `tab`, `tab-meta`, `reorder`, `check`, `board`, `response`, `idea` or `drag-preview`:
  dropped.
- **E11** A tab-scoped Participant link: its ops on another tab are dropped by the scope check first.
- **E12** An embed of a Participant link: renders as a Viewer (SR6).
- **E15** A Participant edits an element an Editor added within its autosave window (not stored yet): refused
  `missing`; the sender re-hydrates.
- **E16** A socket with `PARTICIPANT_PENDING_MAX` writes waiting sends another: refused, the sender re-hydrates.
- **E18** An Editor duplicates or pastes a Participant's sticky: the copy has no `addedBy` (`freshCopyFields`).
- **E19** A Participant's response naming another key: dropped.

## Security and trust

- The level is resolved on the server (grant, ticket, `X-Verified-Role`) and enforced per door; the editor's `can` is
  presentation only (I6).
- Every trust header the upgrade forwards, `X-Verified-Adder` included, is set on every path so a client cannot
  supply its own.
- `addedBy` is derived from the caller's identity on the document and the document id, so it cannot be turned back
  into an owner id and differs per document; a Participant cannot claim another's element by writing `addedBy`
  (the rule keeps the stored value).
- A Participant's answers carry a client-chosen key, as an Editor's do today ([Later](../../../../../livediagram/docs/specs/013-workspace/share-roles.md#later)).
- Rate: room frames ride `OP_RATE_CAP`; each applied op is one read and one compare-and-swap in the document's SQLite.

## Performance and limits

- `isParticipationOp` and the op class check are constant-time on `op.kind` and `delta.kind`.
- A Participant op costs one read and one compare-and-swap write of the tab row (≤ `MAX_TAB_BYTES`), serialised
  per document on the tab write queue. Measured CPU for one op (parse, rule, stringify): 0.23 ms on a 200-element
  board (23 KB), 2.2 ms at 2,000 elements (242 KB), 4.5 ms at 5,000 (611 KB). The editor's commit guard
  (`participantTabChange`) costs 0.10 ms, 1.5 ms and 1.6 ms on the same tabs, once per commit.
- The autosave's 600 ms debounce batches a person's typing into one op per element. What is not bounded is storage round
  trips: one per op, so a multi-element move by one Participant is several writes, and a room of people all writing
  at once queues behind one another. Recorded as a risk; the mitigation, if it bites, is to batch a socket's ops per
  tab into one write.
- `ANSWERS_FLUSH_MS` coalesces a burst of answers into one write per tab.
- `applyParticipantOp` is linear in the tab's element count for one op.

## Presentation and UX

Share dialog cards, in `LEVEL_ORDER = ['edit', 'participate', 'view']`:

| Level       | Title / blurb                                                                                                     | Stub          | Glyph              | Solid (stub)                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------- | ------------- | ------------------ | -------------------------------------------- |
| edit        | **Editor** / "Draws with you in real time."                                                                       | `EDITOR`      | `lucidePencilLine` | as today                                     |
| participate | **Participant** / "Walks, talks and uses the pieces; adds nothing." (livehuddle's, `APP_LEVEL_BLURBS.livehuddle`) | `PARTICIPANT` | `lucideVote`       | `bg-teal-700 text-white dark:bg-teal-600/60` |
| view        | **Viewer** / "Watches, pans and zooms. Can't comment or change a thing."                                          | `VIEWER`      | `lucideEye`        | as today                                     |

- livehuddle's picker lists the levels in `APP_LINK_LEVELS.livehuddle = ['edit', 'participate']`
  (`packages/index-client/src/constants.ts`), so it shows the Editor and Participant cards, one per row at every
  width (SR8), with `APP_DEFAULT_LINK_LEVEL.livehuddle = 'participate'` chosen when the dialog opens. The Viewer row
  above stays for a legacy Viewer pass, whose band reads `VIEWER (LEGACY)` (`ShareDialog` passes `legacy` to
  `PassTicket` for a level not in the item's app's list); the pass stub widens to fit `PARTICIPANT` (SR7).
- New Viewer links are refused, never mapped: `POST /api/documents/:id/share {role: 'view'}` is 400
  `level_not_offered` before the index is asked (`routes/document-index-routes.ts`), the index's
  `POST /items/:id/share` refuses a non-public `view` link on a livehuddle item with the same code, and its
  `PATCH /share/:code` refuses a change to a level the app does not offer (a rescope that keeps a legacy link's
  level is allowed). A public link (a Community post's) is always `view` and is outside the table. The MCP's
  `shareDocumentShape.role` is `z.enum(['participate', 'edit'])`.
- Arrow keys step through the offered levels, wrapping; Home and End reach the ends.
- Pill: **Participating**, `bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200`, the vote glyph; static.
- A Participant and a Viewer have no building strip and no Edit | Walk toggle; they are always walking. Tab add, rename and delete and context
  menus' structural rows are absent.
- A Viewer sees no comment composer, resolve or delete (`CommentThreadPopover canComment`), no poll prompt, no Q&A
  add or upvote, no reactions. Its selection holds nothing
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

| Fingerprint                                                 | Where                    |
| ----------------------------------------------------------- | ------------------------ |
| `[access-levels] invalid role <value>`                      | api, share create (warn) |
| `[participant-write] refused <documentId> <tabId> <reason>` | room (info)              |
| `[participant-write] failed <documentId> <tabId> <status>`  | room (error)             |
| `[participant-write] answers <documentId> <tabId> <ok>`     | room (debug)             |
| `[participant] change held back <tabId>`                    | editor (debugLog)        |

## Testing

| Rule                                                            | Test                                                                 |
| --------------------------------------------------------------- | -------------------------------------------------------------------- |
| Ladder, `parseStoredLevel`, telemetry types                     | `packages/api-schema/src/access-levels.test.ts`                      |
| Op classes                                                      | `packages/api-schema/src/room-messages.test.ts`                      |
| Every row of the participant rule, every refusal and correction | `packages/document/src/participant-content.test.ts`                  |
| `addedBy` validation                                            | `packages/document/src/validate.test.ts`                             |
| `mergeLedgerAnswersIntoTab`                                     | `packages/document/src/collab-ledger.test.ts`                        |
| Gates compare levels                                            | `apps/api/src/routes/context.test.ts`                                |
| Share create validates three levels                             | `../liveworkspace/apps/index/src/sharing.test.ts`                    |
| Write: applied, unchanged, refused, CAS retry, 404, 409, 413    | `apps/api/src/participant-write.test.ts`                             |
| Room: op gate per level; participant path; adder header         | `apps/api/src/document-room.test.ts`, `document-room-routes.test.ts` |
| Capabilities per level                                          | `apps/editor/lib/editor-capabilities.test.ts`                        |
| Every gate of the spec's table, per level, in the room          | `apps/api/src/share-roles.test.ts`                                   |
| Every gate of the spec's table, per level, in the editor        | `apps/editor/lib/share-roles.test.ts`                                |
| Participant save branch                                         | `apps/editor/app/document/[id]/tab-save-flow.test.ts`                |
| Three cards and keys                                            | `../packages/explorer/src/dialogs/ShareDialog.test.tsx`              |
| Pill per level                                                  | `apps/editor/components/chrome/RoleIndicator.test.tsx`               |
| MCP default and enum                                            | `packages/agent-verbs` MCP schema tests                              |

## Constants and configuration

| Constant                  | Value                             | Provenance                     | Safe range    |
| ------------------------- | --------------------------------- | ------------------------------ | ------------- |
| `ACCESS_LEVELS`           | `['view', 'participate', 'edit']` | Spec, ascending                | fixed         |
| `DEFAULT_LINK_LEVEL`      | `'edit'`                          | Spec: an omitted role is edit  | fixed         |
| `DEFAULT_MCP_SHARE_LEVEL` | `'participate'`                   | Spec                           | fixed         |
| `LEVEL_ORDER`             | `['edit', 'participate', 'view']` | Spec's card order              | fixed         |
| `TAB_CAS_MAX_ATTEMPTS`    | 8                                 | The Q&A write's existing bound | 3 to 20       |
| `ADDER_KEY_LENGTH`        | 32                                | 128 bits of hex (SR4)          | 16 to 64      |
| `ANSWERS_FLUSH_MS`        | 1500                              | SR9                            | 250 to 10000  |
| `PARTICIPANT_PENDING_MAX` | 64                                | SR12                           | 8 to 512      |
| `HELD_BACK_NOTICE_MS`     | 4000                              | SR13                           | 1000 to 30000 |

No new environment variable or binding; deploying needs nothing more.

## Assets and external resources

No new asset. The Participant glyph is `lucideVote`, already vendored in `../packages/icons/src/lucide.generated.ts`
from Lucide (ISC licence).

## Defaults ledger

SR1 to SR13 in [DEFAULTS.md](DEFAULTS.md).
