# Build phase

The frontend-only prototype phase ended once the API app landed. This spec captures **where we are now** and **what's still ahead**, so contributors don't have to reverse-engineer the timeline from AGENTS.md and git history.

## Where we are now

Seven apps: six deployable to Cloudflare Workers (with Static Assets for the three Next.js apps), and the CLI:

- **marketing**: static landing site at `/`.
- **editor**: the page editor (clean routes, no `/live` prefix). Statically exported Next.js.
- **help**: the help centre at `/help`. Statically exported Next.js with MDX articles.
- **api**: Cloudflare Worker holding the REST endpoints + Durable Objects: each document's own (its durable store and realtime room). Workbenches are liveworkspace's. No D1.
- **mcp**: Cloudflare Worker at its own host, `mcp.livedocuments.app`, that connects the editor to AI tools ([MCP server](../015-api/mcp-server.md)).
- **router**: Worker that stitches marketing, editor, help and api under one hostname, and redirects `/telemetry` to liveworkspace's dashboard ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).
- **cli**: the `livedocuments` command line ([CLI](../015-api/cli.md)), published to npm.

The editor is real. Every tab is Pages ([Pages mode](../007-editor/pages-mode.md)):

- **Pages**: a tab is a run of pages on a surround, each a design page (an infographic or a poster), a slide or an article page. Page sizes, backgrounds and patterns, the page panel, page layouts with a hover preview, page snapping, and page actions and reordering.
- **Articles** ([Article pages](../007-editor/article-pages.md)): writing that flows across linked pages, with blocks, a page toolbar, zones for objects in the text and margin notes.
- **On a page**: text, shapes, sticky notes, images, arrows, tables, progress bars and rings, star ratings, timelines, pie / bar / line charts, concept graphics and the Sankey, syntax-highlighted code blocks, tickable checklists, embeds, a curated single-colour icon catalogue and a ~190-strong colour-emoji sticker set ([Stickers](../010-palette/stickers.md)), a click-to-place polygon tool, comment threads, per-element links (including link-to-tab) and locks, and drop shadows ([Element shadows](../008-canvas/element-shadows.md)).
- **Web components**: elements that lay themselves out (banner, callout, stat row, process, header, hero, card, badge, stack). See [Web components are elements; groups are gone](../009-elements/web-components-and-no-groups.md).
- **Multi-select**: marquee drag, plain-click, shift-click, format painter.
- **Layers**: per-tab Photoshop-style layers with a dockable Layers panel (per-layer previews, hide, lock, rename, drag-to-restack); Bring to Front / Send to Back move elements between layers, and hidden layers stay out of exports. See [Layers](../006-document/layers.md).
- **Presentation mode**: a tab's slides run full screen, with the laser and the spotlight. See [Presentation mode](../012-collaboration/presentation-mode.md).
- **Rotation**: any boxed element tilts about its centre to a preset 45° angle from the right-click Rotation menu or the search palette's Rotate actions; the angle round-trips through copy / paste / duplicate / save ([Canvas and palette](../008-canvas/canvas-and-palette.md)).
- **Templates**: the Pages templates (an article, a slide deck, posters, social cards and more) and the blank pages. An empty tab opens on Start Making Pages ([Template starts](../007-editor/start-diagramming.md)), and the Pages tour ([Pages tour](../007-editor/pages-tour.md)) is offered the first time.
- **Corners that scale down**: a corner preset is drawn at most a quarter of a shape's shorter side, so a small rounded square stays a rounded square ([Corner radius](../008-canvas/corner-radius.md)).
- **Quick Style Panel on mixed selections**: one panel styles any mix of selected elements at once, each row applying to the elements it fits and passing over the rest ([Quick Style Panel](../008-canvas/quick-style-panel.md)).
- **Themes**: presets (including the multi-colour palettes from [Multi-colour (rainbow) themes](../011-theme/multicolour-themes.md)) that recolour every page and element in one click. Only built-in themes exist. Every theme has a light and a dark half and follows each reader's own appearance setting ([Light and dark halves](../011-theme/light-and-dark.md)).
- **Multiplayer**: live presence, cursors, selection rings, comments, laser-pointer broadcast via per-document Durable Object rooms ([API app](../015-api/api.md)). Concurrent edits to _different_ elements merge, the room orders mutations so everyone converges, and a dropped connection catches up on reconnect ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)).
- **Undo and redo**: snapshot-based, personal to each editor, in the bottom-right cluster and on Cmd/Ctrl+Z.
- **Tabs**: every document is a stack of tabs (link across them; copy a tab into another document), groupable into one-level collapsible folders ([Tab folders](../006-document/tab-folders.md)).
- **Trash**: a deleted document waits 30 days in the Trash (Settings › Account) before it is purged; team documents go to their team Trash and Offline Mode documents to a local one. See [Trash](../013-workspace/trash.md).
- **Folders**: nested folders in the Explorer; full-page `/explorer` for signed-in users ([Folders](../013-workspace/folders.md)). New documents land in a per-person [default folder](../013-workspace/default-folders.md); the server side is built, the surfaces to set one come next.
- **Timeline**: the Explorer's Timeline row opens a day-grouped feed of everything that happened across your documents, teams and account (comments, assigned actions, team membership, invites, plus forward-dated expiry warnings), with an unread marker and a calendar month view. Guests included; their history migrates on sign-up. See [Timeline](../013-workspace/timeline.md).
- **Inbox**: the Explorer section beside the Timeline that lists what is still _outstanding_ for you across every document: open actions assigned to you, open actions you assigned to others, and unresolved comment threads you are in, each row opening the document at that element with its popover ready. See [Inbox](../013-workspace/inbox.md).
- **Sharing**: editor or view-only share links per document, with an optional password gate that applies to every link on the document; revoke individually or in bulk at any time.
- **Embeds**: a read-only `/embed` view of any share link, iframe-able into wikis, Notion, and docs (copy the snippet from the Share dialog); live-updates as the document is edited. See [Read-only embeds (`/embed`)](../013-workspace/embeds.md).
- **"Shared with you"**: the Explorer accordion + standalone `/explorer` page surface the documents another owner has shared with the visitor; the row's link carries a still-live share code so the non-owner can actually open it. The visitor can copy a shared document into their own files via the header's "Make a copy" button.
- **Hybrid auth.** Guests get everything without signing in (full persistence keyed to a per-browser id; the [Auth + guest access](../014-identity/auth-and-guest-access.md) hard rule); a signed-in user's documents travel under their account id via Bearer-verified requests, which adds cross-device sync. Sign-in goes through the liveworkspace accounts Worker: `/sign-in/` and `/get-started/` hand off to the accounts site (email code), and account self-delete is in Settings. On first sign-in, liveworkspace's index moves a guest's items to the account. The api worker degrades to pure guest mode when `ACCOUNTS_URL` or `API_RESOURCE` is unset, so it works without accounts (local dev); the editor always offers sign-in ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)).
- **Offline Mode** (optional, per document): a document saved only in this browser (IndexedDB), never on the server. Nobody is asked when creating ([Save Locations](../006-document/save-locations.md)); converts either way later (Sync Document uploads it to your account, Take Offline pulls a cloud document down and deletes the server copy). See [Offline Mode](../006-document/offline-mode.md).
- **Export / import**: export the active tab as PNG, SVG, PDF, an animated GIF, Markdown or a portable JSON file; import a JSON export or a Markdown file ([Markdown import](../020-import-export/markdown-import.md)) into the active tab. The JSON envelope's `schemaVersion` lets the editor refuse files newer than it understands instead of silently corrupting state.
- **Teams**: teams with Admin / Member roles and email invites in the Explorer, plus a per-team shared library of documents. See [Teams](../013-workspace/teams.md) and [Team shared documents](../013-workspace/team-shared-documents.md).
- **Assigned actions**: a named, described piece of work attached to any element and assigned to a teammate, optionally by email. Actions live beside comments, so a document carries the follow-ups it generated instead of them leaking into a separate tracker. See [Assigned actions](../012-collaboration/assigned-actions.md).
- **API tokens + public API**: signed-in users mint `lwt_` tokens and drive the REST API from outside the editor: scripts, CI, anything that can send a header. See [Public API and API tokens](../015-api/public-api-and-tokens.md).
- **MCP server**: `mcp.livedocuments.app` connects the editor to AI tools over OAuth, so an assistant can find, read, create, and edit your documents directly. It is an OAuth front door onto the same API tokens, not a second permission model. See [MCP server](../015-api/mcp-server.md).
- **Agent changesets** ([Agent changesets](../024-agents/agent-changesets.md)): the MCP server and API-token scripts change tabs with changesets that reach anyone with the tab open, live, outlined in their author's colour with a toast offering Show and Undo, survive a person's next save, refuse an element a person has selected, and revert as one unit for 30 days; every server-stored document, personal ones included, has a room. Closed livedocuments-app/livedocuments.app#343.
- **Document views and edit operations** ([Document views](../024-agents/document-views.md), [Edit operations](../024-agents/edit-operations.md)): agents read a tab as compact text (outline, pages, layout, comments, show, find) addressed by refs, and change it with eleven intent-level operations (`add set rm move connect rewire insert unwrap order layout test`) in the line form or JSON, by ref or selector, placed beside what they name, making room on insert, and answered with one result line per element.
- **The CLI** ([CLI](../015-api/cli.md)): `livedocuments` signs in through the browser, with a code on another device
  (`--device`) or with a token, keeping it in the system's own keychain; reads every view, lint and diff; edits with
  edit operations based on read copies; creates, renames, shares and removes documents and tabs; comments, shows its
  presence, and waits on or watches a document's room; pulls a document to a file and pushes it back, exports every
  document, and draws tabs as SVG or PNG. It counts its commands like the MCP's tools, and the MCP's
  tools are verbs of the same catalogue. Published on npm as `@livedocuments/cli`, with provenance.
- **Workbench embeds** ([Workbench embeds](../013-workspace/workbench-embeds.md)): a developer tool, once paired in the
  person's browser, opens a document signed in inside its own frame through a ticket the person's CLI mints; the
  frame is confined to that one document, and the person's selection reaches their agent as a selection reference.
- **Agent presence** ([Agent presence](../024-agents/agent-presence.md)): an agent shows the people on a tab what it is
  doing and looking at, under its owner's name, and comments, replies, resolves and reopens through the same endpoints
  people use.
- **Anonymous first-party telemetry** + the public `/telemetry` dashboard. The editor emits a closed-vocabulary `{category, action, type}` event for every meaningful interaction (elements added, themes changed, comments posted, etc.) via batched POSTs to liveworkspace's central telemetry service; the dashboard renders aggregate counts from that service. No third-party analytics; no identifiers crossing the wire. Off by default (the api's `TELEMETRY_ENABLED` flag + the live build's `NEXT_PUBLIC_TELEMETRY_ENABLED` both need to be on for events to flow end-to-end), and a per-user opt-out ([User preferences](../007-editor/user-preferences.md)) overrides both when off. See [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md).
- **Never stale after a deploy**: pages are never served from a stale cache, a page still running an earlier build reloads once into the current one, and in-app navigation across a deploy loads in full instead of failing ([Stale builds](../016-platform/stale-builds.md)).
- **A quiet console**: every decision point logs a fingerprinted trace line, shown in production only when the browser's debug flag asks for it; warnings and errors always show ([Console logging](../003-system-architecture/console-logging.md)).
- **Transactional email** (optional): notification, milestone and account-deleted messages, sent through Cloudflare Email Service (onboarding is sent by liveworkspace). Off unless the api has its `EMAIL` binding; guests never receive email (it is authenticated-only). See [Transactional email](../014-identity/transactional-email.md).

**No document content lives in `localStorage`.** A document is stored on the server, or in IndexedDB for an Offline Mode document, and `apps/editor/lib/api-client.ts` is the single persistence boundary over both. `localStorage` holds only small per-browser state, under `livedocuments:*` keys:

- **Identity bootstrap**: the guest participant id, the name-confirmed flag and the collaboration key (`lib/local-identity.ts`); signed-in users key their data off their account id instead.
- **Device-local preferences and UI state**: the preferences cache ([User preferences](../007-editor/user-preferences.md)), the UI mode, the panel layout, per-tool configs (format painter, laser, spotlight, presentation), recent toolbar tiles, style memory, the Explorer and Settings views, and the keyboard-shortcuts switch.
- **One-off prompts and counters**: the pending tour, the sign-in prompt and banner dismissals, the power-user offer, the last active day.
- **The share-password cache**: one entry per share code, so a returning visitor skips the gate ([Share password](../013-workspace/share-password.md#password-cache)).

- **Participant share links** ([Share roles](../013-workspace/share-roles.md)): a third level between Viewer and Editor, for people who edit text and comment without adding, moving or restyling anything; the room applies their changes through the participant content and writing rules.

## Next

- **Agents as collaborators** ([Agents](../024-agents/README.md)): with changesets, views, edit operations, presence and the [CLI](../015-api/cli.md) built and published, the CLI's update check next.
- **Access levels, the rest** ([Share roles](../013-workspace/share-roles.md#later)): Participant links are built; token levels, ownership as separate powers, server-derived collaboration keys and a look-only Viewer are next.

## Later

These are the meaningful gaps between today and "full product":

- **Finer-grained team permissions** — every member of a team can edit every document in its shared library ([Team shared documents](../013-workspace/team-shared-documents.md)).
- **Per-user grants beyond teams + share links** — a document is private, shared via a link with a role, or part of a team's shared library (teams with Admin/Member roles shipped — see [Teams](../013-workspace/teams.md) + [Team shared documents](../013-workspace/team-shared-documents.md)). There are still no per-document per-user grants outside those.
- **Same-element concurrent edits are last-writer-wins.** Edits to different elements merge ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)), and the fields many people write at once merge as deltas, but two people changing the same element at the same moment still lose one edit. The advisory selection lock ([Editor app](../007-editor/editor-app.md)) makes that rare; it does not prevent it. A field-level CRDT that would close it was scoped and deliberately dropped, so this gap stays open by choice.

## Hard rules carried forward

These were called out at prototype time and still apply:

- **Static-only frontends.** Next.js apps use `output: 'export'`. No SSR, no Node runtime, no Next.js API routes. Server logic goes in the api worker.
- **Reuse over duplication** ([AGENTS.md](../../../AGENTS.md#core-principle-reuse-over-duplication)). Shared types, UI primitives, configs, and the document data model live in `packages/`, never copy-pasted across apps.
- **No required SaaS.** The OSS core can run fully without any external SaaS dependency. Sign-in is optional (see [04](../014-identity/auth-and-guest-access.md)); when it isn't configured, the worker and the live frontend degrade to pure-guest mode and the editor remains fully usable. There is no paid tier and no plan to introduce one (see [03](../002-project-scope/open-source-and-business-model.md)).
- **No secrets in source** — see [06-secrets-policy.md](../002-project-scope/secrets-policy.md).
