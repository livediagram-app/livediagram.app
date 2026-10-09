# Specs

Follow the references below only as needed; never upfront.

This folder is the **source of truth** for what livediagram is and how it works. Before building anything, check here. After every product decision, update or add a spec.

Specs live in numbered category folders: the reserved `001`–`005` first (vision, scope, architecture, interface design, roadmap), then one folder per domain concept. The specs themselves are unnumbered and named by subject.

## Categories

- ./001-project-vision/README.md - when you need the why: the problem, audience and value proposition
- ./002-project-scope/README.md - when deciding what is in or out: licence, distribution, third-party licences, vulnerability disclosure, hard constraints
- ./003-system-architecture/README.md - when touching source layout, the test setup, console logging, or cross-cutting code structure
- ./004-interface-design/README.md - when working on the visual language: colour, fonts, motion, accessibility, shared UI mechanics
- ./005-project-roadmap/README.md - when asking where the product is now and what is still ahead
- ./006-document/README.md - when working on the document model and its domain language: tabs, tab kinds, layers, storage, snapshots, offline documents, stroke points
- ./007-editor/README.md - when working on the live editor shell: routes, editor modes, Illustrate pages (infographics and articles), side by side tabs, preferences, power user mode, panels, tours, AI, command palette
- ./008-canvas/README.md - when working on canvas tools and gestures: drawing, arrows, snapping, sizing, corner radius, tool panels and the Quick Style Panel
- ./009-elements/README.md - when adding or changing an element kind or its content
- ./010-palette/README.md - when working on the palette: categories, per-mode layouts and Popular, icon and sticker catalogues, presets
- ./011-theme/README.md - when working on tab themes: built-in, multi-colour and custom themes
- ./012-collaboration/README.md - when working on realtime, sessions, facilitation, comments, actions or room tools
- ./013-workspace/README.md - when working on the Explorer, its filters, folders, default folders, teams, favourites, shape libraries, share links, the Trash or the empty document clean-up
- ./014-identity/README.md - when working on auth, guest access, profiles or account email
- ./015-api/README.md - when working on the api worker, its OpenAPI document, tokens, the MCP server or the CLI
- ./016-platform/README.md - when working on routing, deployment or the staging environment, or the new version prompt and stale builds
- ./017-telemetry/README.md - when adding or changing anonymous events or the telemetry dashboard
- ./018-help/README.md - when working on the help centre or contextual help links
- ./019-marketing/README.md - when working on the marketing site, comparison pages or outbound assets
- ./020-import-export/README.md - when working on Markdown, Mermaid, Excalidraw or draw.io import/export, pasting from Excalidraw, imported images, board scenes and board imports from Miro or Microsoft Whiteboard, or export fidelity
- ./021-event-storming/README.md - when working on the event-storming board, its lanes or its photo import
- ./022-drive-mirror/README.md - when working on the Google Drive mirror of My documents
- ./023-draw-mode/README.md - when working on Draw mode: its pens, dock, snap colours, text boxes and path tool
- ./024-agents/README.md - when an agent reads, writes or comments on documents: changesets, presence, views, edit operations, lint
- ./025-community/README.md - when working on Community: publishing documents to the public gallery, the Community app, likes, copies, and reports (moderation by reports alone)
- ./026-plan/README.md - when working on Plan mode, Plan boards and cards, or items and the item store
- ./027-repositories/README.md - when linking a code repository to livediagram: `livediagram.toml`, mirrors, sync and merge, git, diagram-as-code sources
- ./028-animation/README.md - when working on element animations: the animation set each element takes (Shape, Text, Sticky, Drawing, Media, Table), the per-set menu categories, reveals, loops and the quality bar
- ./029-sheets/README.md - when working on Sheets: the Sheet element (a spreadsheet tab placed from Plan mode), its formulas, or the sheet store

## Workflow

- A new feature, scope decision, or constraint goes into a spec **before** code.
- Reference specs by filename in PRs and discussions.
- If two specs conflict, that's the bug — fix the specs first, then the code.
- Keep specs terse but unambiguous. Update them when something changes; don't let them drift.
