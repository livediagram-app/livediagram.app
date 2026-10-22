# Scope

What liveplanner is made of, and what it deliberately leaves out. [Purpose](../001-project-vision/purpose.md)
says why; this says what. A feature outside the **In** list needs this spec changed first.

## In

**Plan**, the one editor mode ([Editor mode](../007-editor/editor-modes.md), [Plan mode](../026-plan/plan-mode.md)):

- **Board tabs**: boards of cards (items) with columns, swimlanes, WIP limits, card types and custom fields,
  voting and hide-writing ([Plan board](../026-plan/plan-board.md), [Items](../026-plan/items.md),
  [Item types](../026-plan/item-types.md)), board widgets ([Board widgets](../026-plan/board-widgets.md)) and
  plan views ([Plan views](../026-plan/plan-views.md)).
- **Sheet tabs**: spreadsheets with formulas, formats, validation and conditional formats
  ([Sheet](../029-sheets/sheet.md)).
- **Dashboard tabs**: rows of slots showing the project's boards, sheets, plan views, charts and notes
  ([Plan tabs](../026-plan/plan-tabs.md)).
- **Form tabs**: public forms whose responses become cards ([Forms](../030-forms/forms.md)).
- **Start Planning**, the Plan templates and the Plan tour ([Plan templates](../026-plan/plan-templates.md),
  [Plan tour](../026-plan/plan-tour.md)).

**Core**, the experience around a project:

- The Explorer and workspace: Home, the Inbox, folders, default folders, favourites, tags, the Trash, teams,
  sharing and share roles, history ([Workspace](../013-workspace/README.md)).
- Sign-in and identity, guests included ([Identity](../014-identity/README.md)).
- Real-time collaboration and presence, comments, mentions and assigned actions, and the session tools Plan's
  templates use: timer, vote, picker and temperature check ([Collaboration](../012-collaboration/README.md)).
- Settings and preferences, theming, the command palette, power user mode, Offline Mode, and the AI assistant
  where Plan uses it ([Editor](../007-editor/README.md), [Theme](../011-theme/README.md)).
- Export of a tab as PNG, SVG, PDF, Markdown, CSV or JSON ([Export fidelity](../020-import-export/export-fidelity.md)).

**Apps**: live, api, help, marketing, mcp, cli, router and telemetry
([Architecture](../../development/architecture.md)).

**Kept as Plan infrastructure**: the canvas host, selection, viewport, history and element sync. A Board or a Sheet
is a canvas element that fills its tab, so these stay even though no one draws on a canvas.

## Out

These were livediagram's and are not liveplanner's. Their specs, code and help go with them; bringing one back is a
scope change recorded here and in [Purpose](../001-project-vision/purpose.md#boundaries-that-have-moved) first.

- **Editor modes**: Diagram, Draw, Workshop and Pages (articles, slides, logos, wireframes), and the mode switch.
- **Diagram content**: the diagram element kinds, the palette beyond Plan's, and the diagram templates and tours.
- **Features**: event storming; the importers (draw.io, Excalidraw, Microsoft Whiteboard, Mermaid, Markdown);
  repositories; animation and GIF export; photo and sticky-note vision; shape libraries; image search and image
  uploads; the Explorer's Timeline section.
- **Facilitation**: the Q&A board, live polls, quizzes, avatars, laser and spotlight, and presentation mode.
- **Distribution**: the Google Drive mirror and the community gallery.

## Technical constraints

- **Static frontends**: every Next.js app is a static export; server logic lives in Cloudflare Workers
  ([Next.js](../016-platform/nextjs.md)).
- **Cloudflare only**: Workers, D1, Durable Objects, KV and R2; no Node-hosted backend
  ([Deployment](../016-platform/deployment.md)).
- **Optional integrations**: Clerk, Resend and a model provider are each gated on their own key, and the planner
  runs fully without them ([Business model + licence](business-model-and-licence.md)).
- **No secrets in source** ([Secrets policy](secrets-policy.md)).

## Non-goals

- No paid tier, billing or feature flags that gate a feature ([Business model + licence](business-model-and-licence.md)).
- No public source, outside contributions or self-hosting.
- No connectors to other trackers (GitHub Issues, Jira, Linear) in the first cut
  ([Build phase](../005-project-roadmap/prototype-scope.md#later)).
- No native desktop or mobile app; the web is the product.
