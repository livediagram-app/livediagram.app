# Purpose

livediagram is a web app where teams collaborate to build **diagrams and mindmaps in real time**.

## What it is

A multiplayer canvas in the browser. Anyone with access to a diagram can join, see other collaborators' cursors and edits live, and contribute simultaneously. The output is a shared visual artifact — a flowchart, an architecture diagram, a mindmap, a brainstorm board — that a team builds together rather than one person authoring and the rest reviewing.

## Target users

Teams that think visually and need to do that thinking together:

- Engineering teams sketching architecture, sequence flows, and system designs.
- Product and design teams mapping user journeys, information architecture, and brainstorms.
- Cross-functional groups in workshops, planning sessions, and retrospectives.

The unit of value is the **team**, not the individual. A single-player diagramming tool is not the product.

## Core capabilities

- **Real-time multiplayer canvas** — multiple users edit the same diagram simultaneously, with live cursors, selection awareness, and conflict-free merging.
- **Diagrams** — boxes, arrows, shapes, connectors, text, and the standard primitives needed for flowcharts, system diagrams, and process maps.
- **Mindmaps** — hierarchical node/branch structures with quick keyboard-driven expansion.
- **Teams and workspaces** — diagrams belong to a team; access is managed at the team level.
- **Persistence** — every change is saved; history is recoverable.
- **Sharing** — invite teammates, share view/edit links, control access.

## What it is _not_ (for now)

- Not a general-purpose whiteboard with freehand drawing as the primary medium — the focus is structured diagrams and mindmaps.
- Not a presentation or slide tool.
- Not a documentation platform — diagrams may be embedded elsewhere, but long-form prose is not the goal.
- Not an offline-first desktop app — the web, with collaboration, is the product.

## Why it matters

Most teams currently bounce between tools that are either single-player (Lucidchart, draw.io for casual users), heavyweight and slow (enterprise diagram suites), or general-purpose whiteboards that don't produce clean, structured output (Miro, FigJam). livediagram exists to be the **fast, focused, multiplayer-from-the-start** option for teams whose primary need is producing diagrams and mindmaps together.

## How it ships

livediagram is **open source** (MIT) and also runs as a **hosted product** with a free tier and a Pro subscription. Anyone can self-host the entire codebase; the hosted version is the easy default. See [03-open-source-and-business-model.md](03-open-source-and-business-model.md).

The canvas is **always available without signing in** — a visitor can build a real diagram before being asked to create an account. Auth (Clerk) unlocks sync, sharing, and collaboration on top of that. See [04-auth-and-guest-access.md](04-auth-and-guest-access.md).
