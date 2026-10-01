# Image search: blueprint

Derived from [Image search](../image-search.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`. The picker, gallery and upload rules it plugs into are in [Images](images.md); the
storage path is the [Import image pipeline](../../020-import-export/import-image-pipeline.md).

Scope, by file:

| File                                                  | Role                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/document/src/element-types.ts`              | `ImageCredit`, `ImageElement.credit`                                   |
| `packages/document/src/validate.ts`                   | `isImageCredit`: structural check of `credit`                          |
| `apps/live/lib/image-search/openverse.ts`             | Pure: `openverseSearchUrl`, `parseOpenverseSearch`, `creditFor`        |
| `apps/live/lib/image-search/search.ts`                | `searchOpenverse`: one page over an injected `fetch`, typed errors     |
| `apps/live/lib/image-search/pick.ts`                  | `storeSearchResult`: download (full, else thumbnail) and store         |
| `apps/live/hooks/ui/useImageSearch.ts`                | Search tab state: query, pages, status, picking                        |
| `apps/live/components/panels/ImageSearchPane.tsx`     | The Search tab's form, grid, states and footer credit                  |
| `apps/live/components/panels/ImagePicker.tsx`         | Third tab; `onSelect(image: PickedImage)` carries the credit           |
| `apps/live/hooks/canvas/useEditorImages.ts`           | `applyImageToElement` sets / drops `credit`; detach drops it           |
| `apps/live/components/palette/ElementContentSections` | Credit line in the Image section                                       |
| `apps/help/app/policies/privacy-policy/page.mdx`      | Openverse named under Service providers                                |

## Domain and naming

| Term          | Identifier                     | Meaning                                                           |
| ------------- | ------------------------------ | ----------------------------------------------------------------- |
| Search result | `OpenverseImage`               | One parsed Openverse result: id, title, urls, size, creator, licence |
| Results page  | `OpenverseSearchPage`          | `{ results, page, pageCount }`                                    |
| Search error  | `OpenverseSearchError`         | Thrown by `searchOpenverse`; `.kind` is `'rate-limited' \| 'failed'` |
| Credit        | `ImageCredit`                  | `{ text, sourceUrl, licenseUrl? }` on `ImageElement.credit`       |
| Licence label | `licenceLabel(code, version)`  | `cc0` → `CC0 1.0`, `pdm` → `Public Domain Mark 1.0`, else `CC BY-SA 4.0` |
| Picked image  | `PickedImage`                  | What the picker hands back: id, width, height, `originalName?`, `credit?` |

Banned synonyms: "stock photo", "attribution" in code (say credit), "license" in UI copy (say
licence), "Unsplash".

## Behaviour and state

`useImageSearch` holds one state:

| Field     | Type                                        | Initial  |
| --------- | ------------------------------------------- | -------- |
| `query`   | `string` (the submitted query, trimmed)     | `''`     |
| `results` | `OpenverseImage[]`                          | `[]`     |
| `page`    | `number` (last page loaded)                 | `0`      |
| `pageCount` | `number`                                  | `0`      |
| `status`  | `'idle' \| 'loading' \| 'ready' \| 'error'` | `'idle'` |
| `error`   | `'rate-limited' \| 'failed' \| null`        | `null`   |
| `pickingId` | `string \| null`                          | `null`   |
| `pickError` | `string \| null`                          | `null`   |

Transitions:

1. **Submit(q).** `q.trim()` empty: no-op. Else `status = 'loading'`, `error = null`,
   `pickError = null`, track `Element / Searched / Image`, request page 1. Success replaces `results`,
   sets `query`, `page = 1`, `pageCount`, `status = 'ready'`. Failure: `status = 'error'`,
   `error = err.kind`; previous results are kept (they stay dimmed only while loading).
2. **Load more.** Allowed when `status === 'ready'` and `page < pageCount`. Requests `page + 1` of
   `query`; success appends results, dropping any whose `id` is already shown (D148).
3. **Stale answers.** Each request takes a sequence number; an answer whose number is not the latest
   is dropped, so a slow first search can't overwrite a second.
4. **Pick(result).** Guard: `pickingId === null`. Sets `pickingId`, clears `pickError`, runs
   `storeSearchResult`. Success: calls `onPicked({ id, width, height, originalName: title, credit })`
   and tracks `Element / Added / ImageSearch` in the editor's apply step. Failure: `pickError` = the
   copy for the failure; `pickingId = null`.

`storeSearchResult(result, session, fetch)`:

1. Fetch `result.url` (`mode: 'cors'`, `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`).
   A network error, a non-2xx answer, or a `Content-Type` that doesn't start with `image/` → step 3.
2. `session.store({ kind: 'blob', blob, name })`. `ok` → done. Failure `unsupported` or
   `missing-bytes` → step 3. Any other failure is final.
3. The same fetch of `result.thumbnail`, then `session.store`. A download failure here is final as
   `download-failed`.

`name` is the result's title, else `openverse-<id>` (D149).

Credit lifecycle on the element (`useEditorImages`):

- `applyImageToElement(id, picked)`: `credit: picked.credit` when present, else the key is deleted.
  `alt` keeps `el.alt ?? picked.originalName`.
- `removeImageFromElement(id)`: deletes `credit` with `naturalWidth` / `naturalHeight`.

## Interfaces and contracts

Search request, built by `openverseSearchUrl(query, page)`:

```
GET https://api.openverse.org/v1/images/
  ?q=<query>&page=<n>&page_size=20
  &license_type=commercial,modification&mature=false
```

`parseOpenverseSearch(json)` accepts an object with numeric `page_count` and an array `results`.
Each result keeps only: `id`, `url`, `thumbnail` (non-empty strings, `url` and `thumbnail` must be
`https:`), `width`, `height` (positive numbers, else `null`), `title`, `creator`, `license`,
`license_version`, `license_url`, `foreign_landing_url` (strings or absent). A result failing the
required fields is dropped, not fatal (D150). A non-object or missing `results` throws
`OpenverseSearchError('failed')`.

`searchOpenverse(query, page, fetch)`: HTTP 429 → `OpenverseSearchError('rate-limited')`; any other
non-2xx, a network error or a parse failure → `OpenverseSearchError('failed')`.

`creditFor(result): ImageCredit | undefined`:

- `sourceUrl` = `foreign_landing_url`; when missing, no credit (nothing to link) (D151).
- `text` = `"<title>"` then ` by <creator>` then `, <licence label>`, each part only when known;
  trimmed, then cut to 300 characters.
- `licenseUrl` = `license_url` when it is an `http(s):` URL.

`ImageCredit` validation (`isImageCredit` in `validate.ts`): object; `text` a string of 1 to 300
characters; `sourceUrl` and optional `licenseUrl` strings of at most 2048 characters starting with
`https://` or `http://`. Otherwise the element is invalid.

## Data and persistence

- `credit` is an optional field of the image element in `tabs.data`; it rides the normal autosave,
  realtime `update-element` op, undo, change log and copy paths with no new branch.
- No migration: absent means "no credit", which every existing image is.
- The gallery row is an ordinary upload; its `original_name` is the result's title (or
  `openverse-<id>`). The gallery does not store the credit (D152).
- Openverse responses are not cached by livediagram; the browser's HTTP cache applies.

## Errors and edge cases

| Case                                           | Handling                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| Empty / whitespace query                       | Submit no-op; no request, no telemetry                           |
| 429 from Openverse                             | `error = 'rate-limited'`, copy "Too many searches for now…"       |
| Network / 5xx / malformed JSON                 | `error = 'failed'`, copy "Couldn't reach Openverse…"              |
| Zero results                                   | `status = 'ready'`, empty copy with the query                     |
| Load more past the last page                   | Button hidden when `page >= pageCount`                            |
| Full image blocked by CORS / not an image      | Thumbnail fallback                                                |
| Full image is SVG or > 50 MB source            | Pipeline rasterises SVG; > 50 MB is `too-large`, final (spec limit) |
| Both downloads fail                            | "Couldn't download that image. Try another one."                  |
| Gallery full / images unavailable / too large  | The pipeline failure's upload copy (table below)                  |
| Offline Mode document                          | Session embeds as data URI; over budget → "too large" copy        |
| Picker closed mid-pick                         | The store finishes; `onPicked` is ignored after unmount (D153)    |
| Result with no landing URL                     | Stored without `credit`                                           |

Pick failure copy (`pickFailureMessage`):

| Failure                         | Copy                                                              |
| ------------------------------- | ----------------------------------------------------------------- |
| `gallery-full`                  | Your image gallery is full. Delete some images and try again.     |
| `images-unavailable`            | Image uploads are not available on this server.                   |
| `too-large`, `offline-budget`   | That image is too large to add.                                   |
| everything else                 | Couldn't download that image. Try another one.                    |

## Security and trust

- Openverse answers are untrusted: only the parsed fields are used, URLs must be `https:` to be
  fetched, and every text value reaches the DOM as React text, never HTML.
- Downloaded bytes go through the pipeline's sniff, decode and re-encode, and then the api worker's
  upload checks (type sniff, size, caps); nothing is stored unseen.
- Fetches send no cookies (`credentials: 'omit'`) and no referrer.
- Credit links render as `<a target="_blank" rel="noopener noreferrer">`, and `validate.ts` refuses a
  non-http(s) URL, so a crafted document can't plant a `javascript:` link.
- Rate limits are Openverse's per-IP limits; the button is disabled while loading, and search runs
  only on submit.

## Performance and limits

- 20 results per page; thumbnails come from Openverse's thumbnail endpoint (about 600 px, 30 to
  80 kB), `loading="lazy"`, `decoding="async"`.
- A pick downloads one full image (Flickr's `_b` sizes are about 1024 px; the largest seen are
  around 4500 px), then the pipeline caps it at 2048 px.
- `ImageSearchPane` is part of the lazily loaded picker chunk; the pipeline's browser module is
  imported on first pick.

## Presentation and UX

- Tab label "Search", third after Upload and Gallery; picker still opens on Upload.
- Form: `TextInput` with placeholder "Search openly licensed images" (`type="search"`), `Button`
  "Search". Autofocus when the tab mounts.
- Idle: "Find openly licensed photos and illustrations from Openverse."
- Loading: grid at `opacity-50`, `aria-busy`, a "Searching…" line; Search button disabled.
- Grid: `grid-cols-4 gap-2`, square tiles (`aspect-square`, `object-cover`), max height `max-h-72`
  scrolling, as the Gallery grid. Hover / focus shows an overlay with the creator and licence label.
- Load more: secondary `Button` "Load more" under the grid.
- Empty: "No images match “<query>”. Try a broader word."
- Errors: the two copies in the spec, in the Gallery's rose error box.
- Picking: a spinner over the picked tile, other tiles disabled.
- Footer: "Images from Openverse" link (`https://openverse.org`), `text-[11px]` slate.
- Image panel credit: under the Image tiles, a `ContextMenuDivider` then a row: label "Credit",
  the credit text (wrapping, `text-xs`), then "Source" and "Licence" links.

## Accessibility

- Tiles are `<button>`s labelled "Use <title> by <creator>" (parts omitted when unknown); the thumbnail
  `<img alt="">` since the button carries the name.
- The search form is a `<form role="search">` with a visually hidden `<label>` "Search images".
- Status lines (searching, empty, error) sit in an `aria-live="polite"` region.
- Overlay text shows on `:focus-visible` as well as hover.

## Web experience

- **CLS**: square tiles via `aspect-square` reserve their space before thumbnails load.
- **INP**: submit and pick do their work after the click handler returns (async); no main-thread
  decode in the handler.
- **LCP**: the picker is code-split; nothing loads until the Search tab is opened and a query sent.

## Observability

| #   | Where                     | Level          | Fingerprint                                           |
| --- | ------------------------- | -------------- | ----------------------------------------------------- |
| O1  | Search failed             | `console.warn` | `[image-search] search failed kind=<kind> status=<n>` |
| O2  | Full image fell back      | `console.info` | `[image-search] thumbnail fallback reason=<reason>`   |
| O3  | Pick failed               | `console.warn` | `[image-search] pick failed failure=<failure>`        |
| O4  | Pipeline outcome          | (pipeline)     | `[import-images] <outcome>`                           |

## Testing

| Rule                                                        | Test file                                           |
| ----------------------------------------------------------- | --------------------------------------------------- |
| URL carries q, page, page_size 20, licence filter, mature   | `apps/live/lib/image-search/openverse.test.ts`      |
| Parse keeps valid results, drops broken ones, rejects junk  | `apps/live/lib/image-search/openverse.test.ts`      |
| Credit text, licence labels, no landing URL → no credit     | `apps/live/lib/image-search/openverse.test.ts`      |
| 429 → rate-limited; 500, network, bad JSON → failed         | `apps/live/lib/image-search/search.test.ts`         |
| Full image stored; CORS / non-image / unsupported → thumb   | `apps/live/lib/image-search/pick.test.ts`           |
| Gallery-full is final; both downloads fail → download-failed | `apps/live/lib/image-search/pick.test.ts`          |
| `credit` validation accepts good, rejects bad text / URLs   | `packages/document/src/validate.test.ts`            |
| Search tab end to end                                       | Browser verification (no e2e: external network)     |

## Constants and configuration

| Name                         | Value                              | Provenance / safe range                               |
| ---------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `OPENVERSE_API_BASE`         | `https://api.openverse.org/v1`     | Openverse public API                                  |
| `OPENVERSE_PAGE_SIZE`        | `20`                               | Openverse's anonymous maximum; 1 to 20                |
| `OPENVERSE_LICENSE_TYPE`     | `commercial,modification`          | Spec "Which pictures"                                 |
| `IMAGE_CREDIT_TEXT_MAX`      | `300`                              | Spec validation; a credit line, not prose             |
| `IMAGE_CREDIT_URL_MAX`       | `2048`                             | Spec validation; common URL ceiling                   |
