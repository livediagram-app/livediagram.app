# Link cards

**Status in liveplanner: no preview fetch (2026-10-24).** No Plan tab holds a link card ([Plan mode](../026-plan/plan-mode.md)) and no palette tool makes one, so the `GET /api/unfurl` route, its `UNFURL_RATE_LIMITER` and the editor's fetch are gone. A link card in an old file still draws its cached `meta`, or the bare URL and host. This spec describes livediagram's behaviour.

A **link tool**: a rectangular bookmark element that turns a URL into a rich
preview card — favicon, page title, site name, and (when available) the page's
OG image. The URL is edited the same way every other element's link is.

## The element

`LinkCardElement` (`type: 'link-card'`, `@liveplanner/project`, declared in
`src/element-types.ts`) is a
boxed element added through the standard new-type surface (the `annotation`
precedent): `isBoxed`, `createLinkCard` (280×120 default), the `colors.ts`
defaults + `supportsColours`, `element-variant.ts` (a bordered, rounded card:
`fillColor` background + `strokeColor` border), `search.ts`, `svg-render.ts`
(exports as a rounded rect). It is **resizable** like a shape (not a fixed
marker) and recolour / move / lock / layer / delete like any element.

- **URL source = `element.link` (`{ kind: 'url' }`)** — no new field. Editing
  reuses the existing `LinkPickerDialog` + `applyElementLink`; the empty card
  prompts "Double-click to add a link", and double-clicking opens that picker
  (`onEditLink` → `setLinkPickerOpenForId`). The card also gets the normal
  link badge, so clicking it follows the URL.
- **`meta` is the cached preview** (`LinkCardMeta`: `url` + optional `title` /
  `siteName` / `image` / `favicon` / `description`). It rides the normal tab
  sync, so peers + reloads get the preview without re-fetching. `LinkCardView`
  only trusts `meta` whose `url` matches the current link (stale guard), and
  falls back to the bare URL + host while there's no meta.
- `THEME_COLOUR_FIELDS` gives link cards an **empty** list — a bookmark card
  keeps its neutral look across themes (like sticky / image); the user can
  still recolour per-card.

## Fetching the preview

In livediagram a Worker route fetched the page (the static client can't read cross-origin page HTML), behind an SSRF
guard (http(s) only, non-public hosts refused, the final post-redirect URL re-checked, an 8s timeout and a read cap)
and a per-IP rate limit, and the editor that set the URL committed the result into `meta` once. liveplanner has no
such route: a card keeps whatever `meta` it was saved with.

## Images

The OG image and favicon are **referenced by URL** (`<img src=…>`,
`referrerPolicy="no-referrer"`) — like a normal web embed, no bytes stored in
R2. Broken images fall back gracefully (the image hides, the favicon shows a
neutral chip).

## Telemetry

`track('Element', 'Added', 'LinkCard')` on create (reuses an existing action). `Changed·LinkUnfurled` is no
longer sent: liveplanner fetches no preview.

## Out of scope

A Worker **image proxy / cache** (so viewers don't hit the third-party image
host directly, and dead links keep their thumbnail) — noted follow-up.
oEmbed players (the separate embed-element idea), manual metadata editing, and
scheduled re-unfurling.
