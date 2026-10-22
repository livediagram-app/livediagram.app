# Build phase

liveplanner is a fork of livediagram cut down to its Plan mode and the core experience around it
([Scope](../002-project-scope/product-scope.md)). This spec captures **where we are now** and **what's still ahead**,
so nobody has to reverse-engineer the timeline from AGENTS.md and git history.

## Where we are now

**Not deployed.** Nothing runs at liveplanner.app yet. The Cloudflare resource ids in every wrangler config are
placeholders for the liveplanner account, the Google client ids are empty, and the staging deploy, CLI publish and MCP
registry workflows run only by hand ([Deployment](../016-platform/deployment.md)). The stack runs locally on its own
ports (router 3100, marketing 3101, live 3102, help 3104, api 8887, mcp 8888), so it sits beside a
livediagram checkout ([Local development](../../development/local-development.md)).

Eight apps, all built for Cloudflare Workers (with Static Assets for the five Next.js apps):

- **marketing**: the static landing site at `/`, pitching a planner of boards, sheets, dashboards and forms.
- **live**: the planner: the Explorer and the project editor, at clean routes (no `/live` prefix).
- **telemetry**: the public anonymous-events dashboard at `/telemetry` ([Telemetry](../017-telemetry/telemetry.md)).
- **help**: the help centre at `/help`, statically exported with MDX articles.
- **api**: the Worker holding the REST endpoints and a Durable Object realtime room per project; D1 is the durable store.
- **mcp**: the Worker at its own host, `mcp.liveplanner.app`, that gives AI tools the project, board, card, sheet and
  form tools ([MCP server](../015-api/mcp-server.md)).
- **router**: the Worker that stitches marketing, live, telemetry, help and api under one hostname.
- **cli**: `liveplanner`, the command line agents and scripts read and change projects with ([CLI](../015-api/cli.md)).

The planner is real:

- **One mode, four tab kinds** ([Editor mode](../007-editor/editor-modes.md), [Plan tabs](../026-plan/plan-tabs.md)):
  every tab is in Plan. `/new` creates a project and lands on **Start Planning**, which makes the tab a Board, Sheet,
  Dashboard or Form tab, or starts it from a Plan template.
- **Boards** ([Plan board](../026-plan/plan-board.md), [Items](../026-plan/items.md)): a board draws a project's
  **items** (kept in their own D1 table with an open field bag, or inside an offline project) as columns of cards:
  drag between columns and rows, WIP limits, card types with custom fields ([Item types](../026-plan/item-types.md)),
  an item panel, voting and hide-writing for retros, presence on cards, board widgets and plan views (Gantt, calendar,
  workload, status, priority; [Plan views](../026-plan/plan-views.md)).
- **Sheets** ([Sheet](../029-sheets/sheet.md)): cells in their own D1 store, formulas that read other sheets and the
  project's cards, number formats, borders, merges, freeze, sort, filter, validation, conditional formats, copy and
  paste with Google Sheets and Excel, CSV in and out, live for everyone with one undo timeline.
- **Dashboards** ([Plan tabs](../026-plan/plan-tabs.md)): rows of slots holding live versions of the project's boards
  and sheets, plan views, charts and notes.
- **Forms** ([Forms](../030-forms/forms.md)): built in place from starters, published as a public link anyone can fill
  in without an account; every response becomes a card in the column the form names.
- **Actions board** ([Linked boards](../026-plan/linked-boards.md)): the first action added to a project makes an
  Actions board tab where every action has a card, kept in step both ways.
- **Templates** ([Plan templates](../026-plan/plan-templates.md)): projects that open with their tabs, card types and
  example cards set up for the job, and the Plan tour ([Plan tour](../026-plan/plan-tour.md)).
- **Multiplayer** ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)): live presence,
  cursors and selections; concurrent edits to different cards, cells and elements merge, the room orders changes so
  everyone converges, and a dropped connection catches up on reconnect.
- **Collaboration**: comments and mentions, assigned actions, and the session tools Plan's templates use (timer, vote,
  picker, temperature check; [Collaboration](../012-collaboration/README.md)).
- **The Explorer** ([Workspace](../013-workspace/README.md)): Home, the Inbox, nested folders, default folders,
  favourites, tags, Recent, Shared With Me, a project's History, the Trash (30 days), and teams with Admin and Member
  roles and a shared library.
- **Sharing**: editor, participant and view-only links per project, with expiry, an optional password, tab-scoped
  links and read-only embeds ([Share roles](../013-workspace/share-roles.md)).
- **Hybrid auth** ([Auth + guest access](../014-identity/auth-and-guest-access.md)): guests get everything without
  signing in; a signed-in person's projects travel under their account, adding cross-device sync. Guest projects
  migrate on first sign-in. Sign-in goes through the liveworkspace accounts
  Worker; without its settings the api and the live app degrade to pure guest mode.
- **Offline Mode** ([Offline Mode](../006-document/offline-mode.md)): a project saved only in this browser
  (IndexedDB), convertible either way.
- **Export**: a tab as PNG, SVG, PDF, Markdown, CSV (a Board or Sheet tab) or a portable JSON file, and a JSON export
  imported back into a tab ([Export fidelity](../020-import-export/export-fidelity.md)).
- **Machine access**: API tokens and the public REST API ([Public API and API tokens](../015-api/public-api-and-tokens.md)),
  the MCP server, agent changesets that reach anyone with the tab open and revert as one unit
  ([Agent changesets](../024-agents/agent-changesets.md)), agent presence, and the CLI.
- **AI assistance** (optional; [AI Assistance](../007-editor/ai-assistance.md)): an in-editor panel, hidden unless the
  api has a model key.
- **Anonymous first-party telemetry** and the public `/telemetry` dashboard, off unless a deployment turns it on, with a
  per-person opt-out ([Telemetry](../017-telemetry/telemetry.md)).
- **Transactional and lifecycle email** (optional; [Transactional & lifecycle email (Resend)](../014-identity/transactional-email.md)):
  onboarding, team invites, form responses and account messages, off until a `RESEND_API_KEY` is set.

**No project content lives in `localStorage`.** A project is stored on the server, or in IndexedDB for an Offline
Mode project, and `apps/live/lib/api-client.ts` is the single persistence boundary over both. `localStorage` holds
only small per-browser state, under `liveplanner:*` keys:

- **Identity bootstrap**: the guest participant id, the name-confirmed flag and the collaboration key
  (`lib/local-identity.ts`); signed-in people key their data off their account id instead.
- **Device-local preferences and UI state**: the preferences cache ([User preferences](../007-editor/user-preferences.md)),
  the UI mode, the panel layout, style memory, the Explorer and Settings views, and the keyboard-shortcuts switch.
- **One-off prompts and counters**: the pending tour, the sign-in prompt and banner dismissals, the power-user offer,
  the last active day.
- **The share-password cache**: one entry per share code, so a returning visitor skips the gate
  ([Share password](../013-workspace/share-password.md#password-cache)).

## Next

- **Finish the fork**: trim the element kinds, palette, templates and tours to what Plan uses and drop the modules
  nothing reaches (including the diagram lint); rename "document" to **project** in code, tables, routes, MCP tools and
  CLI verbs ([Domain language](../003-system-architecture/domain-language.md)); finish the help centre around Plan.
- **Run and verify**: walk every Plan flow on the local stack, and measure the project page's first-load JS against
  livediagram's.
- **Launch**: create the Cloudflare resources on the liveplanner account and fill in their ids, register the accounts client, set up
  Resend and the model key, deploy staging, then production at liveplanner.app, then publish the CLI and the MCP registry entry.

## Later

These are the meaningful gaps between launch and "full product":

- **Plan, next steps**: a text `board` view for agents, item history, and connectors that fill items from GitHub
  Issues, Jira or Linear (deliberately not in the first cut).
- **Access levels, the rest** ([Share roles](../013-workspace/share-roles.md#later)): token levels, ownership as
  separate powers, server-derived collaboration keys and a look-only Viewer.
- **Finer-grained team permissions**: every member of a team can edit every project in its shared library
  ([Team shared documents](../013-workspace/team-shared-documents.md)).
- **Per-person grants beyond teams and share links**: a project is private, shared via a link with a role, or part of a
  team's library; there are no per-project per-person grants outside those.
- **Same-field concurrent edits are last-writer-wins.** Different cards, cells and elements merge
  ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)), but two people changing the
  same field at the same moment still lose one edit. A field-level CRDT was scoped and deliberately dropped, so this
  gap stays open by choice.

## Hard rules carried forward

- **Static-only frontends.** Next.js apps use `output: 'export'`. No SSR, no Node runtime, no Next.js API routes.
  Server logic goes in the api worker.
- **Reuse over duplication** ([AGENTS.md](../../../AGENTS.md#core-principle-reuse-over-duplication)). Shared types, UI
  primitives, configs and the project data model live in `packages/`, never copy-pasted across apps.
- **Optional integrations.** The planner runs fully without any external SaaS dependency
  ([Business model + licence](../002-project-scope/business-model-and-licence.md)).
- **No secrets in source** ([Secrets policy](../002-project-scope/secrets-policy.md)).
