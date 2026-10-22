# Specs

Follow the references below only as needed; never upfront.

This folder is the **source of truth** for what liveplanner is and how it works. Before building anything, check here. After every product decision, update or add a spec.

Specs live in numbered category folders: the reserved `001`–`005` first (vision, scope, architecture, interface design, roadmap), then one folder per domain concept. The specs themselves are unnumbered and named by subject.

## Categories

- ./001-project-vision/README.md - when you need the why: the problem, audience and value proposition
- ./002-project-scope/README.md - when deciding what is in or out: the product scope, licence, distribution, third-party licences, vulnerability disclosure, hard constraints
- ./003-system-architecture/README.md - when touching source layout, the test setup, console logging, or cross-cutting code structure
- ./004-interface-design/README.md - when working on the visual language: colour, fonts, motion, accessibility, shared UI mechanics
- ./005-project-roadmap/README.md - when asking where the product is now and what is still ahead
- ./006-project/README.md - when working on the project model: tabs, tab kinds, layers, per-tab storage, snapshots, offline projects, name length
- ./007-editor/README.md - when working on the live editor shell: routes, the one editor mode (Plan), the start panel, templates, side by side tabs, preferences, power user mode, panels, tours (incl. Show Me), AI, command palette
- ./008-canvas/README.md - when working on the canvas host under every tab (viewport, selection, history, performance), or on livediagram's drawing code still in the tree
- ./009-elements/README.md - when changing an element kind: the charts Dashboards use, or the diagram kinds whose code is still in the tree
- ./010-palette/README.md - when a code comment cites the palette: Plan shows none; its code and catalogues are still in the tree
- ./011-theme/README.md - when working on tab themes: built-in, multi-colour and custom themes
- ./012-collaboration/README.md - when working on realtime, sessions, facilitation, comments, actions or room tools
- ./013-workspace/README.md - when working on the Explorer, its filters, folders, default folders, teams, favourites, tags, share links, the Trash or the empty project clean-up
- ./014-identity/README.md - when working on auth, guest access, profiles or account email
- ./015-api/README.md - when working on the api worker, its OpenAPI project, tokens, the MCP server or the CLI
- ./016-platform/README.md - when working on routing, deployment or the staging environment, the new version prompt and stale builds, or web performance (what a page loads up front)
- ./017-telemetry/README.md - when adding or changing anonymous events or the telemetry dashboard
- ./018-help/README.md - when working on the help centre or contextual help links
- ./019-marketing/README.md - when working on the marketing site, comparison pages or outbound assets
- ./020-import-export/README.md - when working on export (PNG, SVG, PDF, Markdown, CSV, JSON) and its fidelity, or the Mermaid code nothing reaches
- ./024-agents/README.md - when an agent reads, writes or comments on projects: the MCP and CLI front doors, changesets, presence, views, edit operations
- ./026-plan/README.md - when working on Plan mode, Board and Dashboard tabs, cards and card types, items and the item store, plan views, templates, the Plan tour
- ./029-sheets/README.md - when working on Sheets: the Sheet element (a spreadsheet tab placed from Plan mode), its formulas, or the sheet store
- ./030-forms/README.md - when working on Form tabs: building forms, the public form link and its page, responses that become cards on a board

## Workflow

- A new feature, scope decision, or constraint goes into a spec **before** code.
- Reference specs by filename in PRs and discussions.
- If two specs conflict, that's the bug — fix the specs first, then the code.
- Keep specs terse but unambiguous. Update them when something changes; don't let them drift.
