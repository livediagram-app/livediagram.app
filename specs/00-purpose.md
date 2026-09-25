# Purpose

livediagram is a web app where teams build **diagrams together, in real time**.

This is the root of the spec tree: every other spec is a decision taken inside
the boundaries set here. That only works if it stays true, so it carries a
[record of the boundaries that have moved](#boundaries-that-have-moved) rather
than quietly describing a product that no longer exists.

## What it is

A multiplayer canvas in the browser. Anyone with access to a diagram can join,
see other collaborators' cursors and edits live, and contribute simultaneously.
The output is a shared visual artifact (a flowchart, an architecture diagram, a
mindmap, a retro board) that a team builds together rather than one person
authoring and the rest reviewing.

The canvas is the product. Everything else exists because a team building a
diagram together is usually doing it **in a session** with other people, and the
things that session needs (a way to vote, a timer, someone running it, a way to
present the result at the end) were otherwise a second tool and a context
switch.

## Target users

Teams that think visually and need to do that thinking together:

- Engineering teams sketching architecture, sequence flows, and system designs.
- Product and design teams mapping user journeys, information architecture, and
  brainstorms.
- Cross-functional groups in workshops, planning sessions, and retrospectives.

The unit of value is the **team**. The entry point is one person: the canvas
works fully without signing in, and a guest gets persistence, share links and
real-time collaboration ([spec/04](04-auth-and-guest-access.md)). That is not a
contradiction, it is the funnel. Somebody tries it alone, and the product earns
the second person. What it must not become is a tool where the second person
never arrives.

## Core capabilities

- **Real-time multiplayer canvas** ([spec/07](07-live-app.md),
  [spec/75](75-realtime-conflict-resolution.md)): live cursors, selection
  awareness, per-element merge so concurrent edits don't clobber, and an ordered
  room with reconnect catch-up. Plus the verbs a session needs: Follow Me
  ([spec/131](131-follow-me-viewport.md)), Bring Focus
  ([spec/144](144-bring-focus.md)), and a facilitator baton so one person runs
  the room ([spec/149](149-facilitator.md)).
- **Diagrams** ([spec/09](09-canvas-and-palette.md)): shapes, arrows,
  connectors, text, tables, code blocks, checklists, images and embeds, plus
  web components that lay themselves out
  ([spec/147](147-web-components-and-no-groups.md)).
- **Mindmaps** ([spec/118](118-mind-node.md)): hierarchical node/branch
  structures with keyboard-driven expansion.
- **Structure**: tabs, tab folders, per-tab layers ([spec/74](74-layers.md)),
  themes and templates.
- **Running the session**: timers and dot votes
  ([spec/39](39-session-tools.md)), live polls ([spec/88](88-live-poll.md)),
  and the ask-the-room elements that followed: estimates
  ([spec/123](123-estimate-card.md)), temperature checks
  ([spec/124](124-temperature-check.md)), idea boxes
  ([spec/125](125-idea-box.md)), agendas ([spec/127](127-agenda.md)), decision
  records ([spec/128](128-decision-record.md)) and roll calls
  ([spec/129](129-roll-call.md)). These are elements on the board, not a side
  panel, which is why they keep arriving: the canvas already knew how to hold
  them.
- **Presenting the result** ([spec/31](31-presentation-mode.md)): full-screen
  slide decks built from element sets that can span tabs.
- **Getting work in and out**: import/export as JSON, Mermaid
  ([spec/73](73-mermaid.md)), Markdown and Excalidraw
  ([spec/87](87-excalidraw-import-export.md)); image export
  ([spec/143](143-export-fidelity.md)); read-only embeds.
- **Teams** ([spec/32](32-teams.md), [spec/35](35-team-shared-diagrams.md)): a
  named group with Admin/Member roles and a shared library of diagrams and
  folders. A diagram lives in exactly one place: someone's personal tree, or one
  team's library. Personal is the default; a team is opt-in.
- **Persistence and history**: every change is saved; the activity log
  ([spec/12](12-activity-and-audit.md)) records what happened and supports
  revert.
- **Machine access**: a public REST API with signed-in tokens
  ([spec/61](61-public-api-and-tokens.md)) and an MCP server so AI tools can
  read and write diagrams ([spec/62](62-mcp-server.md)).

## What it is _not_

- **Not a documentation platform.** Diagrams may be embedded elsewhere, but
  long-form prose is not the goal.
- **Not a general-purpose whiteboard.** Freehand, the Shape Pen and the
  Highlighter exist ([spec/115](115-two-pens.md), [spec/81](81-highlighter.md)),
  and so do stickers, emoji and avatars, but structured output is still the
  point: the test for a new drawing affordance is whether it helps produce a
  diagram someone would keep, not whether a whiteboard has one.
- **Not a desktop app.** The web, with collaboration, is the product. Offline
  Mode is a per-diagram choice, not the default posture (see below).
- **Not a paid product, ever.** No tier, no billing, no feature flags gating the
  core editor ([spec/03](03-open-source-and-business-model.md)).

## Boundaries that have moved

This section exists because this document sat unrevised for four months while
126 specs landed, and by the end it disclaimed things the product shipped. A
boundary nobody maintains is not a boundary. When one moves, it gets recorded
here in the same change, with the spec that moved it.

- **"Not a presentation or slide tool"**: reversed by
  [spec/31](31-presentation-mode.md). Presentation mode is full-screen slide
  decks with their own panel and presenting HUD. That is a presentation tool,
  and the product is better for it, because the session that built the diagram
  usually ends by showing it.
- **"Not an offline-first desktop app"**: narrowed by
  [spec/76](76-offline-mode.md). Still not a desktop app, and cloud is still the
  default, but a diagram can now be kept only in this browser's IndexedDB and
  converted back and forth. Offline is a supported mode, not merely an
  unsupported state.
- **"Freehand is not the primary medium"**: still true, and now load-bearing
  rather than obvious. Three drawing tools shipped without displacing structured
  elements; the bullet above states the test that keeps it that way.

## Why it matters

Most teams bounce between tools that are either single-player (Lucidchart,
draw.io for casual users), heavyweight and slow (enterprise diagram suites), or
general-purpose whiteboards that don't produce clean, structured output (Miro,
FigJam). livediagram exists to be the **fast, focused, multiplayer-from-the-start**
option for teams whose primary need is producing diagrams together.

"Focused" is the load-bearing word and the hardest to keep. The surface is now
large, and the honest check on any new feature is not "is this good?" but "does
a team building a diagram together need this in the room?".

## How it ships

livediagram is **open source** (MIT) and also runs as a **hosted product**, free
for everyone, no paid tier. Anyone can self-host the entire codebase; the hosted
version is the easy default. See
[03-open-source-and-business-model.md](03-open-source-and-business-model.md).

The canvas is **always available without signing in**: a visitor can build a
real diagram before being asked to create an account. Auth (Clerk) unlocks sync,
teams and per-account history on top of that. See
[04-auth-and-guest-access.md](04-auth-and-guest-access.md).

Usage is measured, anonymously and first-party, and published at `/telemetry`
([spec/22](22-telemetry.md)). That dashboard is how a claim on this page gets
checked: "the unit of value is the team" is a statement the Collaboration tab
can agree or disagree with.
