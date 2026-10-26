# Build phase

This spec says **where we are now** and **what's still ahead**, so contributors don't have to reverse-engineer it from AGENTS.md and git history. livedesign is a product folder of the liveworkspace monorepo and uses liveworkspace's platform services: accounts, the index (filing, sharing, teams, Trash, Timeline, Inbox), the shared Explorer, previews, media, telemetry and email.

## Where we are now

Seven apps: six deployable to Cloudflare Workers (with Static Assets for the three Next.js apps), and the CLI:

- **marketing**: static landing site at `/`.
- **live**: the page editor (clean routes, no `/live` prefix). Statically exported Next.js.
- **help**: the help centre at `/help`. Statically exported Next.js with MDX articles.
- **api**: Cloudflare Worker holding the REST endpoints + Durable Object per design, holding its content and running its realtime room.
- **mcp**: Cloudflare Worker at its own host, `mcp.livedesign.app`, that connects the editor to AI tools ([MCP server](../015-api/mcp-server.md)).
- **router**: Worker that stitches marketing, live, help and api under one hostname, and redirects `/telemetry` to liveworkspace's dashboard ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).
- **cli**: the `livedesign` command line ([CLI](../015-api/cli.md)), published to npm.

The editor is real. Every tab is Pages ([Pages mode](../007-editor/pages-mode.md)):

- **Pages**: a tab is a run of pages on a surround, each a logo artboard, a wireframe screen or a photo. Page sizes, backgrounds and patterns, the page panel, page layouts with a hover preview, page snapping, and page actions and reordering.
- **Logos** ([Logo pages](../007-editor/logo-pages.md)) and **wireframes** ([Wireframe pages](../007-editor/wireframe-pages.md)): the 1024 artboard with construction guides and logo layouts; device frames for a screen.
- **On a page**: text, shapes, sticky notes, images, arrows, tables, progress bars and rings, star ratings, timelines, pie / bar / line charts, concept graphics and the Sankey, syntax-highlighted code blocks, tickable checklists, embeds, a curated single-colour icon catalogue and a ~190-strong colour-emoji sticker set ([Stickers](../010-palette/stickers.md)), a click-to-place polygon tool for logos, comment threads, per-element links (including link-to-tab) and locks, and drop shadows ([Element shadows](../008-canvas/element-shadows.md)).
- **Web components**: elements that lay themselves out (banner, callout, stat row, process, header, hero, card, badge, stack). See [Web components are elements; groups are gone](../009-elements/web-components-and-no-groups.md).
- **Multi-select**: marquee drag, plain-click, shift-click, format painter.
- **Layers**: per-tab Photoshop-style layers with a dockable Layers panel (per-layer previews, hide, lock, rename, drag-to-restack); Bring to Front / Send to Back move elements between layers, and hidden layers stay out of exports. See [Layers](../006-design/layers.md).
- **Rotation**: any boxed element tilts about its centre to a preset 45° angle from the right-click Rotation menu or the search palette's Rotate actions; the angle round-trips through copy / paste / duplicate / save ([Canvas and palette](../008-canvas/canvas-and-palette.md)).
- **Templates**: the Logos, Photos and Wireframes templates, the logo and wireframe layouts, and the blank pages. An empty tab opens on Start Making Pages ([Template starts](../007-editor/start-diagramming.md)), and the Pages tour ([Pages tour](../007-editor/pages-tour.md)) is offered the first time.
- **Photo pages**: a page may be a photo to edit, as an image editor does ([Photo pages](../031-photo/photo-pages.md)): pixel, adjustment, fill, text and group layers with blend modes, masks and clipping; thirty tools (selections from marquees to Quick Select and Subject, brushes, Clone Stamp, Heal and Spot Heal, gradients, text and shapes); nineteen adjustments and forty-four filters; Free Transform and Crop; PSD in and out; GPU compositing, tiles that sync layer by layer, and previews for every other view.
- **Corners that scale down**: a corner preset is drawn at most a quarter of a shape's shorter side, so a small rounded square stays a rounded square ([Corner radius](../008-canvas/corner-radius.md)).
- **Quick Style Panel on mixed selections**: one panel styles any mix of selected elements at once, each row applying to the elements it fits and passing over the rest ([Quick Style Panel](../008-canvas/quick-style-panel.md)).
- **Themes**: presets (including the multi-colour palettes from [Multi-colour (rainbow) themes](../011-theme/multicolour-themes.md)) that recolour every page and element in one click. Only built-in themes exist. Every theme has a light and a dark half and follows each reader's own appearance setting ([Light and dark halves](../011-theme/light-and-dark.md)).
- **Multiplayer**: live presence, cursors, selection rings, comments, laser-pointer broadcast via per-design Durable Object rooms ([API app](../015-api/api.md)). Concurrent edits to _different_ elements merge, the room orders mutations so everyone converges, and a dropped connection catches up on reconnect ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)).
- **Undo and redo**: snapshot-based, personal to each editor, in the bottom-right cluster and on Cmd/Ctrl+Z.
- **Tabs**: every design is a stack of tabs (link across them; copy a tab into another design), groupable into one-level collapsible folders ([Tab folders](../006-design/tab-folders.md)).
- **Trash**: a deleted design waits 30 days in the Explorer's Trash before it is purged; team designs go to their team Trash and Offline Mode designs to a local one. See [Trash](../013-workspace/trash.md).
- **Folders**: nested folders in the shared Explorer, at `/explorer` and in the editor's Explorer panel ([Folders](../013-workspace/folders.md)). New designs land in a per-person [default folder](../013-workspace/default-folders.md), set from Use as Default for and Settings.
- **Timeline**: the Explorer's Timeline row opens a day-grouped feed of what happened to the designs you can reach (made, edited, renamed, moved, trashed, restored, shared), with a New marker and a calendar month view. See [Timeline](../013-workspace/timeline.md).
- **Inbox**: the Explorer section beside the Timeline that lists what is still _outstanding_ for you across every design: open actions assigned to you, open actions you assigned to others, and unresolved comment threads you are in, each row opening the design at that element with its popover ready. See [Inbox](../013-workspace/inbox.md).
- **Sharing**: Editor, Participant and Viewer share links per design ([Share roles](../013-workspace/share-roles.md)), optionally scoped to one tab and given a lifetime, with an optional password gate over every link on the design; revoke at any time. A Participant adds stickies, text and images and comments without reshaping the pages; the room applies their changes through one participant content rule.
- **Embeds**: a read-only `/embed` view of any share link, iframe-able into wikis, Notion, and docs (copy the snippet from the Share dialog); live-updates as the design is edited. See [Read-only embeds (`/embed`)](../013-workspace/embeds.md).
- **Shared With Me**: the Explorer lists the designs another owner has shared with the visitor, each opening through the link it was shared by while that link is live. The visitor can copy a shared design into their own files with the header's "Make a copy" button.
- **Hybrid auth.** Guests get everything without signing in (full persistence keyed to a liveworkspace guest token kept in the browser; the [Auth + guest access](../014-identity/auth-and-guest-access.md) hard rule); a signed-in user's designs travel under their account id via Bearer-verified requests, which adds cross-device sync. Sign-in goes through the liveworkspace accounts Worker: `/sign-in/` and `/get-started/` hand off to the accounts site (email code), and account self-delete is in Settings. On sign-up, accounts merges the guest into the account and the guest's designs move with the index. The api worker verifies no Bearer when `ACCOUNTS_URL` or `API_RESOURCE` is unset, so there every visitor settles as a guest ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)).
- **Offline Mode** (optional, per design): a design saved only in this browser (IndexedDB), never on the server. The default for a guest at `/new`; converts either way later (Sync Design uploads it to your account, Take Offline pulls a cloud design down and deletes the server copy). See [Offline Mode](../006-design/offline-mode.md).
- **Export / import**: export the active tab's pages as PDF, PNG or SVG, a logo page as its Logo Kit, a photo page as PNG, JPEG, WebP or PSD (or one file per layer), or the tab as a portable JSON file; import a JSON export into the active tab. The JSON envelope's `schemaVersion` lets the editor refuse files newer than it understands instead of silently corrupting state.
- **Teams**: liveworkspace teams (Admin / Member roles, email invites, run on liveworkspace.app) shown in the Explorer, plus a per-team shared library of designs. See [Teams](../013-workspace/teams.md) and [Team shared designs](../013-workspace/team-shared-designs.md).
- **Assigned actions**: a named, described piece of work attached to any element and assigned to a teammate, optionally by email. Actions live beside comments, so a design carries the follow-ups it generated instead of them leaking into a separate tracker. See [Assigned actions](../012-collaboration/assigned-actions.md).
- **API tokens + public API**: signed-in users make `lwt_` tokens on liveworkspace.app and drive the REST API from outside the editor: scripts, CI, anything that can send a header. See [Public API and API tokens](../015-api/public-api-and-tokens.md).
- **MCP server**: `mcp.livedesign.app` connects the editor to AI tools over OAuth, so an assistant can find, read, create, and edit your designs directly. It is an OAuth front door onto the same API tokens, not a second permission model. See [MCP server](../015-api/mcp-server.md).
- **Agent changesets** ([Agent changesets](../024-agents/agent-changesets.md)): the MCP server and API-token scripts change tabs with changesets that reach anyone with the tab open, live, outlined in their author's colour with a toast offering Show and Undo, survive a person's next save, refuse an element a person has selected, and revert as one unit for 30 days; every server-stored design, personal ones included, has a room.
- **Design views and edit operations** ([Design views](../024-agents/design-views.md), [Edit operations](../024-agents/edit-operations.md)): agents read a tab as compact text (outline, pages, layout, comments, show, find) addressed by refs, and change it with twelve intent-level operations (`add set rm move connect rewire insert wrap unwrap order layout test`) in the line form or JSON, by ref or selector, placed beside what they name, making room on insert, and answered with one result line per element.
- **The CLI** ([CLI](../015-api/cli.md)): `livedesign` signs in through the browser, with a code on another device
  (`--device`) or with a token, keeping it in the system's own keychain; reads every view, lint and diff; edits with
  edit operations based on read copies; creates, renames, shares and removes designs and tabs; comments, shows its
  presence, and waits on or watches a design's room; pulls a design to a file and pushes it back, exports every
  design, and draws tabs as SVG or PNG. It counts its commands like the MCP's tools, and the MCP's
  tools are verbs of the same catalogue. Published on npm as `@livedesign/cli`, by hand outside CI.
- **Workbench embeds** ([Workbench embeds](../013-workspace/workbench-embeds.md)): a developer tool, once paired in the
  person's browser, opens a design signed in inside its own frame through a ticket the person's CLI mints; the
  frame is confined to that one design, and the person's selection reaches their agent as a selection reference.
- **Agent presence** ([Agent presence](../024-agents/agent-presence.md)): an agent shows the people on a tab what it is
  doing and looking at, under its owner's name, and comments, replies, resolves and reopens through the same endpoints
  people use.
- **Anonymous first-party telemetry**: the editor emits a closed-vocabulary `{category, action, type}` event for every meaningful interaction (elements added, themes changed, comments posted, etc.) in batched POSTs to `/api/events`, which the api relays to liveworkspace's telemetry service; liveworkspace's public `/telemetry` dashboard shows the counts. No third-party analytics; no identifiers crossing the wire. A per-user opt-out ([User preferences](../007-editor/user-preferences.md)) turns it off. See [Telemetry](../017-telemetry/telemetry.md).
- **Never stale after a deploy**: pages are never served from a stale cache, a page still running an earlier build reloads once into the current one, and in-app navigation across a deploy loads in full instead of failing ([Stale builds](../016-platform/stale-builds.md)).
- **A quiet console**: every decision point logs a fingerprinted trace line, shown in production only when the browser's debug flag asks for it; warnings and errors always show ([Console logging](../003-system-architecture/console-logging.md)).
- **Email** (optional): the account-deleted confirmation and opt-out notifications (someone joined my design, a new comment, an action assigned, a mention, a first share, a design milestone), sent through Cloudflare Email Service; the onboarding series and team and token emails are the accounts Worker's. Off without the api's `EMAIL` binding; guests never receive email. See [Transactional email](../014-identity/transactional-email.md).

**No design content lives in `localStorage`.** A design is stored on the server, or in IndexedDB for an Offline Mode design, and `apps/live/lib/api-client.ts` is the single persistence boundary over both. `localStorage` holds only small per-browser state, under `livedesign:*` keys:

- **Identity bootstrap**: the guest participant id, the name-confirmed flag and the collaboration key (`lib/local-identity.ts`); signed-in users key their data off their account id instead.
- **Device-local preferences and UI state**: the preferences cache ([User preferences](../007-editor/user-preferences.md)), the UI mode, the panel layout, per-tool configs (format painter, laser, spotlight), recent toolbar tiles, style memory, the Explorer and Settings views, and the keyboard-shortcuts switch.
- **One-off prompts and counters**: the sign-in prompt and banner dismissals, the power-user offer, the last active day.

## Next

**Status: Planned.** Not built yet; the CLI is published without it.

- **The CLI's update check** ([CLI](../015-api/cli.md)): the CLI tells a person when a newer version is published.

## Later

These are the meaningful gaps between today and "full product":

- **Finer-grained team permissions**: every member of a team can edit every design in its shared library ([Team shared designs](../013-workspace/team-shared-designs.md)).
- **Per-user grants beyond teams and share links**: a design is private, shared through a link with a level, or part of a team's shared library ([Teams](../013-workspace/teams.md), [Team shared designs](../013-workspace/team-shared-designs.md)). There are no per-design, per-person grants outside those.
- **Token levels**: API tokens carry a read-only flag rather than a share level ([Share roles](../013-workspace/share-roles.md#outside-the-levels)).
- **Same-element concurrent edits are last-writer-wins.** Edits to different elements merge ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)), and the fields many people write at once merge as deltas, but two people changing the same element at the same moment still lose one edit. The advisory selection lock ([Live app](../007-editor/live-app.md)) makes that rare; it does not prevent it. A field-level CRDT that would close it was scoped and deliberately dropped, so this gap stays open by choice.

## Hard rules

- **Static-only frontends.** Next.js apps use `output: 'export'`. No SSR, no Node runtime, no Next.js API routes. Server logic goes in the api worker.
- **Reuse over duplication** ([AGENTS.md](../../../AGENTS.md#core-principle-reuse-over-duplication)). Shared types, UI primitives, configs, and the design data model live in `packages/`, never copy-pasted across apps.
- **No required SaaS.** The OSS core can run fully without any external SaaS dependency. Sign-in is optional ([Auth + guest access](../014-identity/auth-and-guest-access.md)); when it isn't configured, the worker and the live frontend degrade to pure-guest mode and the editor remains fully usable. There is no paid tier and no plan to introduce one ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)).
- **No secrets in source**: see [Secrets policy](../002-project-scope/secrets-policy.md).
