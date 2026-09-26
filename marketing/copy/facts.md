# Fact sheet

The canonical, true-today facts all marketing copy is built from. If something
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

## Shipped today

- Real-time multiplayer: live cursors, selection rings, comment threads, and
  laser-pointer broadcast, one Durable Object room per diagram.
- Canvas: ten core shapes, sticky notes, text, images, arrows (straight /
  curved / angled with draggable handles, configurable thickness and arrowheads,
  optional labels), freehand Pencil tool with optional shape recognition,
  per-element links and locks.
- Multi-select: marquee drag, shift-click, format painter, groups.
- 17 templates (Blank, Mind map, Flowchart, Kanban, SWOT, Retrospective, Org
  chart, Timeline, Fishbone, Pyramid, Flywheel, Venn, User journey, Logo
  design, plus three UI wireframes).
- 18 themes that recolor the whole canvas in one click.
- Per-tab activity log with one-click surgical revert on any entry, even after
  later edits.
- Tabs per diagram (link across them, copy a tab into another diagram), nested
  folders in the Explorer.
- Editor or view-only share links, revocable any time. "Shared with you"
  visitors can make their own copy.
- Export / import the active tab to Markdown / PDF / PNG / JSON.
- Hybrid auth: guests get the full feature set keyed to a per-browser id;
  signed-in users (Clerk) add cross-device sync and account self-delete.
- Anonymous first-party telemetry with a public dashboard at `/telemetry`. No
  third-party analytics, no identifiers on the wire. Off in self-hosted forks
  unless configured.

## Open source and price

- MIT-licensed, publicly viewable, self-hostable end to end.
- Hosted free at livediagram.app. No paid tier and no plan to introduce one.
- The OSS core never calls home and never gates features behind a license
  check. Clerk auth is the one optional SaaS dependency; without it the app
  degrades to full-featured guest mode.

## Stack

Runs entirely on Cloudflare: Workers for the API and routing, D1 for storage,
Durable Objects for realtime, Static Assets for the Next.js frontends. No
Node-hosted backend, no SSR.

## Not yet shipped (do not imply these exist)

- Team workspaces (a diagram belongs to one identity today).
- Transactional email (Resend).
- Operational transform / CRDT (realtime is last-writer-wins today).

## Links

- Hosted: https://livediagram.app
- Editor: https://livediagram.app/live
