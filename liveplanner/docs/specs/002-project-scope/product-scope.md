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

- The workspace: the Explorer (Home, folders, default folders, favourites, tags, the Timeline, the Trash), teams,
  the Inbox, Drive sync and previews, which are liveworkspace's platform services the app uses, and the app's own
  sharing and share roles ([Workspace](../013-workspace/README.md)).
- Sign-in and identity, guests included ([Identity](../014-identity/README.md)).
- Real-time collaboration and presence, comments, mentions and assigned actions, and the session tools Plan's
  templates use: timer, vote, picker and temperature check ([Collaboration](../012-collaboration/README.md)).
- Settings and preferences, theming, the command palette, power user mode and Offline Mode
  ([Editor](../007-editor/README.md), [Theme](../011-theme/README.md)).
- Export of a tab as PNG, SVG, PDF, Markdown, CSV or JSON ([Export fidelity](../020-import-export/export-fidelity.md)).
- The Community: publishing a plan to the public gallery, the gallery itself and the landing page's From the
  Community section, on liveworkspace's Community service ([Community](../025-community/community.md)).

**Apps**: api, cli, community, editor, help, marketing, mcp and router ([Architecture](../../development/architecture.md)).
Telemetry, its dashboard and the status page are liveworkspace's.

**Plan's infrastructure**: the canvas host, selection, viewport, history and element sync
([Canvas](../008-canvas/README.md)). A Board or a Sheet is a canvas element that fills its tab, and a Dashboard's
views and charts are elements on its tab, so every tab runs on the canvas although no one draws on it.

## Out

These are livediagram's and not liveplanner's; bringing one in is a scope change made here and in
[Purpose](../001-project-vision/purpose.md#boundaries-set-by-other-specs) first.

- **Editor modes**: Diagram, Draw, Workshop and Pages (articles, slides, logos, wireframes), and the mode switch.
- **Drawing**: the palette and its drawing tools, and the diagram templates and tours. The canvas still draws and
  edits every element kind of the project model when a tab holds one (a pasted or imported element), as
  [Elements](../009-elements/README.md) says, but no Plan surface places a drawing kind.
- **Features**: event storming; the importers (draw.io, Excalidraw, Microsoft Whiteboard, Mermaid, Markdown);
  repositories; animation and GIF export; photo and sticky-note vision; shape libraries; image search, and images
  placed on a canvas. A card's [Image field](../026-plan/item-types.md#image-fields) does upload a picture, kept in
  liveworkspace's media service; that is the only image upload a plan has.
- **Facilitation**: the Q&A board, live polls, quizzes, avatars, laser and spotlight, and presentation mode.

## Technical constraints

- **Static frontends**: every Next.js app is a static export; server logic lives in Cloudflare Workers
  ([Next.js](../016-platform/nextjs.md)).
- **Cloudflare only**: Workers, Durable Objects (one SQLite-backed object per plan) and KV (the MCP's OAuth
  state); no D1, no R2 and no Node-hosted backend ([Deployment](../016-platform/deployment.md)).
- **Optional integrations**: sign-in (the liveworkspace accounts Worker) and email (Cloudflare Email Service's
  `EMAIL` binding) are each gated on their own secret or binding, and the planner runs fully without them
  ([Business model + licence](business-model-and-licence.md)).
- **No secrets in source** ([Secrets policy](secrets-policy.md)).

## Non-goals

- No paid tier, billing or feature flags that gate a feature ([Business model + licence](business-model-and-licence.md)).
- No public source or outside contributions; liveplanner runs only as the hosted service at liveplanner.app.
- No connectors to other trackers (GitHub Issues, Jira, Linear) ([Build phase](../005-project-roadmap/prototype-scope.md#later)).
- No native desktop or mobile app; the web is the product.
- No in-editor AI assistant and no model provider behind the api: AI tools work on projects through the
  [MCP server](../015-api/mcp-server.md) and the CLI, under their own terms.
