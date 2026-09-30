# Link cards: blueprint

Derived from [Link cards](../link-cards.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                     | Role                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/document/src/element-types.ts`                 | `LinkCardElement`, `LinkCardMeta`                                          |
| `packages/document/src/factories.ts`                     | `createLinkCard`: 280×120, no link, no meta                                |
| `packages/document/src/index.ts`                         | `isBoxed` includes `link-card`; `elementSupportsText` excludes it          |
| `packages/document/src/colors.ts`                        | Default fill, stroke, text; `supportsColours` true                         |
| `packages/document/src/themes.ts`                        | `THEME_COLOUR_FIELDS['link-card'] = []`                                    |
| `packages/document/src/validate.ts`                      | Link card carries no extra required fields                                 |
| `packages/document/src/svg-render.ts`                    | Export: generic `rect` branch                                              |
| `packages/api-schema/src/index.ts`                       | `UnfurlResult`                                                             |
| `apps/api/src/routes/unfurl.ts`                          | `handleUnfurl`, `isBlockedHost`, `parsePublicHttpUrl`, `buildUnfurlResult` |
| `apps/api/src/index.ts`                                  | Dispatch of `unfurl`                                                       |
| `apps/api/wrangler.toml`                                 | `UNFURL_RATE_LIMITER` (production and `[env.staging]`)                     |
| `apps/live/lib/api/unfurl.ts`                            | `apiUnfurl`: fail-soft client                                              |
| `apps/live/hooks/canvas/useElementLinks.ts`              | `applyElementLink`: sets the link, then fetches and commits `meta`         |
| `apps/live/lib/url-safety.ts`                            | `normaliseUrl`, `isSafeFollowUrl`                                          |
| `apps/live/components/canvas/LinkCardView.tsx`           | Card face: banner, favicon, title, destination, "Open link" row            |
| `apps/live/components/canvas/element-variant.ts`         | The card chrome: 10 px radius, 1 px border, fill                           |
| `apps/live/components/canvas/BoxedElementView.tsx`       | Excludes link cards from the corner link badge                             |
| `apps/live/components/canvas/useBoxedElementGestures.ts` | Double-click → `onEditLink`                                                |
| `apps/live/components/canvas/EditorCanvasHost.tsx`       | `onEditLink={isReadOnly ? undefined : setLinkPickerOpenForId}`             |
| `apps/live/components/dialogs/LinkPickerDialog.tsx`      | The shared link editor                                                     |
| `apps/live/components/palette/palette-tile-defs.tsx`     | `tools:link-card` tile                                                     |
| `apps/live/app/document/[id]/useElementCreation.ts`      | `addLinkCard`: arms the draw gesture                                       |
| `apps/live/hooks/canvas/useShapeDrawing.ts`              | Commit: `track('Element', 'Added', 'LinkCard')`                            |
| `apps/live/lib/search.ts`                                | Palette search entry                                                       |

## Domain and naming

| Term          | Identifier                              | Meaning                                                 |
| ------------- | --------------------------------------- | ------------------------------------------------------- |
| Link card     | `LinkCardElement` (`type: 'link-card'`) | Boxed bookmark element                                  |
| Card link     | `LinkCardElement.link: ElementLink`     | The destination; any kind `[QB11]`; only `url` unfurls  |
| Preview       | `LinkCardElement.meta: LinkCardMeta`    | Cached unfurl fields, keyed by `meta.url`               |
| Stale preview | `meta.url !== link.url`                 | Ignored by the view                                     |
| Unfurl        | `GET /api/unfurl`, `apiUnfurl`          | Server-side fetch and parse of a page's head            |
| Unfurl result | `UnfurlResult`                          | Wire DTO of one unfurl                                  |
| Public URL    | `parsePublicHttpUrl(raw) !== null`      | `http(s)` to a host `isBlockedHost` allows              |
| Blocked host  | `isBlockedHost(hostname)`               | Loopback, private, link-local, metadata, local names    |
| Banner        | top area of `LinkCardView`              | OG image, or a neutral globe placeholder                |
| Info row      | bottom area of `LinkCardView`           | Favicon or glyph, title, destination; the follow target |

Banned synonyms: "bookmark" in code (say link card), "OG card", "embed" (an embed is a video
element), "scrape" (say unfurl), "thumbnail" for the banner.

## Behaviour and state

States of one card: **empty** (no `link`) → **linked, unfurling** (url link, no matching meta) →
**linked, previewed** (`meta.url === link.url`). A non-URL link is **linked** with no preview.

1. **Create.** `addLinkCard` arms `beginDraw({ type: 'link-card' })` unless `editsBlocked`. A tap
   drops `createLinkCard` (280×120); a drag sizes it. `commitDraw` tracks
   `track('Element', 'Added', 'LinkCard')`.
2. **Edit the link.** Double-click (`useBoxedElementGestures`) calls `onEditLink(id)`, which opens
   `LinkPickerDialog`; view role passes no `onEditLink`. The context menu's Link section offers
   set, change and remove. The picker stores `normaliseUrl(raw)` (`http`, `https`, `mailto`).
3. **Unfurl.** `applyElementLink(link)` commits the link on the selection. When `link.kind ===
'url'` and a selected element is a link card (GB9), it calls `apiUnfurl(url)` once. On a
   non-null result it commits, as its own history step (D57), `meta = { url, title, image,
favicon }` on each selected link card whose link is still that URL (D50), and tracks
   `track('Element', 'Changed', 'LinkUnfurled')` only when a card took the preview (GB9). A null
   result changes nothing.
4. **Sync.** `meta` rides the tab body and the element op; peers and reloads never re-fetch.
5. **Render.** `LinkCardView` trusts `meta` only when `meta.url === link.url`. The title is the
   trusted `meta.title` else the host without `www.` (GB11); the destination is the URL, the
   document name, or the tab name. The banner shows `meta.image` until it errors, then the globe
   placeholder (D54); the favicon shows until it errors, then the kind glyph. Both reset when
   their URL changes (GB12).
6. **Follow.** Only the info row follows (D55): a `<button aria-label="Open link">` that stops
   pointer-down and calls `followLink`, which opens a URL only when `isSafeFollowUrl`, in a new
   tab with `noopener,noreferrer`. No corner badge (`BoxedElementView` excludes link cards).
7. **Theme.** Theme switches leave link cards untouched (`THEME_COLOUR_FIELDS` empty); manual
   recolour works (`supportsColours`).

### `GET /api/unfurl?url=<encoded>`

1. A path segment after `unfurl`, or a method other than GET → 404.
2. `UNFURL_RATE_LIMITER` bound and over limit for `clientIp(request)` → 429 `rate_limited`.
   Unbound → allowed.
3. No `url` → 400 `missing url`. `parsePublicHttpUrl` null → 400 `invalid or disallowed url`.
4. `fetch` with `redirect: 'follow'`, `User-Agent: USER_AGENT`, `Accept:
text/html,application/xhtml+xml`, aborted after `FETCH_TIMEOUT_MS` measured to the end of the
   body read (GB10). A throw → 200 `{ url }` (D53).
5. Final URL (`res.url`) re-validated; blocked → 400 `redirected to a disallowed url`.
6. `content-type` without `html` → 200 `buildUnfurlResult({}, finalUrl)` (url + favicon).
7. `collectMeta` streams through `HTMLRewriter`, reading at most `MAX_HTML_BYTES` then cancelling:
   `<title>` text; the first `og:title`, `og:site_name`, `og:image` or `og:image:url`,
   `og:description`, `description` (`property` or `name`); the first `<link rel>` containing
   `icon` (D51, D52).
8. 200 `buildUnfurlResult(collected, finalUrl)`: trimmed, empties dropped, image and favicon
   resolved against the final URL, favicon falling back to `/favicon.ico`.

### `isBlockedHost(hostname)`

Lower-cased, IPv6 brackets stripped. Blocked when any holds:

- empty; `localhost`, `*.localhost`, `*.local`;
- `::1`, `::`, `0.0.0.0`;
- dotted IPv4 in `0/8`, `10/8`, `127/8`, `169.254/16`, `172.16/12`, `192.168/16`, `100.64/10`
  (D58), plus `224/4`, `240/4`, `192.0.0/24`, `198.18/15` `[QB12]`;
- IPv4-mapped IPv6 (`::ffff:` dotted or hex) whose embedded IPv4 is blocked;
- an IPv6 literal (contains `:`) starting `fc`, `fd`, `fe80`, `ff` or `64:ff9b:` `[QB12]`.

Invariants:

- **I1:** no fetch is issued to a URL `parsePublicHttpUrl` rejects.
- **I2:** no field is returned from a response whose final URL is blocked.
- **I3:** at most `MAX_HTML_BYTES` (plus one chunk) is read from any response.
- **I4:** the view never shows `meta` fields whose `url` differs from the card's URL.

## Interfaces and contracts

```ts
// packages/document/src/element-types.ts
export type LinkCardMeta = {
  url: string;
  title?: string;
  image?: string;
  favicon?: string;
};
export type LinkCardElement = {
  id: ElementId;
  type: 'link-card';
  x: number;
  y: number;
  width: number;
  height: number;
  meta?: LinkCardMeta;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  link?: ElementLink;
  // ...the shared boxed-element fields
};

// packages/api-schema/src/index.ts
export type UnfurlResult = {
  url: string;
  title?: string;
  siteName?: string;
  description?: string;
  image?: string;
  favicon?: string;
};

// apps/api/src/routes/unfurl.ts
export function isBlockedHost(hostname: string): boolean;
export function parsePublicHttpUrl(raw: string): URL | null;
export function buildUnfurlResult(collected: CollectedMeta, finalUrl: string): UnfurlResult;

// apps/live/lib/api/unfurl.ts: null on any error or non-2xx
export function apiUnfurl(url: string): Promise<UnfurlResult | null>;
```

| Response | When                                     | Body                                        |
| -------- | ---------------------------------------- | ------------------------------------------- |
| 200      | Fetched, or network error / timeout      | `UnfurlResult` (at least `url`)             |
| 400      | Missing, malformed, non-http(s), blocked | `missing url` / `invalid or disallowed url` |
| 400      | Redirected to a blocked host             | `redirected to a disallowed url`            |
| 404      | Not GET, or an extra path segment        | `notFound()`                                |
| 429      | Rate limited                             | `rate_limited`                              |

`siteName` and `description` stay on the wire and are not cached on the element `[QB13]`.
`validate.ts` accepts `meta` only as an object of bounded strings whose `image` and `favicon` are
`http(s)` URLs (GB13).

## Data and persistence

- **Persisted in the tab body**: `link` (shared `ElementLink`), `meta` (four fields), colours and
  the shared boxed fields. No D1 table, no R2 object.
- **Never persisted**: the unfurl response beyond the four fields; image bytes (referenced by URL).
- **Snapshot / restore**: `meta` travels with the element; undo can remove the meta step alone
  (D57). A restored card with a stale `meta.url` shows the bare URL.
- **Migration**: none.

## Errors and edge cases

| #   | Case                                    | Handling                                                       |
| --- | --------------------------------------- | -------------------------------------------------------------- |
| E1  | URL changed before the unfurl lands     | Commit guard skips cards whose link is no longer that URL      |
| E2  | Unfurl fails, 400, 429                  | `apiUnfurl` returns null; card shows host + URL                |
| E3  | Redirect (www, https, trailing slash)   | `meta.url` keyed to the requested URL, so the preview survives |
| E4  | Redirect to a private host              | 400; no data returned (I2)                                     |
| E5  | Non-HTML target (PDF, image)            | URL + favicon                                                  |
| E6  | Huge page                               | Read stops at `MAX_HTML_BYTES`                                 |
| E7  | Slow-drip body                          | Aborted at `FETCH_TIMEOUT_MS` (GB10)                           |
| E8  | OG image or favicon 404 / blocked       | Globe banner / kind glyph                                      |
| E9  | Multi-selection mixing cards and shapes | All get the link; only cards get `meta`                        |
| E10 | Non-URL link                            | No unfurl; title "Document" / "Tab" / "Element" `[QB11]`       |
| E11 | View role                               | No double-click edit; info row still follows                   |
| E12 | Stored `javascript:` URL                | `isSafeFollowUrl` refuses to open it                           |

## Security and trust

- **Unauthenticated outbound fetch.** The endpoint needs no owner, so it is throttled per IP
  (`UNFURL_RATE_LIMITER`) and exempt from guest signatures (`OWNER_SCOPED_SEGMENTS` excludes it).
- **SSRF.** Scheme and host validated before the fetch and again on the final URL. DNS names that
  resolve to private addresses are not resolved here; Workers `fetch` cannot reach a private
  network, which is the residual control. Hostnames are never matched by IPv6 prefix `[QB12]`.
- **Response trust.** Parsed fields are text; the view renders them as text and as `<img src>`
  with `referrerPolicy="no-referrer"`, so markup cannot execute. `meta` also arrives from peers,
  API tokens and MCP, so it is validated on write (GB13).
- **Privacy.** Viewers' browsers load the OG image and favicon from third-party hosts; no referrer
  is sent. A proxy is out of scope (spec).
- **Follow.** `normaliseUrl` on store, `isSafeFollowUrl` on follow, `noopener,noreferrer`.

## Performance and limits

- Per unfurl: one outbound fetch, at most 512 KiB streamed, 8 s wall clock.
- Per card: one unfurl per URL set, by the setter only; peers pay nothing.
- Render: two `<img>` loads per previewed card, both lazy to the browser; the view is plain DOM.

## Presentation and UX

- **Chrome**: `element-variant.ts` `link-card` case: 10 px radius, 1 px solid border, `shadow-sm`,
  `overflow-hidden`; defaults fill `#ffffff`, stroke `#e2e8f0`, text `#1e293b` in every surface.
- **Empty**: centred "Add a link — double-click" (UI copy as shipped).
- **Linked**: banner (OG image `object-cover`, else slate gradient with a globe), then the info row:
  16 px favicon or glyph, title (12 px semibold, `line-clamp-2`, `textColor`), destination (10 px,
  truncated), and a right arrow that nudges on hover when followable.
- **Palette**: `tools:link-card`, "Add link card", Behaviour group, "move" tile group; draw banner
  "Tap to drop or drag to draw a link card".
- **Export**: rect with `rx` 6 and the card's fill and stroke, no text (D56).

## Accessibility

- The info row is a real `<button>` labelled "Open link"; the banner and favicon are decorative
  (`alt=""`, glyphs `aria-hidden`).
- Destination and empty-state text meet 4.5:1 on the default card (slate-500 or darker, GB14).
- The arrow nudge is a 150 ms transform, removed under reduced motion by the global rule.

## Web experience

- **CLS**: the card box is fixed; the banner is `flex-1` and the placeholder occupies the same
  space before and after the image loads.
- **INP**: unfurl is async and off the interaction; the link commit is immediate.

## Observability

| #   | Where                        | Level          | Fingerprint                                                   |
| --- | ---------------------------- | -------------- | ------------------------------------------------------------- |
| O1  | `handleUnfurl`, blocked      | `console.warn` | `[unfurl] blocked stage=<input\|redirect> host=<host>`        |
| O2  | `handleUnfurl`, fetch failed | `console.info` | `[unfurl] fetch-failed host=<host> reason=<timeout\|network>` |
| O3  | `handleUnfurl`, done         | `console.info` | `[unfurl] ok host=<host> html=<bool> fields=<n>`              |
| O4  | `apiUnfurl`, null            | `console.info` | `[unfurl] client-miss status=<n>`                             |

None exists today (GB15). Telemetry `Element / Added / LinkCard` and `Element / Changed /
LinkUnfurled` exist.

## Testing

| Rule                                                    | Test                                                        | File                                             |
| ------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| Blocked hosts and ranges                                | `blocks loopback / localhost / .local / metadata + private` | `apps/api/src/routes/unfurl.test.ts`             |
| Public hosts allowed                                    | `allows public hosts + public IPs`                          | `apps/api/src/routes/unfurl.test.ts`             |
| Domains starting `fc` / `fd` allowed `[QB12]`           | none                                                        |                                                  |
| http(s) only                                            | `parsePublicHttpUrl` suite                                  | `apps/api/src/routes/unfurl.test.ts`             |
| og:\* precedence, relative resolution, favicon fallback | `buildUnfurlResult` suite                                   | `apps/api/src/routes/unfurl.test.ts`             |
| Rate limit, redirect re-check, non-HTML, timeout, cap   | none (GB16)                                                 |                                                  |
| 280×120 factory, no link or meta                        | `createLinkCard is a 280x120 boxed bookmark…`               | `packages/document/src/factories.test.ts`        |
| Drawn to size                                           | `draws a link card to the dragged box`                      | `apps/live/lib/draw-commit.test.ts`              |
| Draw banner copy                                        | `drawBannerMessage` case                                    | `apps/live/lib/draw-mode.test.ts`                |
| Telemetry token `LinkCard`                              | `elementTelemetryType` case                                 | `apps/live/lib/element-telemetry.test.ts`        |
| Boxed                                                   | `isBoxed is true for every boxed-element kind…`             | `packages/document/src/geometry.test.ts`         |
| No inline text                                          | `is false for label-less kinds…`                            | `packages/document/src/element-has-text.test.ts` |
| Shadow supported                                        | `supportsShadow` suite                                      | `packages/document/src/shadow.test.ts`           |
| Theme leaves cards alone                                | none                                                        |                                                  |
| Stale-meta guard, unfurl only for cards, meta commit    | none (GB9, GB11, GB16)                                      |                                                  |
| Contrast                                                | none (GB14)                                                 |                                                  |

## Constants and configuration

| Name                  | Value                                               | Provenance / safe range                            |
| --------------------- | --------------------------------------------------- | -------------------------------------------------- |
| `FETCH_TIMEOUT_MS`    | `8000`                                              | Spec 8 s; 3 000 to 10 000 within the Worker budget |
| `MAX_HTML_BYTES`      | `512 * 1024`                                        | Spec ~512 KB; the head is rarely past 100 KiB      |
| `USER_AGENT`          | `livediagram-unfurl/1.0 (+https://livediagram.app)` | Spec "descriptive"; keep a contact URL             |
| `UNFURL_RATE_LIMITER` | 60 per 60 s, namespace `1005`                       | Spec; production and staging                       |
| `createLinkCard` size | 280 × 120                                           | Spec                                               |
| Card radius           | 10 px canvas, 6 px export                           | `element-variant.ts`, `svg-render.ts` (D56)        |
| Default colours       | fill `#ffffff`, stroke `#e2e8f0`, text `#1e293b`    | `colors.ts`; text on fill 14.6:1                   |
