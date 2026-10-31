# Share roles: blueprint

> **Platform parts.** Share links, their levels and who may reach a plan are liveworkspace's index's
> ([One Explorer: contracts](../../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md#sharing-and-access)), and the Share dialog is the
> shared one from `@liveworkspace/explorer`. This blueprint covers how liveplanner enforces a level once it holds one.

Derived from [Share roles](../share-roles.md), with the room of
[Realtime conflict resolution](../../012-collaboration/realtime-conflict-resolution.md) and
[Collab race hardening](../../012-collaboration/collab-race-hardening.md),
the pass and pill of [Editor app](../../007-editor/editor-app.md#share-dialog), [Embeds](../embeds.md), the Plan item
and Sheet doors of [Plan board](../../026-plan/plan-board.md) and [Sheet store](../../029-sheets/sheet-store.md), and the share
types of [Telemetry](../../017-telemetry/telemetry.md). The code sites it answers are catalogued in
`docs/research/access-levels/current-abilities.md`. The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `SRn`.

The spec's [Later](../share-roles.md#later) items (token levels, ownership powers, collaboration keys pinned per
socket, the answers route) are planned and not derived here; their earlier draft is in git history
(`70a6f843f`).

## Scope, by file

| File                                                                                                          | Role                                                                                          |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `../packages/api-schema/src/access-levels.ts`                                                                 | `ACCESS_LEVELS`, `AccessLevel`, the ladder, `parseStoredLevel`, `LEVEL_TELEMETRY_TYPE`        |
| `packages/api-schema/src/index.ts`                                                                            | `ShareRole` becomes an alias of `AccessLevel`                                                 |
| `packages/api-schema/src/room-messages.ts`                                                                    | `PARTICIPATION_OP_KINDS`, `PARTICIPATION_DELTA_KINDS`, `isParticipationOp`                    |
| `packages/project/src/participant-content.ts`                                                                 | The participant content rule: `applyParticipantOp`, `PARTICIPANT_ADDABLE_TYPES`, field sets   |
| `packages/project/src/element-types.ts`, `validate.ts`                                                        | `addedBy?: string` on `StickyElement` and `TextElement`; validated                            |
| `packages/project/src/collab-ledger.ts`                                                                       | `mergeLedgerAnswersIntoTab`: votes and responses only                                         |
| `apps/api/src/plan-room/plan-schema.ts`                                                                       | A `level` column on `share_links` and `shared_with`; `ws_tickets.adder_key`                   |
| `apps/api/src/routes/context.ts`                                                                              | `gateParticipate` is the Participant check                                                    |
| `apps/api/src/adder-key.ts`                                                                                   | `adderKeyFor(projectId, ownerId)`                                                             |
| `apps/api/src/routes/project-room-routes.ts`                                                                  | The ticket carries `adderKey` for a Participant; the upgrade forwards `X-Verified-Adder`      |
| `apps/api/src/plan-room/plan-room.ts`, `room-op-gate.ts`, `project-room-rules.ts`                             | Level on the session; op gate by class; participant `el` ops through the tab write queue      |
| `apps/api/src/participant-write.ts`                                                                           | `writeParticipantOp`, `writeParticipantAnswers`: compare-and-swap writes of the rule's output |
| `apps/api/src/routes/item-routes.ts`, `item-patches-route.ts`                                                 | Create, patch, move and patches at participate                                                |
| `apps/api/src/routes/sheet-route-kit.ts`, `sheet-write-route.ts`                                              | `cells` writes at participate                                                                 |
| `packages/agent-verbs/src/mcp/*`                                                                              | `share_project.role` takes three levels, default `participate`                                |
| `apps/editor/lib/editor-capabilities.ts`                                                                      | `resolveEditorCapabilities`, `EditorCapabilities`                                             |
| `apps/editor/app/project/[id]/*` (`useViewPreview`, `useEditorState`, `tab-save-flow`, `editor-page-helpers`) | `sessionRole: AccessLevel`; `can`; the participant save flow                                  |
| `apps/editor/components/chrome/RoleIndicator.tsx`, `app/project/[id]/useRoleIndicator.ts`                     | Participating pill                                                                            |

## Domain and naming

| Term                | Identifier                                                                        | Meaning                                                                       |
| ------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Access level        | `AccessLevel`, `ACCESS_LEVELS` (ascending); wire and column field `role` (SR1)    | What a link or embed admits                                                   |
| Viewer              | `'view'`; card **Viewer**, stub `VIEWER`, pill **Viewing**                        | Looks only; writes nothing                                                    |
| Participant         | `'participate'`; card **Participant**, stub `PARTICIPANT`, pill **Participating** | Takes part and changes content                                                |
| Editor              | `'edit'`; card **Editor**, stub `EDITOR`, pill **Editing**                        | Changes anything                                                              |
| Participation act   | `PARTICIPATION_OP_KINDS`, `PARTICIPATION_DELTA_KINDS`                             | A dot or a response                                                           |
| Participant content | `applyParticipantOp`                                                              | The rule a Participant's element change is applied under                      |
| Adder               | `addedBy` (element), `adderKeyFor`, `adderKey` (ticket), `X-Verified-Adder`       | Who added an element, as a server-derived key; only stamped for a Participant |
| Capabilities        | `EditorCapabilities` (`can`)                                                      | The editor's per-level flags; render only, never the rule                     |

Banned: "Collaborator" for the level (it was the working name; "collaborator" stays the roster's word for anyone
present), "commenter", "permission", "createdBy".

## Behaviour and state

The ladder is **view < participate < edit**. `levelAtLeast(level, min)` compares ranks. `parseStoredLevel(x)` is `x`
when it is one of the three, else `view`.

Doors by level (server):

| Door                                                                                     | Needs                             |
| ---------------------------------------------------------------------------------------- | --------------------------------- |
| Reads (project, tabs, images, comment threads, the Timeline); share resolve; make a copy | view                              |
| Room: presence (cursor, select, tab-focus, plan and sheet presence)                      | view                              |
| Comments: add, reply, resolve, reopen, delete own; card comments                         | participate (`deniedParticipate`) |
| Room: `vote`; `el-delta` `response`                                                      | participate                       |
| Room: `el` (`add`, `update`, `remove`) through the participant rule                      | participate                       |
| Items: create, patch, move, patches                                                      | participate (`gateParticipate`)   |
| Sheets: `writes` of kind `cells`                                                         | participate                       |
| Tab PUT, tab DELETE, project PUT; room `tab`, `tab-meta`, `project-meta`, `el` `reorder` | edit                              |
| Room: `dashboard-delta` (a Dashboard's layout)                                           | edit                              |
| Room: `el-delta` `check`, `board`, `comment-*`; `drag-preview`                           | edit                              |
| Items: bulk, delete, tally; item types; Sheets: create, delete, `layout`, `title`        | edit                              |

An Editor's `el` op is relayed as today. A Participant's `el` op takes the participant path:

1. **Gate.** The session's level is `participate`, the op's tab passes the tab-scope check, and the op kind is `add`,
   `update` or `remove`. A `reorder` is dropped.
2. **Queue.** The op joins the room's tab write queue (`tabWriteQueue`, SR2), so participant writes on a
   project run one at a time.
3. **Write.** `writeParticipantOp(env, { projectId, tabId, op, adderKey })` reads the stored tab, runs
   `applyParticipantOp` and compare-and-swaps the result (up to `TAB_CAS_MAX_ATTEMPTS`).
4. **Relay.** An `applied` op is sequenced from the sender to everyone but the sender when it equals what the sender
   sent, and to everyone including the sender when the rule changed it (SR3). A `refused` op sends the sender its
   `correction` alone. A failed write sends the sender `catchup { resync: true }`.

`applyParticipantOp(tab, op, adderKey)` (pure), returning `{ result: 'applied', tab, op } | { result: 'refused',
correction: ElementOp | null, reason }`:

| Op        | Applied when                                                                                                                                                    | Result                                                                                                                                                                              | Refusal correction                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `add`     | `addableOn(tab, element)`; `adderKey` present; id unused; layer (if any) exists and unlocked                                                                    | The element with `addedBy = adderKey`, inserted at `clamp(at)`                                                                                                                      | `remove` of the id (unless id existed)   |
| `update`  | The stored element exists, same type, not `locked`, its layer not locked                                                                                        | **Own** (`stored.addedBy === adderKey`): incoming, with `id`, `type`, `addedBy` and live fields kept from stored. **Other**: stored, with the permitted fields copied from incoming | `update` with the stored element         |
| `remove`  | The stored element exists, `addedBy === adderKey` or `removableByAnyone(tab, stored)` (any mind node; a mind connector, ends a mind node or gone), not `locked` | Element removed                                                                                                                                                                     | `add` of the stored element at its index |
| `reorder` | never                                                                                                                                                           | n/a                                                                                                                                                                                 | `reorder` with the stored ids            |

Permitted fields on another's element:

| Element                   | Fields                                                                                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any element carrying text | `label`, `richText` (`PARTICIPANT_TEXT_FIELDS`); never on a Behaviour (`participantWritesOn`, `BEHAVIOUR_SHAPES`)                                                                                         |
| `table`                   | also `cells`, only when every row keeps its length and the row count is unchanged                                                                                                                         |
| `sticky`, `image`         | also `x`, `y` (finite), `width`, `height` (positive) (`PARTICIPANT_PLACE_FIELDS`, `isParticipantPlaceable`)                                                                                               |
| `sticky`                  | also `fillColor`, `strokeColor`, `textColor`, `penTextColour` (`PARTICIPANT_STICKY_FIELDS`)                                                                                                               |
| `text` with `sizing` set  | also `width` and `height`: a text box that hugs its words follows them (SR10)                                                                                                                             |
| mind node                 | also `x`, `y` (`PARTICIPANT_MIND_FIELDS`): growing a map re-lays it; a taller `height` with a changed label, up to the stored height plus `MIND_GROW_PX_PER_CHAR` (`TEXT_PX_MAX` × 2) per label character |
| mind connector            | the `anchor` of `from` and `to`, each end still pinned to the same node                                                                                                                                   |
| `image`                   | also `imageId`, `naturalWidth`, `naturalHeight`, `alt`, `credit` (`PARTICIPANT_IMAGE_FIELDS`): its picture                                                                                                |

`addableOn(tab, el)`: `sticky`, `text` and `image` anywhere; a `shape` only as a mind node whose `mindParentId` names
a mind node on the tab; an `arrow` only pinned at both ends to mind nodes on the tab (a mind connector). An own
element's update must leave it `addableOn` the tab, else `refused` (`not-holdable`).

- An `update` whose merge equals the stored element is `applied` with no write (`unchanged`) and no relay.
- The applied tab must pass `isValidTab`; one that does not is refused with the stored element as correction.
- Live fields (`LIVE_ELEMENT_FIELDS`) always come from stored: answers travel as deltas, never through an update.
- An applied update's `op` is an `ElementPatchOp` (`{ kind: 'patch', id, set, clear? }`) of the fields that changed
  between stored and merged, a room-only op (`RoomElementOp`, `applyRoomElementOp`) that peers apply over their live
  copy. It is never the stored element whole: the stored tab can be behind an Editor's unsaved change.
- On its own element a Participant cannot change `locked`, and an update that lands it on a locked layer is refused
  `locked`.

Answers as self: a Participant's `vote` must name `voter` equal to its session's presence `key`, a `response`
delta `participantId` equal to it (`answersAsSelf`). Anything else is dropped.

Answers persistence: after the room sequences a Participant's `vote` or `response`, it schedules one
`writeParticipantAnswers` for that tab `ANSWERS_FLUSH_MS` later (coalesced per tab), which reads the stored tab,
applies `mergeLedgerAnswersIntoTab(tab, ledger)` and compare-and-swaps it, through the same queue. An Editor's
answers persist as today, through its own save.

Adder key: `adderKeyFor(projectId, ownerId)` is the first `ADDER_KEY_LENGTH` hex characters of
SHA-256(`liveplanner:adder:v1:<projectId>:<ownerId>`) (SR4). The ticket mint stores it on the ticket when the
effective level is `participate` and an owner resolves, and answers it beside the ticket (`RoomTicketResponse`) so the
editor knows which elements are its own; the upgrade forwards it as `X-Verified-Adder` and the project id as
`X-Verified-Project` (both set on every path, empty when none); the room keeps both on the attachment. A Participant
session always mints a ticket. A Participant session without one (an older
bundle's `?s=` upgrade, or a failed mint) may update but never add or remove (SR5).

Editor state:

| Flag            | Value                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| `sessionRole`   | owner: `edit`; link: its level; embed: `edit` stays, anything else `view`    |
| `canEdit`       | `sessionRole === 'edit' && !viewPreview` (unchanged)                         |
| `isReadOnly`    | `!canEdit` (unchanged): every structural gate stays shut for a Participant   |
| `can`           | `resolveEditorCapabilities({ level, adderKey })`, in `useParticipantSession` |
| Pill level      | `viewPreview ? 'view' : sessionRole`                                         |
| `canToggleRole` | `sessionRole === 'edit'` (unchanged)                                         |

`EditorCapabilities` for a session that is not an Editor; an Editor holds every flag:

| Flag            | participate                                                    | view  |
| --------------- | -------------------------------------------------------------- | ----- |
| `takePart`      | true                                                           | false |
| `addContent`    | true (sticky and text)                                         | false |
| `writeText(el)` | true unless `el.locked` or a Behaviour                         | false |
| `move(el)`      | a sticky, image, mind node or own; not locked                  | false |
| `resize(el)`    | a sticky, image or own; not locked                             | false |
| `recolour(el)`  | `el.type === 'sticky'` or own                                  | false |
| `remove(el)`    | own (`el.addedBy === selfAdderKey`) or a mind node; not locked | false |
| `planCards`     | true                                                           | false |
| `sheetCells`    | true                                                           | false |

A Participant's commit: `editsBlocked` is false for a Participant (its gestures open through `can`), so every commit
passes `guardCommit`, which runs `participantTabChange(before, after, adderKey)`: the change lands, with `addedBy`
stamped on what it adds, only when the rule would take it unchanged; anything the room would refuse or trim is
held back. Running a session stays shut through `sessionStartBlocked` (`isReadOnly`, `EditorCanvasHost`).

A Participant's save: the autosave runs for a Participant, but takes the participant branch
(`relayParticipantChanges`): the ops are `diffToElementOps(before, after)` without `reorder`, sent over the socket as
`el` ops; no tab PUT, no tab delete, no project metadata, no whole `tab`. The socket being closed fails the save,
which the autosave retries as today; the unload flush sends the same ops at once.

Hooks that write a tab's structure, or write without passing `commit`, take `structureBlocked`
(`editsBlocked || isReadOnly`) or `structureCreateBlocked` (`createBlocked || isReadOnly`), never the opened
`editsBlocked`: layers, lane settling, the old Plan tour content's sweep, element helpers, tab canvas, images, mind maps,
swatch overrides, the cleanup preview and library inserts.
A held-back commit shows `HELD_BACK_NOTICE` at most once per `HELD_BACK_NOTICE_MS`.

Gestures opened for a Participant, each beside `isReadOnly` (Plan shows no palette, so none comes from one): inline text edit (`canWriteText`); a move drag (`canMove`, never a resize); the Delete, type-to-edit and Space-to-edit keys; the quick-style panel for what `recolour` admits (`canStyle`); answering session tools (`takePart`). Plan: `canEditCards` (add, edit, move) beside `canEdit` (structure) and `canRetire` (Trash, Archive, the type editor). Sheets: `canEdit` writes cells, `canShape` (an Editor) changes rows, columns, settings and the title; the controller's `write` refuses the rest.

Invariants:

- **I1** Every level gate compares through `levelAtLeast`; no gate reads `role === 'edit'` by itself.
- **I2** Every reader parses through `parseStoredLevel`: an unknown level reads as `view`.
- **I3** A Participant's content change reaches the plan's store and peers only through `applyParticipantOp`.
- **I4** `addedBy` is written only by `applyParticipantOp`, from the room's verified adder key; an Editor's save
  keeps whatever the stored element carries.
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

`packages/project/src/participant-content.ts`:

```ts
export const PARTICIPANT_ADDABLE_TYPES: readonly ['sticky', 'text', 'image', 'shape', 'arrow'];
export const PARTICIPANT_MIND_FIELDS: readonly ['x', 'y'];
export const MIND_GROW_PX_PER_CHAR: number; // TEXT_PX_MAX * 2
export const PARTICIPANT_IMAGE_FIELDS: readonly [
  'imageId',
  'naturalWidth',
  'naturalHeight',
  'alt',
  'credit',
];
export function addableOn(tab: Tab, el: Element): boolean;
export function participantWritesOn(el: Element): boolean;
export function removableByAnyone(tab: Tab, el: Element): boolean;
export const PARTICIPANT_TEXT_FIELDS: readonly ['label', 'richText'];
export const PARTICIPANT_PLACE_TYPES: readonly ['sticky', 'image'];
export const PARTICIPANT_PLACE_FIELDS: readonly ['x', 'y', 'width', 'height'];
export function isParticipantPlaceable(el: Element): boolean;
export const PARTICIPANT_STICKY_FIELDS: readonly [
  'fillColor',
  'strokeColor',
  'textColor',
  'penTextColour',
];
export type ParticipantOpResult =
  | { result: 'applied'; tab: Tab; op: ElementOp; changed: boolean }
  | { result: 'refused'; correction: ElementOp | null; reason: ParticipantRefusal };
export type ParticipantRefusal =
  | 'tab-locked'
  | 'not-addable'
  | 'no-adder'
  | 'id-taken'
  | 'missing'
  | 'type-changed'
  | 'locked'
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
  req: { projectId: string; tabId: string; op: ElementOp; adderKey: string | null },
): Promise<ParticipantWriteResult>;
export function writeParticipantAnswers(
  env: Env,
  req: { projectId: string; tabId: string; ledger: TabLedger },
): Promise<{ ok: true; changed: boolean } | { ok: false; status: 404 | 409 | 413 }>;
```

REST: `POST /api/projects/:id/share` takes `role?: 'view' | 'participate' | 'edit'`, omitted `edit`; anything else is
400 `invalid role`. `GET /api/share/:code` answers `role: AccessLevel`. `POST .../room-ticket` answers
`RoomTicketResponse { ticket, adderKey? }`, the key only for a Participant.

MCP: `share_project.role` is `z.enum(['view', 'participate', 'edit']).optional()`, default `participate`; the
description reads `"participate" (default): recipients add stickies, write and vote but cannot reshape it. "view":
they only look, with no comments or votes. "edit": they can change anything.`

## Data and persistence

| Field                             | Class      | Notes                                                             |
| --------------------------------- | ---------- | ----------------------------------------------------------------- |
| Share link and direct share level | credential | The index's, not this app's; `view`, `participate` or `edit`      |
| Room ticket level                 | ephemeral  | The effective level, in the index's grant the ticket carries      |
| Adder key                         | ephemeral  | Worked out per person at the ticket (`adderKeyFor`); not stored   |
| Element `addedBy`                 | content    | Optional, ≤ `ADDER_KEY_LENGTH` chars; on `sticky` and `text` only |
| Room attachment `adderKey`        | ephemeral  | Per socket, survives hibernation                                  |

Share links and direct shares, with their level, live in liveworkspace's index; this app has no D1 and stores
neither. Readers take `parseStoredLevel` on the level a grant or session carries. Copies,
exports, templates and duplicates keep `addedBy` as data (it identifies nobody outside its project); a Make a copy
lands in a new project, where no adder key matches it.

## Errors and edge cases

- **E1** `POST /share` with `role: 'admin'`, `null` or a number: 400, nothing written.
- **E2** An editor bundle older than this change opens a Participant link: it reads the level as edit, shows edit
  controls, its tab PUT is refused 403 and `writesForbiddenRef` stops its autosave; its room ops below the
  participant classes are dropped.
- **E3** A Participant adds a shape (crafted client): refused `not-addable`; the sender gets `remove`.
- **E4** A Participant deletes an Editor's sticky: refused `not-own`; the sender gets the sticky back at its index.
- **E5** A Participant resizes an Editor's shape while editing its label: applied as the label alone; the sender gets
  the merged element.
- **E6** A Participant edits an element an Editor deleted meanwhile: refused `missing`, no correction (the Editor's
  remove reaches the sender too).
- **E7** A Participant edits a locked element: refused `locked`, correction the stored element.
- **E8** The write loses the compare-and-swap `TAB_CAS_MAX_ATTEMPTS` times, the tab is gone, or the tab is over its
  cap: the sender gets `catchup { resync: true }`; nothing is relayed.
- **E9** A Participant socket without an adder key adds a sticky: refused `no-adder`.
- **E10** A Participant socket sends `tab`, `tab-meta`, `reorder`, `check`, `board` or `drag-preview`:
  dropped.
- **E11** A tab-scoped Participant link: its ops on another tab are dropped by the scope check first.
- **E12** An embed of a Participant link: renders as a Viewer (SR6).
- **E13** A Participant's text in a table reshapes `cells` (adds a row): the merge keeps the stored cells.
- **E14** A Participant's Sheet `layout` or `title` write, or an item delete: 403.
- **E15** A Participant edits an element an Editor added within its autosave window (not stored yet): refused
  `missing`; the sender re-hydrates.
- **E16** A socket with `PARTICIPANT_PENDING_MAX` writes waiting sends another: refused, the sender re-hydrates.
- **E17** A Participant's card create carrying `votes`, a restored thread or a `key`: 403 (`isItemEditor`).
- **E18** An Editor duplicates or pastes a Participant's sticky: the copy has no `addedBy` (`freshCopyFields`).
- **E19** A Participant's dot or response naming another key: dropped.

## Security and trust

- The level is resolved on the server (grant, ticket, `X-Verified-Role`) and enforced per door; the editor's `can` is
  presentation only (I6).
- Every trust header the upgrade forwards, `X-Verified-Adder` included, is set on every path so a client cannot
  supply its own.
- `addedBy` is derived from the caller's identity on the project and the project id, so it cannot be turned back
  into an owner id and differs per project; a Participant cannot claim another's element by writing `addedBy`
  (the rule keeps the stored value).
- A Participant's dots and answers carry a client-chosen key, as an Editor's do today ([Later](../share-roles.md#later)).
- Rate: room frames ride `OP_RATE_CAP`; each applied op is one read and one compare-and-swap.

## Performance and limits

- `isParticipationOp` and the op class check are constant-time on `op.kind` and `delta.kind`.
- A Participant op costs one read and one compare-and-swap write of the tab row (≤ `MAX_TAB_BYTES`), serialised
  per project on the tab write queue. Measured CPU for one op (parse, rule, stringify): 0.23 ms on a 200-element
  board (23 KB), 2.2 ms at 2,000 elements (242 KB), 4.5 ms at 5,000 (611 KB). The editor's commit guard
  (`participantTabChange`) costs 0.10 ms, 1.5 ms and 1.6 ms on the same tabs, once per commit.
- The autosave's 600 ms debounce batches a person's typing into one op per element. What is not bounded is store round
  trips: one per op, so a multi-element move by one Participant is several writes, and a room of people all writing
  at once queues behind one another. Recorded as a risk; the mitigation, if it bites, is to batch a socket's ops per
  tab into one write.
- `ANSWERS_FLUSH_MS` coalesces a burst of dots into one write per tab.
- `applyParticipantOp` is linear in the tab's element count for one op.

## Presentation and UX

Share dialog cards, in `LEVEL_ORDER = ['edit', 'participate', 'view']`:

| Level       | Title / blurb                                                                         | Stub          | Glyph              | Solid (stub)                                 |
| ----------- | ------------------------------------------------------------------------------------- | ------------- | ------------------ | -------------------------------------------- |
| edit        | **Editor** / "Plans with you in real time."                                           | `EDITOR`      | `lucidePencilLine` | as today                                     |
| participate | **Participant** / "Works cards and cells, comments and votes. Can't reshape a board." | `PARTICIPANT` | `lucideVote`       | `bg-teal-700 text-white dark:bg-teal-600/60` |
| view        | **Viewer** / "Watches along. Can't comment, vote or change a thing."                  | `VIEWER`      | `lucideEye`        | as today                                     |

- Three cards, one per row at every width (SR8); the pass stub widens to fit `PARTICIPANT` (SR7).
- Arrow keys step through `LEVEL_ORDER`, wrapping; Home and End reach the ends.
- Pill: **Participating**, `bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200`, the vote glyph; static.
- A Participant's palette strip: the selection-mode dropdown (Select, Hand, Zen), the category picker holding **Participate** alone (ballot glyph, "Add stickies and text to the board."),
  and its tiles; tab add, rename and delete and context menus' structural rows are absent.
- A Viewer sees no comment composer, resolve or delete (`CommentThreadPopover canComment`), no card votes or
  comments. Its selection holds nothing
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
| `[participant-write] refused <projectId> <tabId> <reason>` | room (info)              |
| `[participant-write] failed <projectId> <tabId> <status>`  | room (error)             |
| `[participant-write] answers <projectId> <tabId> <ok>`     | room (debug)             |
| `[participant] change held back <tabId>`                   | editor (debugLog)        |

## Testing

| Rule                                                            | Test                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Ladder, `parseStoredLevel`, telemetry types                     | `packages/api-schema/src/access-levels.test.ts`                    |
| Op classes                                                      | `packages/api-schema/src/room-messages.test.ts`                    |
| Every row of the participant rule, every refusal and correction | `packages/project/src/participant-content.test.ts`                 |
| `addedBy` validation                                            | `packages/project/src/validate.test.ts`                            |
| `mergeLedgerAnswersIntoTab`                                     | `packages/project/src/collab-ledger.test.ts`                       |
| Write: applied, unchanged, refused, CAS retry, 404, 409, 413    | `apps/api/src/participant-write.test.ts`                           |
| Room: op gate per level; participant path; adder header         | `apps/api/src/project-room.test.ts`, `project-room-routes.test.ts` |
| Items and Sheets doors at participate                           | `apps/api/src/routes/item-routes.test.ts`, `sheet-routes.test.ts`  |
| Capabilities per level                                          | `apps/editor/lib/editor-capabilities.test.ts`                      |
| Participant save branch                                         | `apps/editor/app/project/[id]/tab-save-flow.test.ts`               |
| Pill per level                                                  | `apps/editor/components/chrome/RoleIndicator.test.tsx`             |
| MCP default and enum                                            | `packages/agent-verbs` MCP schema tests                            |

## Constants and configuration

| Constant                    | Value                                           | Provenance                                     | Safe range          |
| --------------------------- | ----------------------------------------------- | ---------------------------------------------- | ------------------- |
| `ACCESS_LEVELS`             | `['view', 'participate', 'edit']`               | Spec, ascending                                | fixed               |
| `DEFAULT_LINK_LEVEL`        | `'edit'`                                        | Spec: an omitted role is edit                  | fixed               |
| `DEFAULT_MCP_SHARE_LEVEL`   | `'participate'`                                 | Spec                                           | fixed               |
| `LEVEL_ORDER`               | `['edit', 'participate', 'view']`               | Spec's card order                              | fixed               |
| `PARTICIPANT_ADDABLE_TYPES` | `['sticky', 'text', 'image', 'shape', 'arrow']` | Spec (shape and arrow narrowed by `addableOn`) | grows with the spec |
| `TAB_CAS_MAX_ATTEMPTS`      | 8                                               | A bound on lost swaps                          | 3 to 20             |
| `ADDER_KEY_LENGTH`          | 32                                              | 128 bits of hex (SR4)                          | 16 to 64            |
| `ANSWERS_FLUSH_MS`          | 1500                                            | SR9                                            | 250 to 10000        |
| `PARTICIPANT_PENDING_MAX`   | 64                                              | SR12                                           | 8 to 512            |
| `HELD_BACK_NOTICE_MS`       | 4000                                            | SR13                                           | 1000 to 30000       |

No new environment variable or binding.

## Assets and external resources

No new asset. The Participant glyph is `lucideVote`, already vendored in `../packages/icons/src/lucide.generated.ts`
from Lucide (ISC licence).

## Defaults ledger

SR1 to SR13 in [DEFAULTS.md](DEFAULTS.md).
