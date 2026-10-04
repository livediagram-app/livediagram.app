# Research

Follow the references below only as needed; never upfront.

Research holds dated measurements and experiment reports. They record what was measured and decided at the time; the specs state what the product does now.

## Migration

How boards from Google Drive, Miro and Microsoft Whiteboard can come into livediagram: verified platform facts, costs and the decisions taken. The resulting specs live in docs/specs/020-import-export/.

- ./migration-readiness.md - when designing the Google Drive mirror or a Miro or Whiteboard import: sourced findings, cost model, Drive sync cadences

## Vision

How the event-storming photo import finds sticky notes in a wall photo and reads their handwriting.

- ./vision/sticky-detection.md - when working on how a wall photo becomes sticky notes: pipeline, constants, limits
- ./vision/handwriting-readers.md - when choosing a reader for marker handwriting on a sticky crop
- ./vision/research.md - when looking for an untried way to find the stickies: the research inventory, judged
- ./vision/experiments/a-colour.md - when tuning colour classification and light handling (round 1)
- ./vision/experiments/a2-colour.md - when tuning colour classification (round 2)
- ./vision/experiments/b-separation.md - when telling touching notes apart (round 1)
- ./vision/experiments/b2-separation.md - when telling touching notes apart (round 2)
- ./vision/experiments/c-junk.md - when refusing boxes that are not paper: tape, cardboard, shadow, windows
- ./vision/experiments/d-resolution.md - when asking whether more pixels per note help the sticky detector
- ./vision/experiments/e-model.md - when weighing a tiny learned boundary model against the classical pipeline
- ./vision/experiments/f-nobox.md - when a note's paper is in the colour mask but no box survives
- ./vision/experiments/g-precision.md - when pushing detection precision to the bar on every wall
- ./vision/experiments/h-recall.md - when pushing recall without actors to the bar on every wall
- ./vision/experiments/i-separation.md - when telling touching notes apart (round 3)
- ./vision/experiments/j-hybrid.md - when combining the classical detector with the learned boundary model
- ./vision/experiments/k-geometry.md - when trying geometric ideas from the second research round
- ./vision/experiments/m-editor-model.md - when running the boundary model inside the editor's photo import
- ./vision/experiments/n-recall.md - when recall fails on the night wall, the whiteboard or a shaded wall
- ./vision/experiments/o-flat.md - when flat, textureless notes (screenshots, drawn walls) go missing

## Pen input

How a freehand stroke is smoothed live, so the line seen mid-stroke is the line that lands.

- ./stroke-smoothing.md - when revisiting how the whiteboard pen smooths ink: techniques, measurements, the decision

## Canvas performance

Where a large board spends its time during pan, zoom, drag, marquee and pen strokes.

- ./canvas-performance.md - when a large board feels slow: method, per-gesture breakdown, named hot spots

## Agent CLI

How an AI agent should read, build, edit and comment on documents through a CLI, and work beside a person live.
The resulting specs live in docs/specs/024-agents/ and docs/specs/015-api/cli.md.

- ./agent-cli/agent-cli-ergonomics.md - when shaping CLI help, output, refs, errors or exit codes for agents
- ./agent-cli/compact-representations.md - when choosing how a tab reads as text: token counts per format, views
- ./agent-cli/editing-models.md - when designing how agents edit: op vocabulary, selectors, layout on edit, conflicts
- ./agent-cli/authoring-from-scratch.md - when building diagrams from nothing: layout experiment, lint checks, preview
- ./agent-cli/live-collaboration.md - when an agent edits beside a person: presence, changesets, revert, comments
- ./agent-cli/shared-core-architecture.md - when deciding what the api, MCP and CLI each own; auth, distribution

## Access levels

Who may do what to a document: how other products define levels, what each identity can do in the code, the
constraints, and where taking part in a session belongs. The resulting spec is docs/specs/013-workspace/share-roles.md.

- ./access-levels/prior-art.md - when comparing access levels with Google, Figma, Miro, Lucid, Notion and facilitation tools
- ./access-levels/current-abilities.md - when asking what an owner, member, link, embed or token can do today, with code sites
- ./access-levels/constraints.md - when weighing a role model against migration, the room, persistence, tokens and WCAG
- ./access-levels/participation.md - when deciding which session acts are viewing, participating, facilitating or editing
