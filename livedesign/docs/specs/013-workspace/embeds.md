# Read-only embeds (`/embed`)

Tracked as [issue #8](https://github.com/livedesign-app/livedesign.app/issues/8). [Purpose](../001-project-vision/purpose.md) says designs may be embedded elsewhere; this spec makes a shared design iframe-able in Notion, wikis, and docs. Every embedded design is a distribution channel for a free product whose growth model is distribution ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)).

## URL shape

`/embed?s=<share-code>`.

The issue sketched a path segment (`/embed/<code>`), but the static export ([Dedicated route for new-design creation](../007-editor/new-design-route.md)) would need a second worker rewrite rule to serve it, and the existing share view already uses the query form (`/design/shared?s=<code>`). The embed route follows the share view: one statically exported page (`apps/live/app/embed/page.tsx`), the code read client-side from `?s=`. No new infrastructure.

## What renders

The embed route mounts the same editor page component with an `embed` flag. The flag:

- **Honours the share code's role.** A view-role or Participant code renders a read-only viewer (an embed has no identity screen to put a name on what someone adds, [Share roles](share-roles.md)); an **edit-role code renders an editable embed**: direct manipulation, text editing, and context menus work inside the iframe, with the same zen-style chrome (the palette and panels stay hidden; the full editor is one badge-click away for heavier work). The api already enforces the role on every write, so the embed adds no new authorisation surface. (Originally embeds forced read-only regardless of role; that rule was reversed so an edit link pasted into a wiki lets teammates fix a diagram where they read it.) **`&readonly=1` overrides it**: the embed opens as a viewer whatever the code's role (its session role is `view`), which is what a pasted share link unfolds into ("Pasting a share link" below).
- **Hides all chrome**: header, TabBar, every floating panel (the same gates zen mode uses, [Zen mode](../007-editor/zen-mode.md)). What remains: the canvas (pan / zoom / pinch), the ZoomControls dock (without the zen toggle), and the two embed affordances below. An embed draws no element indicators ([Element indicators](../008-canvas/element-indicators.md)): they are editor chrome. A view-role embed's selection toolbar also has no Add Comment button (a reader there has no comments panel to open); comment pins and comment panels are content and stay.
- **Defaults to the Hand (pan) tool** on every viewport (`useCanvasTool({ defaultPan })`): an embed is read-first even when editable, so a drag on empty canvas pans rather than starting a marquee. Editable embeds still select / edit by clicking elements, and tool shortcuts work as usual.
- **Suppresses the visitor identity screen.** A "what's your name" card inside a README iframe is wrong; embed sessions keep their default guest identity silently, and a visitor with none yet never leaves for one: the guest handoff would take the frame to `/auth/guest`, which refuses to be framed, so the frame would show the browser's "refused to connect" page. It opens as a link visitor instead, whose share code is enough ([Guests](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md#guests)). They still join the realtime room like any view-role visitor, so embedded designs **live-update** as the design is edited (the room's whole-tab ops; [API app](../015-api/api.md)). If the WebSocket can't connect, the embed simply shows the fetch-time content, which is the existing degradation path.
- Renders, bottom-left, an **"Open in livedesign" badge** linking to the full share view (`/design/shared?s=<code>`, new tab; the acquisition loop) and, only when the design has more than one tab, an **embed tab switcher**. The switcher is a compact hamburger button showing the current tab's name; tapping it opens a dropdown **above** listing the tabs. A fixed-width button (rather than a horizontal pill row) keeps the chrome from stretching across the canvas and colliding with the bottom-right ZoomControls dock when a design has many tabs.

The share-password gate ([Share password](share-password.md)) renders inside the iframe exactly as it does on the share view. Browsers partition third-party iframe storage, so the cached password is per-embedding-site: visitors enter it once per site, which is acceptable for a password-protected artifact. NotFound (revoked code) and the API-error card render minimal versions inside the frame, without the app header or Explorer.

## Frame headers

The live worker (`apps/live/src/worker.ts`) sends `X-Frame-Options: DENY` on every response as clickjacking defence. It can only do that because `apps/live/wrangler.toml` sets `run_worker_first = ["/*", "!/_next/*"]`: Static Assets otherwise serves a matching file before the worker runs, so every real page (the MCP OAuth consent screen included) would ship without the header. Embed responses (`/embed` and anything under it) are the **one path-scoped exception**: the header is omitted so any site can frame them. This is safe because the embed carries no authenticated actions to clickjack: its only authority is the share code already present in the URL the host page chose to embed (framing an edit-role embed grants nothing the embedding page didn't already hold), and no owner session or credential lives inside the frame; the editor and every other route keep DENY. The one embed that does hold a credential, the
[workbench embed](workbench-embeds.md) under `/embed/workbench`, is safe for a second reason: its credential comes
only from a ticket minted with the person's own API token, and the page mounts only for the origin that minted it. No `Content-Security-Policy: frame-ancestors` is added (absence means frameable, and the CSP cycle is still deferred per the worker's comment).

## Share dialog

Each pass in the ShareDialog ([Live app → Share dialog](../007-editor/live-app.md#share-dialog)) carries an **Embed** menu beside Live image, offering **Copy embed URL** and **Copy iframe**. The iframe is an `<iframe>` snippet the shared Share dialog (`@liveworkspace/explorer`) builds around the embed URL livedesign gives it (`embedUrlFor` in `../packages/workbench/src/lib/embed.ts`, through `apps/live/lib/explorer-share-host.ts`): a sensible default size (800×500), a hairline border, and `allowfullscreen`. The pass carries no separate embed hint for a password: its **Password** tag already shows when one is set, and viewers are prompted for it inside the embed.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

- `track('Session', 'Opened', 'Embed')` once when the embed route hydrates.
- `track('UI', 'Copied', 'EmbedCode')` when the snippet is copied (sibling of the existing `UI / Copied / ShareLink`).

## No outside services

Works with zero external services: the embed page is part of the live app's static export, and the snippet builds its URL from the live origin at copy time, so each origin (production, staging, local) emits its own embed URLs.

## Pasting a share link (oEmbed)

Most people paste the share link itself into Notion, Slack, Medium or Ghost, not an iframe, and those tools find
embeds through oEmbed. The share page (`/design/shared?s=<code>`) carries the discovery tag
(`<link rel="alternate" type="application/json+oembed">`) whenever its head names the design, and the router answers
`GET /oembed?url=<share link>` with a `rich` iframe of this embed, the design's name and its share card as the
thumbnail, the same code in every app ([Previews: Pasting a share link](../../../../liveworkspace/docs/specs/006-media/previews.md#pasting-a-share-link-get-oembed)).

- **Read-only.** The iframe is `/embed?s=<code>&readonly=1`, so an edit link unfolds as a viewer, never an editable
  embed: a public page must not hand every reader edit rights. View and Participant links open as viewers anyway.
- **Only what the share card shows.** A password-protected, revoked, expired or trashed link answers `404`, as its
  share card does, and its share page carries no discovery tag.
- **Sizes and caching.** 800 x 500, scaled down to fit the host's `maxwidth` and `maxheight`; `cache_age` 300
  seconds, so a revoked link's unfurl lingers five minutes at most and its frame shows the not found card at once.

## Out of scope

- Embedding a single element or region rather than a tab.
- Hiding the "Open in livedesign" badge (it is deliberately not configurable).
- A signed-in editor inside a developer tool: that is a [workbench embed](workbench-embeds.md), served under `/embed`
  so it may be framed, and admitted by a workbench ticket rather than a share code.

## Live embeds

A **live embed** shows a canvas, a plan, a livedocuments page or another design, live and read-only, on this design
([Live embeds](../../../../liveworkspace/docs/specs/004-index/live-embeds.md), Work Tracker 930). It is the Embed
element made from the palette's **Live Embed** tile (`embedProvider: 'live'`), drawn by the shared face
(`@liveworkspace/workbench` `LiveEmbedView`) in place of a provider's player.

- **Choosing.** Double-clicking it opens **Choose a File**: this design's connected files, the person's Recent in the
  four apps, and a field for a pasted share link. Picking writes `liveItem` (the file's app and id), `liveName` and
  `livePoster` (its snapshot). Only an Editor chooses: a Participant and a Viewer see the embed as everyone does, and
  the dialog never opens for them.
- **Each reader's own access.** Every reader sees the file live only with their own access to it, opened read-only in
  its app's frame; anyone else sees the snapshot made unreadable and **Open in <App>**, with "Ask its owner to share it with you". Nothing here mints a share link.
- **On screen only.** A frame is asked for only while the element is on screen, at most three at once in the page,
  and given up two seconds after it leaves.
- **Open** opens the file in its own app in a new browser tab; **Use the file** hands the pointer to the frame, and
  until then the element drags and selects as any other.
- **Exports draw the snapshot**, and a Community copy keeps the snapshot without the link.

## Live embeds of a design

Another app's item can show a design live, read-only, inside it ([Live embeds](../../../../liveworkspace/docs/specs/004-index/live-embeds.md),
Work Tracker 930). The frame is this app's [workbench embed](workbench-embeds.md) (`/embed/workbench?d=<id>&live=1`) opened by
an **embed ticket**: minted by the host page with the reader's own access, always at the view level, bound to the host
app's origin, and renewed through the host before its 30 minutes run out. The page is the workbench page at a view session,
in this embed's look rather than the workbench's (`live=1`, Work Tracker 1386): the design alone, read-only, opened
fitted to its content, with the zoom controls and, for several tabs, the tab switcher ("What renders" above), and no header, footer
(Tools, Settings, Inbox), tab bar, palette, panels, Map, tour or Open in livedesign badge, as the host's own row holds
**Open**. A developer tool's workbench (no `live=1`) keeps the workbench's chrome. A reader without their own access never
reaches this frame: the host shows its snapshot instead.
