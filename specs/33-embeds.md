# 33 — Read-only embeds (`/embed`)

Tracked as [issue #8](https://github.com/livediagram-app/monorepo/issues/8). Spec/00 says "diagrams may be embedded elsewhere"; this spec makes a shared diagram iframe-able in Notion, wikis, and docs. Every embedded diagram is a distribution channel for a free product whose growth model is distribution (spec/03).

## URL shape

`/embed?s=<share-code>`.

The issue sketched a path segment (`/embed/<code>`), but the static export (spec/14) would need a second worker rewrite rule to serve it, and the existing share view already uses the query form (`/diagram/shared?s=<code>`). The embed route follows the share view: one statically exported page (`apps/live/app/embed/page.tsx`), the code read client-side from `?s=`. No new infrastructure.

## What renders

The embed route mounts the same editor page component with an `embed` flag. The flag:

- **Honours the share code's role.** A view-role code renders a read-only viewer; an **edit-role code renders an editable embed**: direct manipulation, text editing, and context menus work inside the iframe, with the same zen-style chrome (the palette and panels stay hidden; the full editor is one badge-click away for heavier work). The api already enforces the role on every write, so the embed adds no new authorisation surface. (Originally embeds forced read-only regardless of role; that rule was reversed so an edit link pasted into a wiki lets teammates fix a diagram where they read it.)
- **Hides all chrome**: header, TabBar, every floating panel (the same gates zen mode uses, spec/26). What remains: the canvas (pan / zoom / pinch), the ZoomControls dock (without the zen toggle), and the two embed affordances below.
- **Defaults to the Hand (pan) tool** on every viewport (`useCanvasTool({ defaultPan })`): an embed is read-first even when editable, so a drag on empty canvas pans rather than starting a marquee. Editable embeds still select / edit by clicking elements, and tool shortcuts work as usual.
- **Suppresses the visitor identity screen.** A "what's your name" card inside a README iframe is wrong; embed sessions keep their default guest identity silently. They still join the realtime room like any view-role visitor, so embedded diagrams **live-update** as the diagram is edited (the room's whole-tab ops; spec/11). If the WebSocket can't connect, the embed simply shows the fetch-time content, which is the existing degradation path.
- Renders, bottom-left, an **"Open in livediagram" badge** linking to the full share view (`/diagram/shared?s=<code>`, new tab; the acquisition loop) and, only when the diagram has more than one tab, an **embed tab switcher**. The switcher is a compact hamburger button showing the current tab's name; tapping it opens a dropdown **above** listing the tabs. A fixed-width button (rather than a horizontal pill row) keeps the chrome from stretching across the canvas and colliding with the bottom-right ZoomControls dock when a diagram has many tabs.

The share-password gate (spec/24) renders inside the iframe exactly as it does on the share view. Browsers partition third-party iframe storage, so the cached password is per-embedding-site: visitors enter it once per site, which is acceptable for a password-protected artifact. NotFound (revoked code) and the API-error card render minimal versions inside the frame, without the app header or Explorer.

## Frame headers

The live worker (`apps/live/src/worker.ts`) sends `X-Frame-Options: DENY` on every response as clickjacking defence. Embed responses (`/embed` and anything under it) are the **one path-scoped exception**: the header is omitted so any site can frame them. This is safe because the embed carries no authenticated actions to clickjack: its only authority is the share code already present in the URL the host page chose to embed (framing an edit-role embed grants nothing the embedding page didn't already hold), and no owner session or credential lives inside the frame; the editor and every other route keep DENY. No `Content-Security-Policy: frame-ancestors` is added (absence means frameable, and the CSP cycle is still deferred per the worker's comment).

## Share dialog

Each link row in the ShareDialog gains a **"Embed" copy button** next to the URL copy. It copies an `<iframe>` snippet built by `buildEmbedSnippet` (`apps/live/lib/embed.ts`, unit-tested): the embed URL for that link's code, a sensible default size (800×500), a hairline border, and `allowfullscreen`. When the diagram has a share password set, a hint under the buttons notes that viewers will be prompted for it inside the embed.

## Telemetry (spec/22)

- `track('Session', 'Opened', 'Embed')` once when the embed route hydrates.
- `track('UI', 'Copied', 'EmbedCode')` when the snippet is copied (sibling of the existing `UI / Copied / ShareLink`).

## Self-hosting

Works with zero external services: the embed page is part of the live app's static export, and the snippet builds its URL from the live origin at copy time, so self-hosted instances emit self-hosted embed URLs.

## Out of scope

- oEmbed / OpenGraph provider endpoints (candidate follow-up).
- Embedding a single element or region rather than a tab.
- Hiding the "Open in livediagram" badge (it is deliberately not configurable).
