# Animated GIF export blueprint

Derived from [Animated GIF export](../animated-gif-export.md). Everything lives in `apps/live` (the only app with the
canvas DOM it captures); nothing in it is shared with another app.

## Domain and naming

| Term (spec)     | Identifier                                                                         |
| --------------- | ---------------------------------------------------------------------------------- |
| the GIF format  | `'gif'` in `ExportFormatKey` (`packages/plan-art/src/plan-export-formats.ts`)      |
| each page holds | `holdSeconds` (one number for every page)                                          |
| size            | `GifSize` = `'small' \| 'medium' \| 'large'`                                       |
| a page's clock  | `t` (ms since the page came in)                                                    |
| a frame         | `GifFrame` (`lib/gif-export/gif-timeline.ts`)                                      |
| a still page    | a page whose snapshot has no running animation (`PageSnapshot.animated === false`) |
| the snapshot    | `PageSnapshot` (`lib/gif-export/page-snapshot.ts`)                                 |
| editor-only     | `GIF_OMIT_ATTR` / `GIF_OMIT_SELECTOR` (`lib/gif-export/gif-omit.ts`), `GifOmit`    |
| a failure       | `GifExportError` + `GifExportErrorCode` (`lib/gif-export/gif-export-error.ts`)     |
| the transition  | `SlideTransition` + `SlideSpeed` from `lib/presentation-config.ts`                 |

## Constants and configuration

All in `lib/gif-export/gif-timeline.ts`.

| Constant             | Value                                      | Provenance / safe range                                                    |
| -------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| `GIF_FPS`            | 15                                         | Spec. GIF delays are centiseconds: 15 fps is exact over 3 frames (7, 6, 7) |
| `GIF_HOLD_MIN_S`     | 1                                          | Spec                                                                       |
| `GIF_HOLD_MAX_S`     | 20                                         | Spec                                                                       |
| `GIF_HOLD_STEP_S`    | 0.5                                        | Spec                                                                       |
| `GIF_HOLD_DEFAULT_S` | 3                                          | Spec                                                                       |
| `GIF_MAX_TOTAL_S`    | 180                                        | Spec (3 minutes)                                                           |
| `GIF_SIZE_LONG_SIDE` | `{ small: 480, medium: 960, large: 1440 }` | Spec                                                                       |
| `GIF_LARGE_BYTES`    | 15 MB                                      | Spec's warning line                                                        |
| `SLIDE_EASE`         | `cubicBezier(0.4, 0, 0.2, 1)`              | `app/canvas-motion.css` `lvd-slide-forward`                                |
| `FADE_EASE`          | `cubicBezier(0.25, 0.1, 0.25, 1)`          | CSS `ease`, `lvd-slide-fade`                                               |

`cubicBezier` is exported from `lib/page-motion-frame.ts` (already written there) rather than restated.

In `lib/gif-export/gif-estimate.ts`: `GIF_HEADER_BYTES` 800 (D48) and `GIF_ESTIMATE_DELAY_MS` 250 (D47). In
`lib/gif-export/snapshot-media.ts`: `TRANSPARENT_PIXEL`, a 1 x 1 see-through PNG (D49). In
`lib/gif-export/gif-encode-core.ts`: 256 colours, `rgb565` quantising (gifenc's best quality),
`PALETTE_SAMPLE_STRIDE` 4 (D53). In `lib/gif-export/make-gif.ts`: `PALETTE_SAMPLES` 3 (D53). No dither: an ordered
4 x 4 dither at strength 5 smoothed the last faint gradient steps but made the test GIF 70% bigger (6.5 to
11.1 MB), so it was left out.

## Behaviour and state

### The timeline (`gifTimeline`, pure)

Input: `{ pageCount, holdSeconds, transition, transitionMs, stillPages: ReadonlySet<number>, loops: boolean }`
(`loops` is All pages with two or more pages; One page passes `pageCount: 1`, `loops: false`).
Output: `GifFrame[]`, each `{ page, t, from?: { page, t }, mix, delayCs }`.

1. `holdMs = holdSeconds * 1000`; `tr = loops && transition !== 'none' ? min(transitionMs, holdMs / 2) : 0`.
2. Frame times inside one page: `k = 0 .. ceil(holdMs * GIF_FPS / 1000) - 1`, at `t = round(k * 1000 / GIF_FPS)`.
3. A frame with `t < tr` is a transition frame. `from = { page: the previous page (the last, for the first page),
t: holdMs + t }`: the outgoing page was shown for its whole hold and its clock runs on under the transition.
   `mix = ease(t / tr)`, `SLIDE_EASE` for Slide, `FADE_EASE` for Fade.
4. Delays: a frame's start in centiseconds is `round(globalIndex * 100 / GIF_FPS)`; its delay is the next start
   minus its own. The last frame of a page ends exactly at the page's end (`holdMs / 10` cs from its start), so
   holds are exact.
5. A still page (`stillPages.has(page)`) keeps its transition frames (the outgoing page may move) and then one
   frame at `t = tr` whose delay runs to the page's end. With `tr = 0` a still page is exactly one frame.
6. `gifTotalSeconds(pageCount, holdSeconds) = pageCount * holdSeconds`; `gifTooLong(...)` is
   `> GIF_MAX_TOTAL_S`.
7. `gifHoldDefault(autoAdvanceSeconds)`: `autoAdvanceSeconds > 0` clamped to `[GIF_HOLD_MIN_S, GIF_HOLD_MAX_S]`,
   else `GIF_HOLD_DEFAULT_S`.
8. `gifFrameSize(page.rect, size)`: the long side `GIF_SIZE_LONG_SIDE[size]`, the other `round(long * short /
longSide)`, at least 1.

### The snapshot (`snapshotPage`, browser)

`snapshotPage(pageId, { width, height, fontCss, css, images })`, called once per page per export. Steps:

1. The page node is `[data-illustrate-page-id="<id>"]`; its canvas root is `node.closest('[data-canvas-root]')`;
   the content is `root.querySelector('[data-canvas-content]')`. Missing: `GifExportError('page-missing')`.
2. **Clone** the content (`cloneNode(true)`). The live tree and the clone are listed in document order
   (`[content, ...querySelectorAll('*')]`), so a live node and its twin share an index.
3. **Leave out** (live nodes, a parent before its children, so everything inside goes too): every other
   `[data-illustrate-page-id]`; every outermost `[data-element-id]` whose screen box misses this page's (a frame then
   draws one page's DOM, not the whole deck's); and every node matching `GIF_OMIT_SELECTOR`: `[data-gif-omit]`
   (the `GifOmit` wrapper round the drafts, cursors, laser, agent overlays and avatars; the page navigator, the
   first-page kind choice, the in-page layout card and an empty logo page's guides), `[data-selection-grips]` and
   `[data-comment-trigger]`. Page title bars and the add-page button sit outside the page's box and are cropped.
4. **Animation table**, read inside `withFullMotion` (below): for each kept node and each of `''`, `'::before'`,
   `'::after'` whose computed `animation-name` is not `none`, a row `{ id, pseudo, delaysMs[] }` from the computed
   `animation-delay` list (`parseDelays`), the twin tagged `data-gif-id="<id>"` (one tag a node, its index).
   `animated = rows.length > 0`. Finished play-once animations are found too (computed style, not
   `getAnimations`).
5. **Media** (`inlineMedia`, `snapshot-media.ts`), while the twins still line up: an `<img>` gets its live twin's
   `currentSrc || src` as a `data:` URL (`srcset` and `loading` removed); an SVG `<image>` its `href`; any inline
   `style` with `url(...)` each URL; a `<canvas>` becomes an `<img>` of its `toDataURL()`; a `<video>` an `<img>` of
   its poster; an `<iframe>` a see-through `<img>`, each keeping the node's class, style and size. Reads go through
   one `ImageInliner` per export (`createImageInliner`: fetch, `FileReader`, one promise a URL); a failed read is
   `TRANSPARENT_PIXEL` and never aborts.
6. Then the left-out twins are removed.
7. **CSS** (`collectCss(document.styleSheets)`, once per export): every same-origin rule; a `@media` whose condition
   names `prefers-reduced-motion` is dropped when it answers `reduce` and written unwrapped when it answers
   `no-preference` (inside the image those queries would answer for the exporter's screen); `@layer`, `@supports`,
   `@container` and other `@media` rules are rewritten round their filtered rules. Cross-origin sheets (the
   webfonts) are skipped: the tab's fonts come as `embeddedFontFaceCss` of `exportFontIds` plus every page's
   writing fonts. The `<svg>` and the wrapper both take `<html>`'s classes minus `reduce-motion` and its inline
   style; the wrapper also takes the canvas root's inherited text properties (colour, font, line height,
   smoothing), which `html` and `body` rules no longer reach.
8. **Crop**: the page's screen box `P` and the root's `R`; `scale = width / P.width`; a box of the root's size,
   `transform: translate((R - P) * scale) scale(scale)`, `transform-origin: 0 0` (`cropTransform`), inside a
   `width x height` wrapper with `overflow: hidden`.
9. `urlAt(t)`: `data:image/svg+xml;charset=utf-8,` + the URL-encoded SVG `<svg><style><![CDATA[fonts + css +
pinRules(rows, t)]]></style><foreignObject>…</foreignObject></svg>`. The parts before and after the rules are
   encoded once (encoding parts is encoding the whole, the cut being ASCII); a frame encodes only its rules.
   `pinRules`: `*,*::before,*::after{animation-play-state:paused!important}`, then per row
   `[data-gif-id="n"]<pseudo>{animation-delay:<d_i - t>ms,…!important;animation-play-state:paused!important}`.
   `]]>` in any CSS is split across two CDATA sections.

**`withFullMotion(sheets, html, read)`** (`snapshot-css.ts`): sets every `prefers-reduced-motion` media rule's
`mediaText` to `all` (no-preference) or `not all` (reduce) and takes `reduce-motion` off `<html>`, runs `read`, and
restores both in a `finally`. One synchronous task, so the screen never paints the change; without it a viewer with
Reduce Motion on (the system's or the app's) would read every page as still.

### Frames (`page-frames.ts`, browser)

- `loadSvg(url)`: an `Image` of the snapshot's `data:` URL (a blob URL taints in Chromium), `decode()`; a decode
  failure is `GifExportError('failed')`.
- `createFrameDrawer(width, height, transition)`: one canvas (`willReadFrequently`) for the export. `draw(frame,
snapshotOf)` loads the incoming page at `frame.t` and, under a transition, the outgoing page at `frame.from.t` (in
  parallel), composes them and returns `getImageData(...).data` (a fresh buffer: it is transferred to the worker);
  a throw from `getImageData` is `GifExportError('tainted')`.
- `composeFrame(ctx, frame, transition, w, h, { incoming, outgoing })`: white paper first, always (a logo page's
  see-through paper). No `from` or `none`: the incoming page. Fade: the outgoing page, then the incoming with
  `globalAlpha = mix`. Slide: the outgoing at `x = -round(mix * w)`, the incoming at `w - round(mix * w)`.

### The encoder (`gif-encode-core.ts`, `gif-encode.worker.ts`, `gif-encoder.ts`)

- `createGifWriter(w, h)` (`gif-encode-core.ts`, pure over `gifenc`): `add(rgba, delayCs, palette?)`, `written`,
  `finish()`. Each written frame: its page's palette, or for a transition frame its own `quantize(rgba, 256, {
format: 'rgb565' })`; `indexFrame`; `writeFrame(index, w, h, { palette, delay: delayCs * 10, repeat: 0 })`
  (`repeat: 0` on the first frame writes the loop-forever extension).
- `pagePalette(samples)`: `quantize` over every `PALETTE_SAMPLE_STRIDE`-th pixel of the page's sample frames.
- `indexFrame(rgba, palette)`: each pixel's index through a 65,536-entry table per palette (a `WeakMap`), one entry
  per 5-6-5 bucket, filled on first use with the nearest colour to the bucket's centre. gifenc's own `applyPalette`
  fills a bucket from whichever pixel reaches it first, so a colour could map one way in one frame and another way
  in the next; measured on the seeded aurora slide, 2 to 49% of background pixels changed between consecutive
  frames with it (the source changes 0%), and 1 to 2% with `indexFrame` and the shared palette.
  **Merge**: the writer holds the last frame back; a next frame whose bytes are equal (compared four at a time)
  adds its delay to the held one instead of being written (D46).
- `sampleFrameBytes(rgba, w, h)`: one frame's bytes with a local colour table, for the estimate (main thread, by
  dynamic import, so `gifenc` is in neither first-load JS nor the panel's chunk).
- The worker (`gif-encode.worker.ts`) runs a writer. Messages in (`gif-encode-protocol.ts`): `start { width, height
}`, `palette { key, samples: ArrayBuffer[] (transferred) }`, `frame { rgba: ArrayBuffer (transferred), delayCs,
palette?: key }`, `finish`. Out: `done { bytes: ArrayBuffer (transferred),
written }`, `failed { message }`. Cancel is `terminate()`.
- `openGifEncoder(w, h)` (`gif-encoder.ts`): `palette(key, samples)` and `add(rgba, delayCs, palette?)`, one module
  worker per GIF (`new Worker(new URL(...), { type: 'module'
})`, as the other workers here). `add` transfers the buffer, `finish` resolves with the bytes or rejects on
  `failed` or a worker `error`, `cancel` terminates. Where a worker cannot start, the same writer runs on the page,
  queued.

### The hook (`useGifExport`) and panel (`GifExportPanel`)

Both in `components/dialogs/gif/`. State: the presentation config (`loadPresentationConfig()`, read once), `holdSeconds`
(`gifHoldDefault(config.autoAdvanceSeconds)`), `size` (`'medium'`), `scope` (`'all'`), `phase` = `idle |
making(progress) | error(code)`, `estimate` = `{ bytes, previewUrl } | null`, an `AbortController`. The page (One
page's, and the preview's) is the dialog's `page`, picked with the dialog's `onPick`. `loops = scope === 'all' &&
pages.length > 1`; the transition is `config.transition`, its length `SLIDE_SPEEDS[config.speed].ms`.

- **Capture**, once per panel: `collectCss(document.styleSheets)`, `embeddedFontFaceCss(gifFontIds(tab, pages))` and
  one `createImageInliner()`.
- **Estimate**: 250 ms after the options settle (D47), snapshot each chosen page whose stillness is not yet known
  (a map by page id, kept for the panel) and the preview page at the chosen size; draw the preview page's `t = 0`;
  `sampleFrameBytes`; `estimateGifBytes(sample, gifTimeline(...))` = `sample * frames + GIF_HEADER_BYTES` (D48),
  shown with `gifSizeLabel`. The preview is that snapshot's `urlAt(0)` in an `<img>` on white. A snapshot error
  shows its line; the next estimate that works clears it.
- **Make** (`makeGif`, `lib/gif-export/make-gif.ts`): snapshot every chosen page first (stillness decides the frame
  count), build the timeline, then each page's palette (`paletteSamples`: its first, middle and last frames outside a transition, drawn and sent with `encoder.palette(page, ...)`, a task between pages), then for each frame: stop if aborted, `drawer.draw`, `encoder.add(rgba, delayCs, frame.from ? undefined : frame.page)`, drop a snapshot
  after its last use (as itself or as an outgoing page), progress = frames done / total, yield a task
  (`setTimeout 0`, D52). Then `encoder.finish()`. An abort is an `AbortError`; a `GifExportError` passes on; any
  other failure is `GifExportError('failed')`; either way the encoder is cancelled.
- **Download**: `downloadBlob(new Blob([bytes], { type: 'image/gif' }), name + '.gif')`, then telemetry, then the
  dialog closes.
- Closing the dialog mid-make aborts (the hook's unmount).
- The dialog lazy-loads the panel (`lazy(() => import('./gif/GifExportPanel'))` under `Suspense`, fallback
  "Preparing the GIF options…"), and does not load the PNG/SVG preview images for the GIF card.

## Interfaces and contracts

- `ExportFormatKey` (`packages/plan-art/src/plan-export-formats.ts`) gains `'gif'`; `ILLUSTRATE_FORMATS`
  (`ExportTabDialog.tsx`) becomes `['pdf', 'png', 'svg', 'gif', 'file']`. Off Illustrate the card list leaves out
  `'gif'` with `'logo-kit'`, and `PLAN_TAB_FORMATS` never includes it.
- `GifExportError` codes: `'page-missing' | 'tainted' | 'failed'`; the panel maps them to the spec's three lines
  (`GIF_ERROR_COPY`).
- `ExportPagePicker` takes `format: PageExportFormat | 'gif'` for its outcome line.

## Data and persistence

Nothing is stored. The hold, size and scope are the panel's state, reset each time the dialog opens. The deck's
transition and Auto-advance are read, never written.

## Errors and edge cases

| Case                                  | Handling                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Browser refuses the read-back         | `tainted` -> "This browser couldn't draw the page into a GIF. Try Chrome, Edge or Firefox, or export a PNG." |
| Page deleted mid-dialog               | `page-missing` -> "That page is no longer in the tab."                                                       |
| Image decode fails, worker fails, OOM | `failed` -> "Couldn't make the GIF. Try a smaller size or a shorter hold."                                   |
| Holds add up past 3 minutes           | Download disabled, the Too long line                                                                         |
| Cancel                                | Abort, `cancel` to the worker, worker terminated, phase idle                                                 |
| Dialog closed mid-make                | As Cancel (effect cleanup)                                                                                   |
| One page tab with All pages           | `loops` false: no transition                                                                                 |
| An image fails to inline              | Transparent pixel; export continues                                                                          |
| Hold below twice the transition       | Transition shortened to half the hold                                                                        |

## Security and trust

- The SVG is built from the app's own DOM and stylesheets; it is drawn into a canvas and never inserted into the
  page. Text from the document stays text nodes in the serialised XHTML (XMLSerializer escapes it).
- Only `data:` URLs reach the SVG; no network request leaves from inside it.
- Image reads use the bitmaps the canvas already holds (blob URLs) or same-origin fetches; no new credentials.

## Performance and limits

Measured 2026-10-14, M-series, the seeded two-slide deck (aurora and bokeh backgrounds, pulse, bounce and wave text),
`next dev`, headless Chromium and WebKit through Playwright.

- **First load**: only `GifOmit` and `gif-omit.ts` (the `data-gif-omit` marker) are in the document page's initial
  chunks. The panel, hook, snapshot and frames load with the GIF card (9.1 KB gzip); `gifenc` with the encoder core
  is a separate 4.0 KB gzip chunk, in the worker and in the estimate's dynamic import.
- **A frame** (main thread, SVG decode and draw, Chromium): 25 ms at Small, 36 ms at Medium, 45 ms at Large (max
  76 ms); WebKit 84 ms at Medium. Encoding runs in the worker: 3, 10 and 20 ms a frame with a palette per frame (a shared page palette skips the quantise). A frame draws one page's
  DOM (other pages and off-page elements are left out of its snapshot).
- **A snapshot**: 15 to 30 ms a page, plus about 15 ms for `withFullMotion`'s style recalculation. The encoded SVG
  is about 670 KB a page (mostly the app's ~457 KB of CSS); a frame re-encodes only its pinning rules.
- **Totals**: a 6 s, 90 frame GIF made in 3.6 s at Medium, 6.5 MB with the shared palettes (5.3 MB with a palette per frame, which shimmered). The palette pass adds three draws a page.
- **Worst case**: 180 s at 15 fps = 2,700 frames: about 2 minutes of capture at Large (2,700 x 45 ms), the editor
  getting a task between frames, so it never freezes for more than one frame's draw. Still pages cost one frame.
  The progress bar and Cancel cover it.
- **Memory**: every chosen page's snapshot is held from the start (its stillness sets the frame count) and dropped
  after its last frame; one reused canvas; one frame in flight to the worker and one held there. The GIF grows in
  the worker: at Large about 120 KB a moving frame, so a 3 minute fully moving GIF could reach about 300 MB and fail
  on a phone ("Couldn't make the GIF…"). The estimate shows the size first, with the warning past 15 MB.

## Presentation and UX

As the spec. The panel reuses `BackBar`, `ExportPagePicker`, the shared segmented control (`SegmentSlider` on
`SEGMENT_TRACK` / `ACTIVE_SEGMENT`), a range input styled as the Settings sliders and `Button`; the preview is the
first frame's SVG in an `<img>`, in the image panels' 192 px preview frame. The options sit in a `<fieldset>`,
disabled while the GIF is made. The size line under them is `aria-live="polite"`. Copy is the spec's, verbatim
(`GIF_ERROR_COPY`, `GIF_TOO_LONG_COPY`, `GIF_LARGE_COPY` in `GifExportPanel.tsx`).

## Accessibility

- The hold slider is a `<input type="range">` inside its "Each page holds" label, `aria-valuetext` "3 seconds"
  (`holdValueText`).
- The size control is a `radiogroup` labelled "Size", each size a `radio` with `aria-checked`. Progress is a `role="progressbar"` with `aria-valuenow`; the button text carries
  the percentage too. Errors are `role="alert"`.
- Every control is keyboard reachable in the dialog's tab order.

## Web Experience

No effect on LCP, INP or CLS: nothing loads before the GIF card opens, frame capture yields per frame, and the panel
reserves the preview's height.

## Observability

`debugLog('[gif-export] …')`: `page <id> still|animated nodes=<rows>` (each snapshot), `start pages=<n> hold=<s>
frames=<n>`, `done frames=<written> bytes=<n> ms=<n>`, `cancelled`, `failed <code>` (with the error).

## Testing

| Rule                                                                      | Test                                                                 |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 15 fps, exact centisecond holds                                           | `gif-timeline.test.ts`                                               |
| Transition frames, easing, outgoing clock, loop seam                      | `gif-timeline.test.ts`                                               |
| Still page is one frame (plus transition)                                 | `gif-timeline.test.ts`, `make-gif.test.ts`                           |
| One page: no transition                                                   | `gif-timeline.test.ts`                                               |
| Hold default from Auto-advance, clamped                                   | `gif-timeline.test.ts`, `GifExportPanel.test.tsx`                    |
| 3 minute cap                                                              | `gif-timeline.test.ts`, `GifExportPanel.test.tsx`                    |
| Frame size by long side; size label                                       | `gif-timeline.test.ts`                                               |
| Pin rules; reduced-motion CSS dropped or unwrapped; grouping rules kept   | `snapshot-css.test.ts`                                               |
| Full motion for the read, restored after                                  | `snapshot-css.test.ts`                                               |
| Other pages, off-page elements and editor chrome left out; class stripped | `page-snapshot.test.ts` (jsdom)                                      |
| Crop transform, delay parsing, page-missing                               | `page-snapshot.test.ts`                                              |
| Pictures, canvases, embeds and style URLs inlined; one read a URL         | `snapshot-media.test.ts` (jsdom)                                     |
| White paper; Fade / Slide / None composition                              | `page-frames.test.ts` (a fake 2D context)                            |
| Loop extension, frames, merge of equal frames, sample size                | `gif-encode-core.test.ts`                                            |
| Shared page palette; a colour always the same entry                       | `gif-encode-core.test.ts`, `gif-encode.worker.test.ts`               |
| Palette samples per page; transition frames keep their own                | `make-gif.test.ts`, `gif-encoder.test.ts`                            |
| Worker session: transfer, done, failed, error, cancel; on-page fallback   | `gif-encoder.test.ts`                                                |
| Make: progress, finish, cancel between frames, error mapping              | `make-gif.test.ts`                                                   |
| GIF card only in Illustrate, after SVG; never on Plan/diagram tabs        | `ExportTabDialog.illustrate.test.tsx`, `plan-export-formats.test.ts` |
| Panel: defaults, transition line, estimate + warning, Too long, download  | `GifExportPanel.test.tsx`                                            |
| Panel: name, telemetry (both labels), progress + Cancel, the three errors | `GifExportPanel.test.tsx`                                            |

## Assets and external resources

`gifenc` 1.0.3 (MIT, Matt DesLauriers), an npm dependency of `apps/live`, bundled into the worker chunk only; the
licences page picks it up from what the app bundles.

## Defaults ledger

DEFAULTS.md rows D46 to D53.
