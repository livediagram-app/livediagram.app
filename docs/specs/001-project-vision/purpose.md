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
real-time collaboration ([Auth + guest access](../014-identity/auth-and-guest-access.md)). That is not a
contradiction, it is the funnel. Somebody tries it alone, and the product earns
the second person. What it must not become is a tool where the second person
never arrives.

## Core capabilities

- **Real-time multiplayer canvas** ([Live app](../007-editor/live-app.md),
  [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)): live cursors, selection
  awareness, per-element merge so concurrent edits don't clobber, and an ordered
  room with reconnect catch-up. Plus the verbs a session needs: Follow Me
  ([Follow-me viewport](../012-collaboration/follow-me-viewport.md)), Bring Focus
  ([Bring Focus](../012-collaboration/bring-focus.md)), and a facilitator baton so one person runs
  the room ([Facilitator](../012-collaboration/facilitator.md)).
- **Diagrams** ([Canvas and palette](../008-canvas/canvas-and-palette.md)): shapes, arrows,
  connectors, text, tables, code blocks, checklists, images and embeds, plus
  web components that lay themselves out
  ([Web components are elements; groups are gone](../009-elements/web-components-and-no-groups.md)).
- **Mindmaps** ([The mind node](../009-elements/mind-node.md)): hierarchical node/branch
  structures with keyboard-driven expansion.
- **Structure**: tabs, tab folders, per-tab layers ([Layers](../006-diagram/layers.md)),
  themes and templates.
- **Running the session**: timers and dot votes
  ([Session tools (timer + voting)](../012-collaboration/session-tools.md)), live polls ([Live poll (ephemeral pulse-check)](../012-collaboration/live-poll.md)),
  and the ask-the-room elements that followed: estimates
  ([Estimate card](../012-collaboration/estimate-card.md)), temperature checks
  ([Temperature check](../012-collaboration/temperature-check.md)), idea boxes
  ([Idea box](../012-collaboration/idea-box.md)), agendas ([Agenda](../012-collaboration/agenda.md)), decision
  records ([Decision record](../012-collaboration/decision-record.md)) and roll calls
  ([Roll call](../012-collaboration/roll-call.md)). These are elements on the board, not a side
  panel, which is why they keep arriving: the canvas already knew how to hold
  them.
- **Presenting the result** ([Presentation mode](../012-collaboration/presentation-mode.md)): full-screen
  slide decks built from element sets that can span tabs.
- **Getting work in and out**: import/export as JSON, Mermaid
  ([Mermaid import & export](../020-import-export/mermaid.md)), Markdown and Excalidraw
  ([Excalidraw import & export](../020-import-export/excalidraw-import-export.md)); image export
  ([Export fidelity](../020-import-export/export-fidelity.md)); read-only embeds.
- **Teams** ([Teams](../013-workspace/teams.md), [Team shared diagrams](../013-workspace/team-shared-diagrams.md)): a
  named group with Admin/Member roles and a shared library of diagrams and
  folders. A diagram lives in exactly one place: someone's personal tree, or one
  team's library. Personal is the default; a team is opt-in.
- **Persistence and history**: every change is saved; the activity log
  ([Activity and audit log](../012-collaboration/activity-and-audit.md)) records what happened and supports
  revert.
- **Machine access**: a public REST API with signed-in tokens
  ([Public API and API tokens](../015-api/public-api-and-tokens.md)) and an MCP server so AI tools can
  read and write diagrams ([MCP server](../015-api/mcp-server.md)).

## What it is _not_

- **Not a documentation platform.** Diagrams may be embedded elsewhere, but
  long-form prose is not the goal.
- **Not a general-purpose whiteboard.** Freehand, the Shape Pen and the
  Highlighter exist ([Two pens instead of a pen and a mode](../008-canvas/two-pens.md), [Highlighter](../008-canvas/highlighter.md)),
  and so do stickers, emoji and avatars, but structured output is still the
  point: the test for a new drawing affordance is whether it helps produce a
  diagram someone would keep, not whether a whiteboard has one.
- **Not a desktop app.** The web, with collaboration, is the product. Offline
  Mode is a per-diagram choice, not the default posture (see below).
- **Not a paid product, ever.** No tier, no billing, no feature flags gating the
  core editor ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)).

## Boundaries that have moved

This section exists because this document sat unrevised for four months while
126 specs landed, and by the end it disclaimed things the product shipped. A
boundary nobody maintains is not a boundary. When one moves, it gets recorded
here in the same change, with the spec that moved it.

- **"Not a presentation or slide tool"**: reversed by
  [Presentation mode](../012-collaboration/presentation-mode.md). Presentation mode is full-screen slide
  decks with their own panel and presenting HUD. That is a presentation tool,
  and the product is better for it, because the session that built the diagram
  usually ends by showing it.
- **"Not an offline-first desktop app"**: narrowed by
  [Offline Mode](../006-diagram/offline-mode.md). Still not a desktop app, and cloud is still the
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
[03-open-source-and-business-model.md](../002-project-scope/open-source-and-business-model.md).

The canvas is **always available without signing in**: a visitor can build a
real diagram before being asked to create an account. Auth (Clerk) unlocks sync,
teams and per-account history on top of that. See
[04-auth-and-guest-access.md](../014-identity/auth-and-guest-access.md).

Usage is measured, anonymously and first-party, and published at `/telemetry`
([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)). That dashboard is how a claim on this page gets
checked: "the unit of value is the team" is a statement the Collaboration tab
can agree or disagree with.
