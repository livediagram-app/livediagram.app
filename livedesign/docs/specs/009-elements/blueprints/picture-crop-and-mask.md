# Picture crop, mask and greyscale: blueprint

Derived from [Picture crop, mask and greyscale](../picture-crop-and-mask.md). The spec decides; this file only adds
engineering precision. Defaults are ledgered in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

The rules, the crop math and the overlay are livedocuments' too, so they live in shared packages; this product binds
them to its element union and its menus. Paths starting `../` are from the monorepo root.

Scope, by file:

| File                                                               | Role                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `../packages/element-model/src/image-frame.ts`                     | `ImageCrop`, `ImageMask`, `IMAGE_MASKS`, `MASK_LABEL`, `isImageCrop`, `isImageMask`, `cleanImageCrop`, `imageLayout`, `imageMaskPath`, `imageDrawsCover`, `imageIsShaped`, `withImageMask`, `withImageGreyscale`; re-exported by `packages/design/src/index.ts` |
| `packages/design/src/element-types.ts`                             | `crop`, `mask`, `greyscale` on `ImageElement`                                                                                                                                                                                                                   |
| `packages/design/src/element-fields.ts`                            | The three fields on the image's field list                                                                                                                                                                                                                      |
| `packages/design/src/validate.ts`                                  | `IMAGE_FIELD_CHECKS` rows for the three fields                                                                                                                                                                                                                  |
| `../packages/element-model/src/svg-render-image-icon.ts`           | `svgImageShape`: layout, mask clip, greyscale filter; re-exported by `packages/design/src/svg-render-image-icon.ts`                                                                                                                                             |
| `packages/design/src/svg-render-describe.ts`                       | The image `ExportShape` covers when masked (`imageDrawsCover`)                                                                                                                                                                                                  |
| `packages/design/src/svg-render-boxed.ts`                          | No sketch edge round a masked picture                                                                                                                                                                                                                           |
| `../packages/workbench/src/lib/image-canvas-draw.ts`               | `drawPictureOnCanvas`: the same layout and clip on a 2D canvas, for `apps/live/lib/export-tab-canvas-draw.ts`                                                                                                                                                   |
| `../packages/workbench/src/lib/image-greyscale.ts`                 | `canvasFilters`, `greyPixels`, `greyCopy`: the canvas filter, else a grey copy of the pixels                                                                                                                                                                    |
| `apps/live/components/canvas/ImageElementView.tsx`                 | The canvas face: laid-out `<img>`, `clip-path`, `filter`; mounts the overlay and tracks `ImageCrop`                                                                                                                                                             |
| `../packages/workbench/src/lib/image-crop-store.ts`                | The one image being cropped (`startImageCrop`, `endImageCrop`, `imageCropId`, `useIsImageCropping`, `useImageCropId`)                                                                                                                                           |
| `../packages/workbench/src/lib/image-crop-math.ts`                 | `cropSessionStart`, `panPicture`, `dragFrame`, `cropZoom`, `zoomPicture`, `fitAspect`, `resetCrop`, `cropSessionResult`, `localDelta`                                                                                                                           |
| `../packages/workbench/src/components/canvas/ImageCropOverlay.tsx` | The veil, frame, handles and gestures, in the grips layer                                                                                                                                                                                                       |
| `../packages/workbench/src/components/canvas/ImageCropBar.tsx`     | Aspect, Zoom, Reset, Cancel, Done                                                                                                                                                                                                                               |
| `apps/live/hooks/canvas/useEditorImages.ts`                        | `commitImageCrop` on `imageContext` (Editors only)                                                                                                                                                                                                              |
| `apps/live/components/palette/ImagePictureControls.tsx`            | Mask tiles and the Greyscale toggle, on this app's menu rows; Crop Image sits in `ElementContentSections.tsx`                                                                                                                                                   |

## Domain and naming

| Term      | Identifier                     | Meaning                                                              |
| --------- | ------------------------------ | -------------------------------------------------------------------- |
| Crop      | `ImageElement.crop: ImageCrop` | The kept part, fractions of the picture                              |
| Mask      | `ImageElement.mask: ImageMask` | The shape the box is cut to                                          |
| Greyscale | `ImageElement.greyscale: true` | Drawn without colour                                                 |
| Layout    | `imageLayout(...)`             | Where the kept part and the whole picture sit in the box             |
| Cropping  | `useIsImageCropping(id)`       | The editor session state of one image being cropped                  |
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

The layout, the mask paths, the crop math and the session are livedocuments' blueprint's
([its picture-crop-and-mask.md](../../../../../livedocuments/docs/specs/009-elements/blueprints/picture-crop-and-mask.md)
"Behaviour and state"), from the same shared files; this product adds nothing to them.

- The overlay takes `onApply(result)`; `ImageElementView` passes the result to `imageContext.onCommitImageCrop` and
  sends `Element · Changed · ImageCrop` (the workbench's telemetry vocabulary has no `Element`).
- `ImageCropOverlay` mounts in `BoxGripsPortal` from `ImageElementView` while `useIsImageCropping(element.id)` and the
  image has a picture, is selected, unlocked and `onCommitCrop` is given. `BoxedElementView` passes
  `showHandles && !cropping`.
- While any image is cropped, `useCanvasSelectionView` reads `useImageCropId()` and hands `cropping: id !== null` to
  `deriveCanvasSelection` (`apps/live/lib/canvas-selection.ts`), which turns `showPopover` (the selection toolbar) and
  `showPlus` (the quick-add buttons) off; the store ending turns them back on, whichever way it ends (Done, Enter,
  Cancel, Escape, a press off the picture, Ctrl or Cmd+Z / Y, the selection moving, the image unmounting). The undo
  keys end the crop without consuming the key, so the editor's undo or redo still runs.
- Apply calls `imageContext.onCommitImageCrop(id, result)` once: one `commit`, refused for a locked element
  (`el.locked`) and by the tab's lock through `commit`.

### Mask and greyscale

`ImagePictureControls` writes through the menu's `ElementStyleOps`: `preview(map)` on hover, `commit(map, type)`
on press; `map` (`withImageMask`, `withImageGreyscale`) sets the field on every selected image and leaves other kinds.

## Interfaces and contracts

- `elementValidationIssue` answers `{ field: 'crop', rule: 'fractions { x, y, width, height } of the picture, each
side at least 0.02, inside 0..1' }`, `{ field: 'mask', rule: 'one of circle, rounded, ...' }`,
  `{ field: 'greyscale', rule: 'true' }`.
- The MCP image element text names the three fields (`packages/agent-verbs/src/mcp/element-docs.ts`).
- `imageContext.onCommitImageCrop?: (id, { x, y, width, height, crop? }) => void`: present only for an Editor
  (`!isReadOnly`), outside a locked tab.

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
SVG path carry no user text. Participants are refused the three fields by the participant allow-list (none is text).

## Performance and limits

- The face adds two divs at most and no re-render beyond the element's own; the path is memoised.
- During a crop drag the picture and frame update React state on pointer moves (one small subtree in the grips
  layer); nothing else re-renders and nothing commits until Done.
- The `greyCopy` fallback walks the picture's pixels once per image per export (`O(w * h)`).

## Presentation and UX

As livedocuments' (D201): the veil, the frame, the handles and the bar are the shared overlay's.

## Accessibility

- The overlay is `role="group"` named "Crop Image"; the bar's controls are buttons and a labelled range. Arrow keys
  pan the picture by 1 px (10 with Shift) while cropping; Enter applies, Escape cancels. The aspect control is a
  radiogroup.

## Observability

`track('Element', 'Changed', 'ImageCrop' | 'ImageMask' | 'ImageGreyscale')`. No logs: no failure path reaches a
server.

## Testing

| Rule                              | Test                                                                    |
| --------------------------------- | ----------------------------------------------------------------------- |
| Guards, clean, layout, mask paths | `../packages/element-model/src/image-frame.test.ts`                     |
| Validation; a Participant refused | `packages/design/src/image-frame-fields.test.ts`                        |
| SVG export: clip, crop, greyscale | `packages/design/src/image-frame-fields.test.ts`                        |
| PNG / PDF painter                 | `../packages/workbench/src/lib/image-canvas-draw.test.ts`               |
| Crop Image tile, locked           | `apps/live/components/palette/EditorContextMenu.image-crop.test.tsx`    |
| Crop math                         | `../packages/workbench/src/lib/image-crop-math.test.ts`                 |
| Overlay keys and Done / Cancel    | `../packages/workbench/src/components/canvas/ImageCropOverlay.test.tsx` |
| Canvas face                       | `apps/live/components/canvas/ImageElementView.test.tsx`                 |
| Menu controls, roles              | `apps/live/components/palette/ImagePictureControls.test.tsx`            |
| Editor-only commit                | `apps/live/hooks/canvas/useEditorImages.test.ts`                        |

## Constants and configuration

| Name                   | Value | Provenance                                   |
| ---------------------- | ----- | -------------------------------------------- |
| `IMAGE_CROP_MIN`       | 0.02  | Spec "The fields"                            |
| `IMAGE_CROP_FRAME_MIN` | 24    | Spec "Changing the crop"                     |
| `IMAGE_CROP_ZOOM_MAX`  | 4     | Spec "The crop bar" (400%)                   |
| `MASK_ROUNDED_RATIO`   | 0.2   | Spec "Rounded" (a fifth of the shorter side) |
| `MASK_STAR_INNER`      | 0.4   | Spec "Star"                                  |

## Defaults ledger

D199, D200, D201 in [DEFAULTS.md](DEFAULTS.md).
