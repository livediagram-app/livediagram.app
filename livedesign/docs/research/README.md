# Research

Follow the references below only as needed; never upfront.

Research holds dated measurements and experiment reports. They record what was measured and decided at the time; the specs state what the product does now.

## Canvas performance

Where a large tab spends its time during pan, zoom, drag and marquee.

- ./canvas-performance.md - when a large tab feels slow: method, per-gesture breakdown, named hot spots

## Agent CLI

How an AI agent should read, build, edit and comment on designs through a CLI, and work beside a person live.
The resulting specs live in docs/specs/024-agents/ and docs/specs/015-api/cli.md.

- ./agent-cli/agent-cli-ergonomics.md - when shaping CLI help, output, refs, errors or exit codes for agents
- ./agent-cli/compact-representations.md - when choosing how a tab reads as text: token counts per format, views
- ./agent-cli/editing-models.md - when designing how agents edit: op vocabulary, selectors, layout on edit, conflicts
- ./agent-cli/authoring-from-scratch.md - when building a tab from nothing: layout experiment, lint checks, preview
- ./agent-cli/live-collaboration.md - when an agent edits beside a person: presence, changesets, revert, comments
- ./agent-cli/shared-core-architecture.md - when deciding what the api, MCP and CLI each own; auth, distribution

## Access levels

Who may do what to a design: how other products define levels, what each identity can do in the code, the
constraints, and where taking part in a session belongs. The resulting spec is docs/specs/013-workspace/share-roles.md.

- ./access-levels/prior-art.md - when comparing access levels with Google, Figma, Miro, Lucid, Notion and facilitation tools
- ./access-levels/current-abilities.md - when asking what an owner, member, link, embed or token can do today, with code sites
- ./access-levels/constraints.md - when weighing a role model against migration, the room, persistence, tokens and WCAG
- ./access-levels/participation.md - when deciding which session acts are viewing, participating, facilitating or editing
