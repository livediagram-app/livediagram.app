# Fact sheet

The canonical facts all marketing copy is built from. If something
below stops being true, fix it here first, then propagate to the taglines and
descriptions. Mirrors [Build phase](../../docs/specs/005-project-roadmap/prototype-scope.md)
and [Purpose](../../docs/specs/001-project-vision/purpose.md).

## One line

A collaborative diagram editor that works without signing in. Open a link,
draw, share.

## What it is

A real-time multiplayer canvas in the browser for building diagrams and
mindmaps together. The canvas never sits behind an auth wall, so the friction
to start is "open the link, start drawing."

## Who it's for

Teams that think visually together: engineers sketching architecture and system
designs, product and design teams mapping journeys and brainstorms, and
cross-functional groups in workshops, planning, and retros. The unit of value
is the team, not the individual.

## What it does

- Real-time multiplayer: live cursors, selection rings, comment threads, and
  laser-pointer broadcast, one Durable Object room per document.
- Canvas: ten core shapes, sticky notes, text, images, arrows (straight /
  curved / angled with draggable handles, configurable thickness and arrowheads,
  optional labels), a Freehand pen and a Shape Pen that turns rough strokes
  into clean shapes, per-element links and locks.
- Multi-select: marquee drag, shift-click, format painter, groups.
- 82 templates (Blank, Mind map, Flowchart, Gantt, SWOT, Retrospective, Org
  chart, Timeline, Fishbone, Pyramid, Flywheel, Venn, User journey).
- 30 themes (24 in the picker, plus 6 seasonal ones) that recolor the whole
  canvas in one click.
- Undo and redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z), personal to each editor.
- Tabs per document (link across them, copy a tab into another document), nested
  folders in the Explorer.
- Teams: shared team spaces with their own folders, members and invites.
- Share links with three roles (Editor, Participant, Viewer), an optional
  expiry and password, revocable any time. "Shared with you" visitors can make
  their own copy.
- Export the active tab as a livediagram JSON file, Mermaid, Markdown,
  Excalidraw, PNG, SVG or PDF; import JSON, Mermaid, Markdown, Excalidraw and
  draw.io files.
- Email notifications (comments, mentions, assigned actions, replies to team invites),
  each with its own switch.
- Hybrid auth: guests get the full feature set keyed to a per-browser id;
  signed-in users (a liveworkspace account) add cross-device sync and account self-delete.
- The Community at `/community`: a public gallery of documents people share.
  Signed-in owners publish a document with a title, description, category and
  tags (anonymously by default); anyone can search it, open a document
  read-only, like it and make their own copy. Posts stay in step with later
  edits, and enough reports from different people take a post down for good.
- Anonymous first-party telemetry with a public dashboard (`/telemetry` opens
  it on liveworkspace.app). No third-party analytics, no identifiers on the
  wire.

## Open source and price

- MIT-licensed and publicly viewable.
- Hosted free at livediagram.app. No paid tier and no plan to introduce one.
- The OSS core never calls home and never gates features behind a license
  check. Sign-in through liveworkspace accounts is the one optional dependency;
  without it the app degrades to full-featured guest mode.

## Stack

Runs entirely on Cloudflare: Workers for the API and routing, a Durable Object
per document for its content and its realtime room, Workers Static Assets for
the Next.js frontends. No Node-hosted backend, no SSR.

## Do not claim

- Conflict-free (CRDT) editing. Edits to different elements merge; two people
  changing the same element at the same moment is last-writer-wins, by design.
- A paid tier, or any feature reserved for one.

## Links

- Hosted: https://livediagram.app
- Editor: https://livediagram.app/new
