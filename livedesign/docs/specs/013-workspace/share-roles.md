# Share roles

Status: shipped

Everyone who reaches a design without owning it, by a share link or an embed, does so at one of three **access
levels**: **Viewer**, **Participant** or **Editor**. **Ownership** is not a level: it is a set of powers over the
design, held apart from editing. The research behind this is in `docs/research/access-levels/`.

## Why

Someone gathering feedback on a logo or a set of wireframes has to hand the team an edit link so they can comment, drop
a sticky beside a page and fix a typo. An edit link also lets them restyle the pages, move the layout around and
delete what others made, and in a busy review somebody does. A view link is no answer either: it cannot comment or
add a sticky. The Participant level is the middle: take part in the design, never reshape it.

## The levels

| Level           | Wire name     | May                                                                                                                                                                                                                                                                           |
| --------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Viewer**      | `view`        | Look only: open and read every tab it admits; pan, zoom, point, use the laser and spotlight, follow and be followed, appear in the presence stack, export, inspect a wireframe ([Inspect](../007-editor/wireframe-pages.md#inspect)). Writes nothing: no comment or reaction. |
| **Participant** | `participate` | All of Viewer; comment, reply, resolve and reopen; react; add, write and arrange stickies and text; place images and swap their pictures; write on any element, a table's cells included (see [What a Participant changes](#what-a-participant-changes)).                     |
| **Editor**      | `edit`        | All of Participant; change anything on the pages, its tabs and its tools' configuration.                                                                                                                                                                                      |

- **The levels are a ladder**: every level holds everything below it.
- **A Viewer only looks.** A comment and a reaction are both taking
  part, which is a Participant's. A Viewer's selection shows its badge and holds nothing: it never stops anyone
  editing the element it looks at.
- **A checklist tick is editing**: it is one shared value, not a person's answer.

## What a Participant changes

A Participant changes the design's **content**, never its **shape**.

| May                                                                                                 | Never                                                                                                                                               |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add a sticky, a text element or an image                                                            | Add any other element: shapes, connectors, frames, templates, kits, page layouts                                                                    |
| Write on any element: change its text (a sticky's, a shape's label, a table's cells)                | Change any other field of an element it did not add: size, style, rotation, layer, lock                                                             |
| Move and resize any sticky or image; recolour any sticky; swap any image's picture                  | Move, resize or restyle anything else, text boxes included; turn (rotate) anything someone else added                                               |
| Delete anything it added itself                                                                     | Delete anything someone else added                                                                                                                  |
| Change anything about what it added (size, style, text), so long as it stays something it could add | Reorder layers; group; lock                                                                                                                         |
| Undo and redo its own changes (the room puts back any part it may not make)                         | Undo or redo anyone else's                                                                                                                          |
| Nothing about tabs or pages                                                                         | Add, rename, reorder or delete tabs or pages; change a tab's theme, canvas or finish; change a page's size, background or layout; rename the design |

- **"It added"** means the server recorded the Participant as the element's adder (`addedBy`) when the element was
  created. An element an Editor added belongs to nobody a Participant can claim.
- **Stickies and images are the content**, so a Participant arranges them whoever added them: moves and resizes
  them. Shapes, frames, connectors and someone else's text boxes (which often carry the layout) stay where
  their author put them; a text box that sizes to its words still follows them when a Participant writes on it.
- **Nothing offers what a session cannot do.** A Participant or Viewer sees no page panel or page actions. Empty states describe
  instead of instructing: a comment thread invites only someone who may add. A Viewer's
  selection toolbar offers **Show Comments** on an element that has comments, to read them, and no comment button
  on one that has none (a Participant's offers **Add Comment** everywhere). A right-click on an element (a long-press
  on a touch screen) opens its element menu for every role, holding only what the role may do: an Editor's is the
  full menu; a Participant's offers **Add Comment** (or **View Comments**), **Edit Text** on what it may write on, and
  **Open Link**, **View Note** and **Copy Text** where the element has them; a Viewer's the same without **Edit Text**,
  and **Show Comments** only on an element with comments ([Element menu for Participants and Viewers](../008-canvas/element-menu-quick-bar.md#element-menu-for-participants-and-viewers)).
- **The server is the rule.** A Participant's content changes travel as element changes the server applies one by
  one against the stored tab: a permitted change lands, a forbidden field is left as stored, a forbidden add or
  delete is refused. A stale screen therefore never writes an old copy of a tab over a newer one.
- **Undo** takes back the Participant's own steps; an undo that would make a forbidden change is refused like any
  other.
- **A chord the role may not run stays the canvas's.** A Viewer's or Participant's Cmd/Ctrl+A, +D, +Shift+L and the
  z-order chords do nothing rather than reaching the browser, which selected the page's text or opened the bookmark
  dialog; copy stays the browser's, so text on the page can still be copied.

## Building a new feature

Every feature a shared design can reach states, in its own spec, what an Editor, a Participant and a Viewer may do
with it, and is gated and tested to match ([Gate a feature by share role](../../instructions/gate-a-feature-by-share-role.md)).
The defaults: a Viewer only looks; a Participant takes part and adds content but never reshapes the design or
changes settings; the rest is an Editor's. The role tests (the participant rule's leak test, the editor
capabilities, the Participant palette, the room) keep a new feature from widening a role by accident.

## The Participant palette

- **One category, Participate**, holding just what a Participant may add, as the palette's own tiles: Sticky and
  Text, then Image. No Search, no More. Each tile works as an Editor's does: dragged onto the
  canvas it lands where it is let go; pressed, it arms a tap to drop or a drag to draw; its key (as the tiles show) arms it the same way, and no other add key runs (`PARTICIPANT_KEYS`).
- **The selection modes it needs**: Select, Hand, Laser, Spotlight and Zen. Format Painter is an
  Editor's.

## Ownership

Ownership is a set of powers, held by the design's **owner**: its creator, or whoever moved it into their own
library. Sharing (creating, revoking and rescoping links, the share password) stays with the owner (and, on a team
design, every joined member); delete, Trash and moves stay with the owner and joined team members. No level grants
any of them. Who owns an item and who may reach it is liveworkspace's index's
([one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md)).

## Share links

- Links are liveworkspace's index's: one link carries a level, `view`, `participate` or `edit`, and optionally one
  tab ([one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Sharing and access").
  The shared Share dialog (`LEVEL_PASS` in `packages/explorer/src/dialogs/share/parts.tsx`) offers the three in this
  order: **Editor** ("Works with you in real time."), **Participant** ("Comments, votes and works items. Can't
  reshape it.") and **Viewer** ("Watches along. Can't comment or change a thing."), a new pass starting as an
  Editor's ([Live app](../007-editor/live-app.md#share-dialog)).
- The api reads the level off the index's grant on every request and room socket (`X-Index-Grant`).
- The editor's role pill reads Editing, Participating or Viewing.
- **A visit is through one link.** The index records which link a visit came through; Shared With Me and Home open
  the design through that same link only while it is live. **Revoking a link** (or rescoping it) ends every visit it
  granted: the index asks the design's room to close those sockets (`revokeCodes`), and those people lose the design
  from Shared With Me even when another link of the same level is still live.
- **Losing access is explained, never silent.** A session open on a revoked pass leaves for the Explorer, which shows
  a warning toast ("The link you opened that design with was revoked, so it is no longer open to you."). A session
  ended by an access change (a team removal, a share password, [API](../015-api/api.md) "Access changes end the
  sessions they affect") reloads into the access check, and a refusal then reads **No Longer Shared With You** ("Your
  access to this design was removed while you had it open. Ask its owner to share it with you again.") instead of
  "doesn't exist or isn't yours". The editor notes the reason in `sessionStorage` just before it goes and the first
  page after takes it once (`apps/live/lib/access-notice.ts`, honoured for a minute).
- The collaborators list badges each person Editor, Participant or Viewer; "Shared with you" chips read Edit,
  Participate or View.
- **Embeds look only below Editor**: an embed of a Participant link renders as a Viewer, since an embed has no
  identity screen to put a name on what it adds ([Embeds](embeds.md)).
- The MCP's `share_design` creates a **Participant** link when no `role` is named
  (`packages/agent-verbs/src/mcp/schema.ts`).

## Integrity

- **The room gates every op by kind** (`gateClientOp`, `apps/api/src/room-op-gate.ts`): a presence op passes from
  anyone (a Viewer's reaction is dropped); every other op needs edit, except a Participant's `el` op, which the room
  applies through the participant content rule (`applyParticipantOp`, `packages/design/src/participant-content.ts`,
  written by `writeParticipantOp`, `apps/api/src/participant-write.ts`).
- **Content goes through the server.** A Participant never saves a whole tab: each element change it sends is
  applied by the room against the stored tab (a compare-and-swap on the tab's revision, retried up to
  `TAB_CAS_MAX_ATTEMPTS`, 8), stored, and relayed as what was accepted.
- **The adder is stamped by the server**, never read from the request, from the caller's identity on the design.
  A copy is nobody's addition: duplicating or pasting an element never carries its adder along.
- **Peers take only what a Participant changed.** The room relays a Participant's update as the fields it changed,
  never the stored element whole, so an Editor's change that has not been saved yet is never undone by it.
- **A held-back gesture says so.** When the editor holds back a change a Participant may not make (deleting
  someone else's sticky, resizing a shape), it shows one short notice for the burst rather than failing silently.
- A guest who signs in becomes a different adder: stickies added as a guest can no longer be deleted by them.

## Telemetry

`Document·Shared` and `Document·Joined` take the type `Participate` beside `Edit` and `View`
([Telemetry](../017-telemetry/telemetry.md)).

## Outside the levels

- **API tokens** carry a read-only flag, not a level ([Public API and API tokens](../015-api/public-api-and-tokens.md)).
- **Collaboration keys** are the client's own per-session keys; the server does not derive them.

## Domain language

**Participant** is this access level. A person's profile (kept by the liveworkspace accounts Worker) is their **display identity**
(name, colour); prose calls them that, never "participant" ([Domain language](../003-system-architecture/domain-language.md)).
