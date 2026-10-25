# Share roles

**Status: built (Viewer, Participant, Editor links); token levels, ownership powers and collaboration keys still
ahead ([Later](#later)).**

Everyone who reaches a design without owning it, by a share link or an embed, does so at one of three **access
levels**: **Viewer**, **Participant** or **Editor**. **Ownership** is not a level: it is a set of powers over the
design, held apart from editing. The research behind this is in `docs/research/access-levels/`.

## Why

Someone gathering feedback on a logo or a set of wireframes has to hand the team an edit link so they can comment, drop
a sticky beside a page and fix a typo. An edit link also lets them restyle the pages, move the layout around and
delete what others made, and in a busy review somebody does. A view link is no answer either: it cannot comment or
add a sticky. The Participant level is the middle: take part in the design, never reshape it.

## The levels

| Level           | Wire name     | May                                                                                                                                                                                                                                                       |
| --------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Viewer**      | `view`        | Look only: open and read every tab it admits; pan, zoom, point, use the laser and spotlight, follow and be followed, appear in the presence stack, export. Writes nothing: no comment or reaction.                                                        |
| **Participant** | `participate` | All of Viewer; comment, reply, resolve and reopen; react; add, write and arrange stickies and text; place images and swap their pictures; write on any element, a table's cells included (see [What a Participant changes](#what-a-participant-changes)). |
| **Editor**      | `edit`        | All of Participant; change anything on the pages, its tabs and its tools' configuration.                                                                                                                                                                  |

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

- **"It added"** means the server recorded the Participant as the element's adder when the element was created.
  An element an Editor added, or one added before this level existed, belongs to nobody a Participant can claim.
- **Stickies and images are the content**, so a Participant arranges them whoever added them: moves and resizes
  them. Shapes, frames, connectors and someone else's text boxes (which often carry the layout) stay where
  their author put them; a text box that sizes to its words still follows them when a Participant writes on it.
- **Nothing offers what a session cannot do.** A Participant or Viewer sees no page panel or page actions. Empty states describe
  instead of instructing: a comment thread invites only someone who may add. A Viewer's
  selection toolbar offers **Show Comments** on an element that has comments, to read them, and no comment button
  on one that has none (a Participant's offers **Add Comment** everywhere).
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
library. Sharing (creating, revoking and rescoping links, the share password) stays with the owner; delete, Trash
and moves stay with the owner and joined team members. No level grants any of them. The full ownership model is
[Later](#later).

## Share links

- The Share dialog offers three role cards, in this order: **Editor** ("Draws with you in real time."),
  **Participant** ("Adds stickies, writes and comments. Can't reshape the pages.") and **Viewer** ("Watches, pans
  and zooms. Can't comment or change a thing."). A pass's header band prints `EDITOR`, `PARTICIPANT` or `VIEWER`, each with a
  glyph and a colour that meets WCAG 2.2 AA against its word ([Live app](../007-editor/live-app.md#share-dialog)).
- `POST /api/designs/:id/share` takes `role: 'view' | 'participate' | 'edit'`; an omitted role is `edit`, as today.
- The editor's role pill reads Editing, Participating or Viewing.
- **A visit is through one link.** Opening a design through a share link records that link with the visit
  (`shared_with.share_code`). Shared with you, Home and every leg that reads a past visit open the design through
  that same link only while it is live. **Revoking a link** (or deleting the tab it is scoped to) ends every visit it
  granted: those people lose the design from Shared with you, and from the copy and activity legs, even when
  another link of the same level is still live; a newer link reaches them only if they open it. A visit recorded
  before links were recorded keeps the older rule (the oldest live link of its level and scope) until its next open.
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
- The MCP's `share_design` creates a **Participant** link when no level is named.

## Integrity

- **Participation is its own class of room op**, between presence (anyone) and mutation (editors): every mutation
  from a Participant's socket is dropped; its content goes through the server (below).
- **Content goes through the server.** A Participant never saves a whole tab and never relays element changes over
  its socket: it sends them to the server, which applies the rule, stores the result, and relays what it accepted
  to everyone.
- **The adder is stamped by the server**, never read from the request, from the caller's identity on the design.
  A copy is nobody's addition: duplicating or pasting an element never carries its adder along.
- **Peers take only what a Participant changed.** The room relays a Participant's update as the fields it changed,
  never the stored element whole, so an Editor's change that has not been saved yet is never undone by it.
- **A held-back gesture says so.** When the editor holds back a change a Participant may not make (deleting
  someone else's sticky, resizing a shape), it shows one short notice for the burst rather than failing silently.
- A guest who signs in becomes a different adder: stickies added as a guest can no longer be deleted by them.

## Moving to three levels

- **Edit links stay Editor; view links stay Viewer, which now only looks.** A view link handed out before this
  change loses commenting (decided 2026-10-10): an owner who wants an audience to
  chime in issues a Participant link.
- **No old reader escalates.** Before the server can write a `participate` link, every reader of a stored level
  reads an unknown value as Viewer. An editor bundle from before this change reads a Participant link as Editor,
  shows editing controls, and the server refuses its first save; a reload fixes it.

## Telemetry

`Document·Shared` and `Document·Joined` take the type `Participate` beside `Edit` and `View`
([Telemetry](../017-telemetry/telemetry.md)).

## Later

Specified in the research and not built yet:

- **Token levels**: API tokens carry view, participate or edit instead of the read-only flag.
- **Ownership powers** as a named set every door asks beside the level.
- **Server-derived collaboration keys**, pinned per socket, so nobody can act as someone else's session.

## Domain language

**Participant** is this access level. A person's profile (kept by the liveworkspace accounts Worker) is their **display identity**
(name, colour); prose calls them that, never "participant" ([Domain language](../003-system-architecture/domain-language.md)).
