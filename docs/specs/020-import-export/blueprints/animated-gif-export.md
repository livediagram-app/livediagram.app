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
| the transition  | `SlideTransition` + `SlideSpeed` from `lib/presentation-config.ts`                 |

## Constants and configuration

All in `lib/gif-export/gif-timeline.ts`.

| Constant             | Value                                      | Provenance / safe range                                                    |
| -------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| `GIF_FPS`            | 15                                         | Spec. GIF delays are centiseconds: 15 fps is exact over 3 frames (7, 7, 6) |
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

Called once per page per export. Steps:

1. The page node is `[data-illustrate-page-id="<id>"]`; its canvas root is `node.closest('[data-canvas-root]')`;
   the content is `root.querySelector('[data-canvas-content]')`. Missing: `GifExportError('page-missing')`.
2. **Animation table**: walk every element under the content; for each of `''`, `'::before'`, `'::after'` whose
   computed `animation-name` is not `none`, record `{ node, pseudo, delaysMs[] }` from the computed
   `animation-delay` list, and give the node `data-gif-id="<n>"` for the clone (removed from the live node right
   after cloning). Finished play-once animations are found too (computed style, not `getAnimations`).
   `animated = table.length > 0` restricted to nodes inside this page's rectangle (by bounding box).
3. **Clone** the content (`cloneNode(true)`), then remove from the clone every `[data-gif-omit]` node and every
   node matching `GIF_OMIT_SELECTOR` (selection chrome, grips, cursors, presence, comment pins, the empty-page
   layouts card, the add-page button: the list is kept with the markers in `page-snapshot.ts`).
4. **Images**: every `<img>` in the clone gets its live twin's bitmap as a `data:` URL: fetched from its
   `currentSrc` (blob, same-origin or CORS) and read as a data URL; one cache per export so a repeated picture is
   read once. A failed read leaves a transparent pixel (as a placeholder: never aborts). Inline `style`
   `background-image: url(...)` values are inlined the same way.
5. **CSS**: every same-origin stylesheet's rules, concatenated, except a `@media` rule whose condition mentions
   `prefers-reduced-motion` (spec: Reduce Motion never stills the GIF), then the tab's fonts from
   `embeddedFontFaceCss`. The wrapper takes `<html>`'s classes minus `reduce-motion` and its inline style.
6. **Crop**: the page's screen rect `P` and the root's `R`; the zoom `z` is the content's computed matrix `a`.
   Output scale `k = frameWidth / pageWidthCanvas`; the clone sits in a box of the root's size at `(R - P) * k/z`,
   scaled by `k / z` about its top-left.
7. `svgAt(t)`: the SVG string `<svg><style><![CDATA[css + rules(t)]]></style><foreignObject>…</foreignObject></svg>`
   where `rules(t)` pins each table row: `[data-gif-id="n"]<pseudo>{animation-delay:<d_i - t>ms,…
!important;animation-play-state:paused!important}` and one catch-all `*,*::before,*::after{animation-play-state:
paused!important}`.

### Frames (`page-frames.ts`, browser)

- `drawSvg(svg, ctx, w, h)`: an `Image` from `data:image/svg+xml;charset=utf-8,` + `encodeURIComponent(svg)` (a
  blob URL taints in Chromium), `decode()`, `drawImage`. After the first frame of an export, `getImageData(0, 0,
1, 1)`; a `SecurityError` is `GifExportError('tainted')`.
- `composeFrame(ctx, frame, drawPage)`: no `from`: the page at `t`. Fade: the outgoing page, then the incoming with
  `globalAlpha = mix`. Slide: the outgoing at `x = -mix * w`, the incoming at `x = (1 - mix) * w`. Paper white
  first, always (a logo page's see-through paper).

### The encoder (`gif-encode.worker.ts` + `gif-encoder.ts`)

- The worker imports `gifenc` (dynamic, only in the worker). Messages in: `start { width, height }`, `frame {
rgba: ArrayBuffer (transferred), delayCs }`, `finish`, `cancel`. Out: `progress { frames }`, `done { bytes:
ArrayBuffer }`, `failed { message }`.
- Each frame: `quantize(rgba, 256, { format: 'rgb565' })`, `applyPalette`, `writeFrame(index, w, h, { palette,
delay: delayCs * 10, repeat: 0 })` (`repeat: 0` on the first frame writes the loop-forever extension).
- **Merge**: the worker holds the last frame back; a next frame whose bytes are equal adds its delay to the held
  one instead of being written.
- `encodeSampleBytes(rgba, w, h)` (main thread, one frame): the estimate's bytes per frame.

### The hook (`useGifExport`) and panel (`GifExportPanel`)

State: `holdSeconds` (from `gifHoldDefault(config.autoAdvanceSeconds)`), `size` (`'medium'`), `scope` (`'all'`),
the page, `phase` = `idle | estimating | making(progress) | error(message)`, an `AbortController`.

- **Estimate**: after the options settle (250 ms), snapshot the preview page, draw `t = 0` at the chosen size,
  `encodeSampleBytes`; `estimate = sampleBytes * frameCount(timeline)` + 800 bytes. Shown "About 3.4 MB" (one
  decimal, MB = 1,000,000 bytes; under 1 MB as "About 640 KB").
- **Make**: for each page in order snapshot once; frames in timeline order; each composed on one reused canvas,
  `getImageData`, sent (transferred) to the worker; progress = frames sent / total; abort checked between frames.
  A page's snapshot is kept while its frames (and the next page's transition frames) need it, then dropped.
- **Download**: `downloadBlob(new Blob([bytes], { type: 'image/gif' }), name + '.gif')`, then telemetry.

## Interfaces and contracts

- `ExportFormatKey` gains `'gif'`; `ILLUSTRATE_FORMATS` becomes `['pdf', 'png', 'svg', 'gif', 'file']`.
  `DIAGRAM_TAB_FORMATS` and the Plan lists never include it.
- `GifExportError` codes: `'page-missing' | 'tainted' | 'failed'`; the panel maps them to the spec's three lines.

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

- **Nothing on first load**: the panel, `page-snapshot.ts`, `page-frames.ts` and the encoder client are loaded by
  dynamic import when the GIF card opens; `gifenc` only inside the worker.
- **Measured (spike, M-series, 1087 x 611 frame)**: 110 ms a frame in Chromium, 160 ms in WebKit, of which most is
  the SVG decode. A frame is a draw of the whole page's DOM.
- **Worst case**: 180 s at 15 fps = 2,700 frames: about 5 minutes of capture at Medium. Still pages cost one frame.
  The progress bar and Cancel cover it; the main thread yields between frames (one frame per task) so the editor
  never freezes for more than one frame's draw.
- **Memory**: one reused canvas, one frame in flight to the worker, one held frame in the worker, plus the GIF bytes
  (the 15 MB warning is about the result, not the process).
- **Snapshot CSS** (~475 KB) is serialised once per page, not per frame: `svgAt` concatenates a prefix, the rules
  and a suffix.

## Presentation and UX

As the spec. The panel reuses `BackBar`, `ExportPagePicker`, the shared segmented control, a range input styled as
the Settings sliders, `Button`; the preview is a PNG of the page's first frame in the shared preview frame.
Copy is the spec's, verbatim.

## Accessibility

- The hold slider is a labelled `<input type="range">` ("Each page holds"), `aria-valuetext` "3 seconds".
- The size control is a radiogroup. Progress is a `role="progressbar"` with `aria-valuenow`; the button text carries
  the percentage too. Errors are `role="alert"`.
- Every control is keyboard reachable in the dialog's tab order.

## Web Experience

No effect on LCP, INP or CLS: nothing loads before the GIF card opens, frame capture yields per frame, and the panel
reserves the preview's height.

## Observability

`debugLog('[gif-export] …')`: `start pages=<n> hold=<s> size=<id> frames=<n>`, `page <i> still|animated
nodes=<n>`, `tainted`, `failed <code>`, `done frames=<written> bytes=<n> ms=<n>`, `cancelled at <n>`.

## Testing

| Rule                                                                | Test                                                                 |
| ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 15 fps, exact centisecond holds                                     | `gif-timeline.test.ts`                                               |
| Transition frames, easing, outgoing clock, loop seam                | `gif-timeline.test.ts`                                               |
| Still page is one frame (plus transition)                           | `gif-timeline.test.ts`                                               |
| One page: no transition                                             | `gif-timeline.test.ts`                                               |
| Hold default from Auto-advance, clamped                             | `gif-timeline.test.ts`                                               |
| 3 minute cap                                                        | `gif-timeline.test.ts`                                               |
| Frame size by long side                                             | `gif-timeline.test.ts`                                               |
| Pin rules, reduced-motion CSS dropped, class stripped               | `page-snapshot.test.ts` (jsdom)                                      |
| Omitted chrome removed from the clone                               | `page-snapshot.test.ts`                                              |
| Fade / Slide composition                                            | `page-frames.test.ts` (a fake 2D context)                            |
| Encoder: loop extension, frames, merge of equal frames              | `gif-encode.test.ts` (the worker's pure core)                        |
| GIF card only in Illustrate; never on Plan/diagram tabs             | `ExportTabDialog.illustrate.test.tsx`, `plan-export-formats.test.ts` |
| Panel: defaults, Too long, estimate copy, errors, cancel, telemetry | `GifExportPanel.test.tsx`                                            |

## Assets and external resources

`gifenc` 1.0.3 (MIT, Matt DesLauriers), an npm dependency of `apps/live`, bundled into the worker chunk only; the
licences page picks it up from what the app bundles.

## Defaults ledger

DEFAULTS.md rows D46 to D52.
