# Picture crop, mask and greyscale: blueprint

Derived from [Picture crop, mask and greyscale](../picture-crop-and-mask.md). The spec decides; this file only adds
engineering precision. Defaults are ledgered in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

Scope, by file:

| File                                                      | Role                                                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/document/src/image-frame.ts`                    | `ImageCrop`, `ImageMask`, `IMAGE_MASKS`, `isImageCrop`, `isImageMask`, `cleanImageCrop`, `imageLayout`, `imageMaskPath`, `imageDrawsCover` |
| `packages/document/src/element-types.ts`                  | `crop`, `mask`, `greyscale` on `ImageElement`                                                                                              |
| `packages/document/src/element-fields.ts`                 | The three fields on the image's field list                                                                                                 |
| `packages/document/src/validate.ts`                       | `IMAGE_FIELD_CHECKS` rows for the three fields                                                                                             |
| `packages/document/src/svg-render-image-icon.ts`          | `svgImageShape`: layout, mask clip, greyscale filter                                                                                       |
| `packages/document/src/svg-render-describe.ts`            | The image `ExportShape` carries the element's crop / mask / greyscale through                                                              |
| `apps/editor/lib/export-tab-canvas-draw.ts`               | `drawImageElement`: the same layout and clip on a 2D canvas                                                                                |
| `apps/editor/lib/image-greyscale.ts`                      | `canvasFilters`, `greyCopy`: the canvas filter, else a grey copy of the pixels                                                             |
| `apps/editor/components/canvas/ImageElementView.tsx`      | The canvas face: laid-out `<img>`, `clip-path`, `filter`                                                                                   |
| `apps/editor/lib/image-crop-store.ts`                     | The one image being cropped (`startImageCrop`, `endImageCrop`, `useIsImageCropping`)                                                       |
| `apps/editor/lib/image-crop-math.ts`                      | `cropSessionStart`, `panPicture`, `dragFrame`, `zoomPicture`, `fitAspect`, `cropSessionResult`                                             |
| `apps/editor/components/canvas/ImageCropOverlay.tsx`      | The veil, frame, handles and gestures, in the grips layer                                                                                  |
| `apps/editor/components/canvas/ImageCropBar.tsx`          | Aspect, Zoom, Reset, Cancel, Done                                                                                                          |
| `apps/editor/hooks/canvas/useEditorImages.ts`             | `commitImageCrop` on `imageContext` (Editors only)                                                                                         |
| `apps/editor/components/palette/ImagePictureControls.tsx` | Mask tiles and the Greyscale toggle; Crop Image sits in `ElementContentSections.tsx`                                                       |
| `apps/editor/lib/office-import/pptx.ts`, `build-deck.ts`  | `a:srcRect` into `crop`                                                                                                                    |

## Domain and naming

| Term      | Identifier                     | Meaning                                                              |
| --------- | ------------------------------ | -------------------------------------------------------------------- |
| Crop      | `ImageElement.crop: ImageCrop` | The kept part, fractions of the picture                              |
| Mask      | `ImageElement.mask: ImageMask` | The shape the box is cut to                                          |
| Greyscale | `ImageElement.greyscale: true` | Drawn without colour                                                 |
| Layout    | `imageLayout(...)`             | Where the kept part and the whole picture sit in the box             |
| Cropping  | `useImageCropId() === id`      | The editor session state of one image being cropped                  |
| Frame     | the crop session's `frame`     | The box being cropped to, canvas units, in the element's local frame |
| Picture   | the crop session's `picture`   | The whole picture's rectangle, same frame                            |

Banned synonyms: "clip" for the mask (a clip is the renderer's), "trim", "black and white".

## Data and persistence

- `ImageCrop = { x: number; y: number; width: number; height: number }`. `isImageCrop(v)`: an object of four finite
  numbers, `x, y >= 0`, `width, height >= IMAGE_CROP_MIN (0.02)`, `x + width <= 1 + 1e-6`, `y + height <= 1 + 1e-6`.
- `cleanImageCrop(c)`: rounds each to 4 decimals, clamps into range, returns `undefined` for the whole picture
  (every side within 0.001 of it).
- `IMAGE_MASKS = ['circle', 'rounded', 'arch', 'hexagon', 'diamond', 'triangle', 'star', 'blob']`.
- No migration: all three are new and optional. Readers that meet a bad value ignore it (`imageLayout` and
  `imageMaskPath` read through the guards); `elementValidationIssue` refuses one on the write paths (agents, API).

## Behaviour and state

### Layout (`imageLayout(box, natural, crop, fit)`)

Inputs: `box {width, height}`, `natural {width, height} | null`, `crop | undefined`, `fit: 'cover' | 'contain'`.
`natural` falls back to the box's own size (an image with no `naturalWidth`), so a crop still keeps its fractions.

1. Part size in picture px: `pw = cw * nw`, `ph = ch * nh` (a missing crop is `0, 0, 1, 1`).
2. `s = fit === 'cover' ? max(W / pw, H / ph) : min(W / pw, H / ph)`.
3. `part = { x: (W - pw*s) / 2, y: (H - ph*s) / 2, width: pw*s, height: ph*s }`.
4. `picture = { x: part.x - cx*nw*s, y: part.y - cy*nh*s, width: nw*s, height: nh*s }`.

`imageDrawsCover(el)`: `true` when `mask` is a known mask, else `el.objectFit === 'cover'`.

### Mask paths (`imageMaskPath(mask, w, h, ox = 0, oy = 0)`)

An SVG path `d` in the box's px, every coordinate rounded to 2 decimals:

- circle: two arcs of radii `w/2, h/2`.
- rounded: a rounded rect, radius `min(w, h) * 0.2` (`MASK_ROUNDED_RATIO`).
- arch: from bottom-left up to `y = min(h, w/2)`, a half ellipse of radii `w/2, min(h, w/2)` over the top, down to
  bottom-right.
- hexagon: `(0, h/2) (w/4, 0) (3w/4, 0) (w, h/2) (3w/4, h) (w/4, h)`.
- diamond: the four side midpoints.
- triangle: `(w/2, 0) (w, h) (0, h)`.
- star: ten points round the centre, outer radii `w/2, h/2`, inner at 0.4 (`MASK_STAR_INNER`), the first point up.
- blob: four cubic curves through `BLOB_POINTS` in unit space scaled to the box.

### The canvas face

- No crop and no mask: unchanged (`<img>` with `objectFit`).
- Otherwise the clipping box (`overflow-hidden`) holds, for `contain` with a crop, an inner box at `part` with
  `overflow-hidden`, and the `<img>` absolutely at `picture` (relative to the inner box: `picture - part`).
- A mask sets `clipPath: path('<imageMaskPath>')` and `borderRadius: 0` on the clipping box; memoised on
  `(mask, width, height)`.
- `greyscale` sets `filter: grayscale(1)` on the `<img>`.
- The natural size: the element's `naturalWidth/Height`, else the `<img>`'s own once loaded (`onLoad`).
- The empty face takes `round` when `borderRadius === 'full'` or `mask === 'circle'`.
- Sketch edge: `sketchOverlay()` is skipped for an image with a mask (`BoxedElementView`).

### Cropping (`apps/editor/lib/image-crop-math.ts`, all pure, canvas units in the element's frame)

- `cropSessionStart(el, natural)`: `frame = {0, 0, W, H}`; `picture` = `imageLayout(...).picture` with
  `fit = cover` when the image draws cover, else (a contain picture with no crop) the picture fitted to cover the
  box (D251). The zoom readout is `picture.width / coverWidth(frame)`.
- `panPicture(s, dx, dy)`: moves `picture` by the delta, clamped so `picture` contains `frame`.
- `dragFrame(s, handle, dx, dy, aspect | null)`: moves the named edges; clamps inside `picture`; keeps
  `IMAGE_CROP_FRAME_MIN = 24` px on each side; with `aspect`, a corner drag keeps `width / height === aspect` by
  following the axis the pointer moved more along.
- `zoomPicture(s, z)`: scales `picture` about the frame's centre to `z * cover size` (`z` in 1..4), then clamps.
- `fitAspect(s, aspect)`: the largest frame of the aspect centred on the frame's centre that fits inside both the
  picture and the frame (D252).
- `cropSessionResult(el, s)`: `null` when frame and picture equal their start (within 0.5 px); else the element's
  new `x, y, width, height` (the frame mapped back through the element's rotation about its old centre) and
  `crop = cleanImageCrop((frame - picture) / picture size)`, `objectFit` kept.
- Rotation: pointer deltas are turned by `-rotation` before reaching the math; the overlay box carries
  `rotate(rotation)` about the element centre, as the grips do.

### Session

- `startImageCrop(id)` sets the store; the store holds one id or null. `ImageCropOverlay` mounts in
  `BoxGripsPortal` from `ElementFaceRouter` while `useImageCropId() === element.id` and the image has a picture.
  `BoxedElementView` passes `showHandles && !cropping`.
- Ends (`endImageCrop()`): Done / Enter (apply), Cancel / Escape (none), a pointer down outside the overlay and
  the bar (apply), the element unmounting, losing its picture, or the selection moving off it (none).
- Apply calls `imageContext.onCommitImageCrop(id, result)` once: one `commit`, refused for a locked element
  (`el.locked`) and by the tab's lock through `commit`.

### Mask and greyscale

`ImagePictureControls` writes through the menu's `ElementStyleOps`: `preview(map)` on hover, `commit(map, type)`
on press; `map` sets the field on every selected image and leaves other kinds. A press on the current mask removes it.

## Interfaces and contracts

- `elementValidationIssue` answers `{ field: 'crop', rule: 'fractions { x, y, width, height } of the picture, each
side at least 0.02, inside 0..1' }`, `{ field: 'mask', rule: 'one of circle, rounded, ...' }`,
  `{ field: 'greyscale', rule: 'true' }`.
- The MCP image element text names the three fields.
- `imageContext.onCommitImageCrop?: (id, { x, y, width, height, crop? }) => void`: present only for an Editor
  (`!isReadOnly`), outside a locked tab (`editsBlocked`).

## Errors and edge cases

| Case                                  | Handling                                             |
| ------------------------------------- | ---------------------------------------------------- |
| Crop on an image with no natural size | Box proportions stand in for the picture's           |
| Stored crop out of range              | Ignored on draw; refused on agent writes             |
| Unknown mask                          | Ignored on draw; refused on agent writes             |
| Picture removed while cropping        | Session ends without a change                        |
| Crop Image on a locked image          | Tile not shown; `onCommitImageCrop` refuses          |
| Pointer cancel mid-drag               | The drag ends where it stood; the session stays open |
| Done with nothing changed             | No commit, no event                                  |
| PNG export without `ctx.filter`       | `greyCopy` draws a grey copy                         |

## Security and trust

Pure geometry and CSS; no new network calls. `imageMaskPath` emits numbers only, so the `clip-path` string and the
SVG path carry no user text. Participants are refused the three fields by `applyParticipantOp`'s allow-list (none
is text).

## Performance and limits

- The face adds two divs at most and no re-render beyond the element's own; the path is memoised.
- During a crop drag the picture and frame update React state on pointer moves (one small subtree in the grips
  layer); nothing else re-renders and nothing commits until Done.
- The `greyCopy` fallback walks the picture's pixels once per image per export (`O(w * h)`).

## Presentation and UX

- Veil `rgb(15 23 42 / 0.55)` outside the frame; the dimmed picture at opacity 0.45 under it; frame 1.5 px white
  with a 1 px slate-900/40 outer line; thirds lines white at 35%. Handles 12 px squares on screen (corners) and
  20 x 6 px bars (edges), white with a brand-600 border, `cursor` the resize cursor for the side turned by the
  rotation; the picture shows `cursor: move`.
- The bar: a white (dark: slate-900) rounded card with a hairline border and shadow, fixed bottom-centre above the
  safe area, at most `calc(100vw - 24px)` wide; its rows wrap at phone width (Aspect over Zoom over the buttons).
  Done is the primary button. Every control has a tooltip and a pointer cursor.

## Accessibility

- The overlay is `role="group"` named "Crop Image"; the bar's controls are buttons and a labelled range. Arrow keys
  pan the picture by 1 px (10 with Shift) while cropping; Enter applies, Escape cancels. The aspect control is a
  radiogroup.

## Observability

`track('Element', 'Changed', 'ImageCrop' | 'ImageMask' | 'ImageGreyscale')`. No logs: no failure path reaches a
server.

## Testing

| Rule                              | Test                                                                   |
| --------------------------------- | ---------------------------------------------------------------------- |
| Guards, clean, layout, mask paths | `packages/document/src/image-frame.test.ts`                            |
| Validation of the three fields    | `packages/document/src/image-frame.test.ts`                            |
| SVG export: clip, crop, greyscale | `packages/document/src/image-frame.test.ts`                            |
| Crop math                         | `apps/editor/lib/image-crop-math.test.ts`                              |
| Canvas face                       | `apps/editor/components/canvas/ImageElementView.test.tsx`              |
| Menu controls, roles              | `apps/editor/components/palette/ImagePictureControls.test.tsx`         |
| Crop Image tile, locked           | `apps/editor/components/palette/EditorContextMenu.image-crop.test.tsx` |
| Overlay keys and Done / Cancel    | `apps/editor/components/canvas/ImageCropOverlay.test.tsx`              |
| Editor-only commit                | `apps/editor/hooks/canvas/useEditorImages.test.ts`                     |
| PPTX srcRect                      | `apps/editor/lib/office-import/pptx.test.ts`                           |

## Constants and configuration

| Name                   | Value | Provenance                                   |
| ---------------------- | ----- | -------------------------------------------- |
| `IMAGE_CROP_MIN`       | 0.02  | Spec "The fields"                            |
| `IMAGE_CROP_FRAME_MIN` | 24    | Spec "Changing the crop"                     |
| `IMAGE_CROP_ZOOM_MAX`  | 4     | Spec "The crop bar" (400%)                   |
| `MASK_ROUNDED_RATIO`   | 0.2   | Spec "Rounded" (a fifth of the shorter side) |
| `MASK_STAR_INNER`      | 0.4   | Spec "Star"                                  |

## Defaults ledger

D251, D252, D253 in [DEFAULTS.md](DEFAULTS.md).
