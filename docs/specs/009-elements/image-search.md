# Image search

The image picker ([Image element + per-owner gallery](images.md)) has a third tab, **Search**, beside
Upload and Gallery. The user types what they want ("server rack", "team meeting"), gets a grid of
openly licensed pictures back, and clicks one to put it on the canvas. The picture lands in their
gallery like any upload, so it then behaves exactly like an image they uploaded themselves.

## Source: Openverse

Results come from [Openverse](https://openverse.org), the WordPress Foundation's search engine over
openly licensed media (Flickr, Wikimedia Commons, Rawpixel and others).

- **Free, no key, no account.** Search needs no credentials, so the feature works on every
  self-hosted deployment with no setup and adds no secret ([Secrets policy](../002-project-scope/secrets-policy.md)).
- **Licences allow copying.** Openverse only indexes Creative Commons and public-domain works, so a
  picked picture may be copied into the owner's gallery (R2). That keeps the
  [element model](images.md#element-model) unchanged: there is still no external-URL image, and
  export, offline mode, the live image and retention all work as they do for an upload.
- **Why not Unsplash.** Unsplash's API terms require hotlinking its URLs (no copying), a server-side
  key, and a shared hourly quota; that would need a second, external kind of image element.

## Which pictures

Every search asks Openverse only for pictures whose licence permits **both commercial use and
modification** (`license_type=commercial,modification`): CC0, Public Domain Mark, CC BY and
CC BY-SA. A diagram may be used at work, and putting a picture on the canvas crops and resizes it,
so NonCommercial and NoDerivatives works are never offered. Mature results are excluded
(Openverse's default, kept explicit).

## Where the requests go

The search runs **from the user's browser straight to Openverse** (`api.openverse.org`, which allows
cross-origin requests), not through the api worker:

- Openverse rate-limits anonymous callers per IP address (20 searches a minute, 200 a day). From the
  browser each user has their own allowance; through the worker every user would share one.
- No livediagram server sees the query.

Picking a result downloads the picture in the browser too: first the full-size file from its host,
and if that fails (the host refuses cross-origin reads, is down, or returns something that is not an
image) Openverse's own thumbnail of it instead, which is always a cross-origin-readable raster.
The bytes then go through the [Import image pipeline](../020-import-export/import-image-pipeline.md)
unchanged: decoded, resized to at most 2048 px on the longer edge, re-encoded (which also drops any
metadata), deduped and uploaded to the gallery, or embedded for an
[Offline Mode](../006-document/offline-mode.md) document. Because the pipeline rasterises SVG, an SVG
result is accepted and stored as a bitmap; SVG is still never stored as SVG.

The user's search terms and IP address reach Openverse. The hosted service's
[Privacy Policy](/help/policies/privacy-policy/) names Openverse as a provider for this feature.

## The Search tab

- **Form.** A search field ("Search openly licensed images") and a **Search** button. A search runs on
  Enter or the button, never on each keystroke, so typing doesn't spend the user's allowance. An
  empty or whitespace-only query does nothing. The field takes focus when the tab opens.
- **Before searching.** A short line: "Find openly licensed photos and illustrations from Openverse."
- **Loading.** The previous results stay visible, dimmed, with "Searching…"; the button is disabled.
- **Results.** A 4-column grid of square thumbnails, 20 per page. Each tile names its creator and
  licence on hover and focus. **Load more** under the grid fetches the next page and appends it, until
  Openverse reports no more pages.
- **No results.** "No images match “<query>”. Try a broader word."
- **Errors.**
  - Rate limited (HTTP 429): "Too many searches for now. Wait a minute and try again."
  - Anything else (network, Openverse down, a malformed answer): "Couldn't reach Openverse. Check
    your connection and try again."
- **Picking.** Clicking a tile shows a spinner on that tile and disables the rest. On success the
  picker behaves as for an upload: the element gets the image and the modal closes. On failure the
  tile's error shows under the grid in the upload copy ("Your image gallery is full…", "Image uploads
  are not available on this server.", or "Couldn't download that image. Try another one.").
- **Footer credit.** "Images from Openverse" links to openverse.org, at the foot of the tab.

The tab is the last of the three and the picker still opens on Upload.

## Credit on the element

Most Openverse licences (CC BY, CC BY-SA) require crediting the creator. A picked picture carries
its credit on the element:

```ts
type ImageCredit = {
  // The human-readable credit: “"<title>" by <creator>, <licence label>”, e.g.
  // “"Cat Fish 2" by admiller, CC BY 2.0”. Parts Openverse leaves out are omitted.
  text: string;
  // The picture's page at its source (Openverse's foreign_landing_url).
  sourceUrl: string;
  // The licence deed (Openverse's license_url), when known.
  licenseUrl?: string;
};

type ImageElement = {
  // ...the fields in images.md
  credit?: ImageCredit;
};
```

- **Set on pick.** Picking a search result sets `credit`, and `alt` to the picture's title when
  the element has no alt text yet (as an upload does with its file name).
- **Cleared on change.** Attaching any other image (upload, gallery, another search result) replaces
  or removes `credit`, and **Remove from element** removes it, so a credit never describes a picture
  that is no longer there.
- **Shown in the Image panel.** The element's **Image** section shows a **Credit** line: the credit
  text, a **Source** link and, when known, a **Licence** link, both opening in a new tab.
- **Validated** like the rest of the element: `text` is a string of 1 to 300 characters, and the two
  URLs are `https:` or `http:` addresses of at most 2048 characters; an element breaking that is
  rejected.

## Telemetry

Following [Telemetry](../017-telemetry/telemetry.md):

- `Element / Searched / Image` once per submitted search (not per page).
- `Element / Added / ImageSearch` when a picked result is attached.

Never the query, a title or a creator.

## Out of scope

- **Credit in exports.** PNG, SVG, PDF and Markdown exports don't print the credit yet; it lives on
  the element and in the Image panel.
- **Filters.** No licence, colour, orientation or source pickers; the commercial-and-modification
  filter is fixed.
- **Other providers.** Openverse only. A keyed provider (Unsplash, Pexels) would need the api worker
  as a proxy and is not planned.
