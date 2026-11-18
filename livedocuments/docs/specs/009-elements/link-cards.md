# Link cards

A **link tool**: a rectangular bookmark element that turns a URL into a rich
preview card: favicon, page title, site name, and (when available) the page's
OG image. The URL is edited the same way every other element's link is.

## The element

`LinkCardElement` (`type: 'link-card'`, `@livedocuments/document`, declared in
`src/element-types.ts`) is a
boxed element added through the standard new-type surface: `isBoxed`, `createLinkCard` (280×120 default), the `colors.ts`
defaults + `supportsColours`, `element-variant.ts` (a bordered, rounded card:
`fillColor` background + `strokeColor` border), `search.ts`, `svg-render.ts`
(exports as a rounded rect). It is **resizable** like a shape (not a fixed
marker) and recolour / move / lock / layer / delete like any element.

- **URL source = `element.link` (`{ kind: 'url' }`)**: no new field. Editing
  reuses the existing `LinkPickerDialog` + `applyElementLink`; the empty card
  prompts "Double-click to add a link", and double-clicking opens that picker
  (`onEditLink` → `setLinkPickerOpenForId`). The card also gets the normal
  link badge, so clicking it follows the URL.
- **`meta` is the cached preview** (`LinkCardMeta`: `url` + optional `title` /
  `siteName` / `image` / `favicon` / `description`). It rides the normal tab
  sync, so peers + reloads get the preview without re-fetching. `LinkCardView`
  only trusts `meta` whose `url` matches the current link (stale guard), and
  falls back to the bare URL + host while there's no meta.
- `THEME_COLOUR_FIELDS` gives link cards an **empty** list, so a bookmark card
  keeps its neutral look across themes (like sticky / image); the user can
  still recolour per-card.

## Fetching the preview: `GET /api/unfurl`

The static client can't read cross-origin page HTML, so a Worker route
(`apps/api/src/routes/unfurl.ts`, over the shared fetch in `../packages/api-kit/src/unfurl-fetch.ts`) does it. When `applyElementLink` sets a URL
on a link card, the editor that set it calls `apiUnfurl(url)` **once** and
commits the result into `meta`; peers receive it via the tab op. It fails
soft (null → the card shows the bare URL).

The endpoint is **SSRF-safe** (public repo):

- Accepts only `http:` / `https:`; rejects everything else.
- Blocks non-public hosts before fetching, by the platform's one rule for every
  server fetch of a URL someone gave
  ([architecture.md](../../../../liveworkspace/docs/specs/002-architecture/architecture.md#fetching-a-url-someone-gave)):
  `localhost`, single-label and internal names (`*.local`, `*.internal`, `*.lan`, ...),
  and private, loopback, carrier NAT, link-local / cloud-metadata
  (`169.254.169.254`), documentation, multicast and reserved addresses, IPv4 or
  IPv6, so a host the webhooks or image uploads refuse is refused here too. A
  public IP literal stays allowed. Resolves a name before fetching (DNS over HTTPS) and refuses one
  that answers with any private address, and follows at most 5 redirects by hand,
  putting **every hop** through the same check (`checkPublicHop`), so neither a
  name nor a redirect can step onto a private host. `http` links keep their
  preview: the same per-hop check in its http variant. A refused or unresolved
  hop leaves the card on the bare URL.
- 8s `AbortController` timeout, ~512 KB read cap, HTML-only `Accept`, a
  descriptive `User-Agent`. Parses with **`HTMLRewriter`** (streaming; there's
  no DOMParser in Workers): `<title>`, `og:title|image|site_name|description`,
  `name="description"`, and the favicon `<link rel="…icon…">` (relative URLs
  resolved against the final URL, `/favicon.ico` fallback).
- Per-IP `UNFURL_RATE_LIMITER` (60/60s; absent binding → allowed, for
  local dev). Always returns 200 with at least the resolved `url`.

The pure helpers (`isBlockedHost`, `parsePublicHttpUrl`, `buildUnfurlResult`)
are unit-tested. `UnfurlResult` is a shared `@livedocuments/api-schema` DTO.

## Images

The OG image and favicon are **referenced by URL** (`<img src=…>`,
`referrerPolicy="no-referrer"`): like a normal web embed, no bytes stored. Broken images fall back gracefully (the image hides, the favicon shows a
neutral chip).

## Telemetry

`track('Element', 'Added', 'LinkCard')` on create; `track('Element',
'Changed', 'LinkUnfurled')` on a successful fetch (reuses existing actions).

## Out of scope

A Worker **image proxy / cache** (so viewers don't hit the third-party image
host directly, and dead links keep their thumbnail), a noted follow-up.
oEmbed players (the separate embed-element idea), manual metadata editing, and
scheduled re-unfurling.
