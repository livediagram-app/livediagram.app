# Specs

Follow the references below only as needed; never upfront.

This folder is the **source of truth** for what livediagram is and how it works. Before building anything, check here. After every product decision, update or add a spec.

Specs live in numbered category folders: the reserved `001`–`005` first (vision, scope, architecture, interface design, roadmap), then one folder per domain concept. The specs themselves are unnumbered and named by subject.

## Categories

- ./001-project-vision/README.md - when you need the why: the problem, audience and value proposition
- ./002-project-scope/README.md - when deciding what is in or out: licence, distribution, hard constraints
- ./003-system-architecture/README.md - when touching source layout, the test setup, or cross-cutting code structure
- ./004-interface-design/README.md - when working on the visual language: colour, fonts, accessibility, shared UI mechanics
- ./005-project-roadmap/README.md - when asking where the product is now and what is still ahead
- ./006-diagram/README.md - when working on the diagram model: tabs, layers, storage, snapshots, offline diagrams
- ./007-editor/README.md - when working on the live editor shell: routes, preferences, panels, tours, AI, command palette
- ./008-canvas/README.md - when working on canvas tools and gestures: drawing, arrows, snapping, sizing, tool panels
- ./009-elements/README.md - when adding or changing an element kind or its content
- ./010-palette/README.md - when working on the palette: categories, favourites, icon and sticker catalogues, presets
- ./011-theme/README.md - when working on diagram themes: built-in, multi-colour and custom themes
- ./012-collaboration/README.md - when working on realtime, sessions, facilitation, comments, actions or room tools
- ./013-workspace/README.md - when working on the Explorer, folders, teams, favourites or share links
- ./014-identity/README.md - when working on auth, guest access, profiles or account email
- ./015-api/README.md - when working on the api worker, its OpenAPI document, tokens or the MCP server
- ./016-platform/README.md - when working on routing, deployment or the staging environment
- ./017-telemetry/README.md - when adding or changing anonymous events or the telemetry dashboard
- ./018-help/README.md - when working on the help centre or contextual help links
- ./019-marketing/README.md - when working on the marketing site, comparison pages or outbound assets
- ./020-import-export/README.md - when working on Markdown, Mermaid or Excalidraw import/export, or export fidelity
- ./021-event-storming/README.md - when working on the event-storming board, its lanes or its photo import

## Workflow

- A new feature, scope decision, or constraint goes into a spec **before** code.
- Reference specs by filename in PRs and discussions.
- If two specs conflict, that's the bug — fix the specs first, then the code.
- Keep specs terse but unambiguous. Update them when something changes; don't let them drift.
