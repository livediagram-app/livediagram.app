# SVG import: blueprint

Derived from [SVG import](../svg-import.md). The spec decides; this file only adds engineering precision. Defaults are
ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file (under `apps/live/`):

| File                                     | Role                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `lib/svg-import/constants.ts`            | Every number the importer uses, named                                                           |
| `lib/svg-import/number-scan.ts`          | `NumberScanner`, `numberList`: the left-to-right number and flag scanner                        |
| `lib/svg-import/geometry.ts`             | `Pt`, `Segment`, `Contour`, `Matrix`; multiply, apply, scale, `transformContour`, `contoursBox` |
| `lib/svg-import/arc.ts`                  | `arcToCubics`, `arcPieces`: endpoint arcs to cubic pieces within tolerance                      |
| `lib/svg-import/path-data.ts`            | `parsePathData`: `d` to contours                                                                |
| `lib/svg-import/transform.ts`            | `parseTransform`: a transform list to one matrix                                                |
| `lib/svg-import/shapes.ts`               | `shapeContours`, `parseLength`: the basic shapes                                                |
| `lib/svg-import/colour.ts`               | `parseColour`: a colour to `{ hex, alpha }`                                                     |
| `lib/svg-import/named-colours.ts`        | The CSS named colours (data)                                                                    |
| `lib/svg-import/style.ts`                | `parseDeclarations`, `StyleSheet`: the cascade's inputs                                         |
| `lib/svg-import/walk.ts`                 | `walkSvg`, `viewportOf`: the DOM walk to `Drawn[]` plus the report                              |
| `lib/svg-import/nonzero.ts`              | `traceContour`, `evenOddMatchesNonzero`, `resolveNonzero`                                       |
| `lib/svg-import/outline-stroke.ts`       | `outlineStroke`, `strokeRings`: a stroke past Extra thick as the filled area it paints          |
| `lib/svg-import/build.ts`                | `drawnToPath`, `contourAnchors`, `withThreeNodes`, `strokePreset`                               |
| `lib/svg-import/import-svg.ts`           | `importSvgText`: limits, parse, walk, fit, resolve, build; the log line                         |
| `lib/svg-import/landing.ts`              | `landingPage`, `landingBox`: which page, and its safe area                                      |
| `lib/svg-import/report.ts`               | `SvgImportReport`, `svgReportLines`, `svgReportToast`: tallies and copy                         |
| `lib/svg-import/detect.ts`               | `isSvgFile`, `looksLikeSvgText`                                                                 |
| `lib/svg-import/dialog-runners.ts`       | `svgAwareImporters`: the Import dialog's routing of JSON and SVG                                |
| `hooks/canvas/useSvgImport.ts`           | `useSvgImport`: the one editor entry (page, commit, selection, picture fallback, messages)      |
| `hooks/canvas/useClipboard.ts`           | Drop and paste hand SVG files and markup to `importSvg`                                         |
| `components/dialogs/ImportTabDialog.tsx` | The SVG format card and its note                                                                |

`walk.ts` and `import-svg.ts` read a DOM document (jsdom in tests); every other `lib/svg-import` module is pure.

## Domain and naming

| Term           | Identifier         | Meaning                                                                            |
| -------------- | ------------------ | ---------------------------------------------------------------------------------- |
| contour        | `Contour`          | One subpath: start, cubic segments, whether it ends in `Z`                         |
| segment        | `Segment`          | A cubic from the pen to `to`; `line: true` when it is straight                     |
| drawn element  | `Drawn`            | One SVG element's contours in root units with its resolved paint                   |
| landing box    | `SvgLandingBox`    | The page's safe area in canvas px, the box the import is fitted into               |
| report         | `SvgImportReport`  | Counts per `SvgReportKind`: text, gradient, mask, filter, clipPath, image, pattern |
| route          | `SvgImportRoute`   | `dialog`, `drop` or `paste`                                                        |
| picture reason | `SvgPictureReason` | `too-large`, `too-many-elements`, `too-detailed`                                   |

## Behaviour and state

`importSvgText(text, into, route, deps)` runs, in order:

1. **Byte cap.** `text.length > SVG_IMPORT_MAX_BYTES`, or its UTF-8 length past it: `picture / too-large`.
2. **Parse** through `parseInert(text, 'image/svg+xml')`. A thrown parse, a root that is not `svg`, or any
   `parsererror` element: `unreadable`.
3. **Element cap.** `root.getElementsByTagName('*').length + 1 > SVG_IMPORT_MAX_ELEMENTS`: `picture / too-many-elements`.
4. **Walk** with a guessed `pxPerUnit = min(into.width / viewport.width, into.height / viewport.height)`. Visited elements
   (uses expanded) past `SVG_IMPORT_MAX_ELEMENTS`: `picture / too-many-elements`.
5. **Fit.** The drawn box (`drawnBox`: each element's `contoursBox`, the curves' extremes, grown by half its stroke
   width when stroked) fitted uniformly and centred into `into`, with no cap on the scale. No box, or a
   box of no width and no height: `empty`. When the fit scale passes the guess by `SVG_RESCALE_FACTOR`, walk again at
   the fit scale (D14) and refit.
6. **Per drawn element:** contours carried by the fit matrix; a `nonzero` filled element traced
   (`SVG_TRACE_TOLERANCE_PX`) and checked with `evenOddMatchesNonzero`; on a mismatch the boolean engine is loaded
   (once per import) and `resolveNonzero` replaces the contours with straight rings. Stroke width times the fit scale.
   A landed stroke wider than `BORDER_STROKE_PX['extra-thick']` times `SVG_OUTLINE_SLACK` is outlined: the engine is
   loaded (the same once per import), `outlineStroke` gives the stroke's area as even-odd rings, and the element lands
   as its fill (stroke removed, when it has one) then the outline (filled in the stroke's colour and alpha, no
   stroke). An outline that cannot be made (the engine throws, past `SVG_OUTLINE_MAX_POINTS` traced ring points, D23, or its
   path past `MAX_PATH_NODES`) leaves the stroke a stroke (snapped to Extra thick).
   `drawnToPath`; a path past `MAX_PATH_NODES` nodes: `picture / too-detailed`.
7. No paths: `empty` (with the report). Otherwise `shapes`.

The walk (`walkSvg`) visits in document order. Per element: skip outside the SVG namespace (a null namespace counts as
SVG, D15), past depth 256, or in `NEVER_DRAWN`; compute declarations (presentation attributes, then `<style>` rules
by specificity then order, then `style`); `display: none` skips the subtree; inherited properties (`fill`, `stroke`,
`stroke-width`, `stroke-linecap`, `stroke-linejoin`, `stroke-miterlimit`, `fill-rule`, `fill-opacity`,
`stroke-opacity`, `color`, `visibility`) pass down, `inherit` takes the
parent's; opacity multiplies down; `clip-path`, `mask`, `filter` other than `none` count once per element. `text` and
`image` count (unless hidden) and stop. `use` follows a local `href` (`href`, else `xlink:href`) when the target is not
already in its chain and the depth is under `SVG_USE_MAX_DEPTH`, translated by its `x` and `y`; a `symbol` target walks
its children. `g`, `a` and `svg` walk their children (a nested `svg` placed by `x`, `y` and its viewBox, D16). A shape
draws when visible and painted.

`useSvgImport.importSvg(text, route, opts)`: read-only or `refuseCreate()` answers `cancelled`; a given file past the
byte cap goes straight to the picture; the importer and engine load lazily; the landing page is `landingPage`, the box
`landingBox`. `shapes` are filtered by `savableElements`; past `MAX_ELEMENTS_PER_TAB` with the tab's elements: picture.
Then one `commit` appends them, one is selected alone or several as the multi-selection, and
`track('Tab', 'Imported', 'Svg')`.

## Interfaces and contracts

- `importSvgText(text: string, into: SvgLandingBox, route: SvgImportRoute, deps: { loadEngine; newId? }):
Promise<SvgImportResult>`, never throws for a bad file.
- `SvgImportResult = { kind: 'shapes'; paths; report } | { kind: 'picture'; reason } | { kind: 'unreadable' } |
{ kind: 'empty'; report | null }`.
- `useSvgImport(...).importSvg(text, route, { at?, placePicture?, file? }): Promise<ImportOutcome>`: the dialog route
  answers `error` with the copy, or `done` with `failures` = `svgReportLines(report)`; drop and paste answer `done` and
  toast.
- `useClipboard` takes `importSvg?` and returns `placePictureFile` (its image paste), which the dialog route passes as
  `placePicture`.
- `svgAwareImporters({ importText, importFile, importSvg, locked, pickFile? })`: JSON to the tab import; SVG to
  `importSvg`, a locked tab refused, the picker limited to `.svg,image/svg+xml` and `SVG_IMPORT_MAX_BYTES`.

### Stroke outlining

`outlineStroke(engine, contours, line, tol)` works in landed px. `strokeRings` makes one ring per contour whose
nonzero area is exactly the stroke's area, and the engine's `union` resolves them (it reads a self-crossing ring
nonzero) into even-odd rings, simplified like Combine's (`simplifyRing`).

1. **Trace.** Each segment is traced within `tol` (`SVG_OUTLINE_TOLERANCE_PX`, half the 0.25 px budget); a point where
   two source segments meet is a corner (the declared join), a point inside a traced curve takes a round join, so the
   outline of a curve is the disc swept along it. Repeated points are dropped.
2. **Ring.** With unit directions `d` and left normals `n = (-d.y, d.x)` and half width `h`: the left side forward,
   the end cap, the right side backward, the start cap. At each vertex the side away from the turn (`d_a × d_b < 0`
   is left; a reversal counts as left) gets the join: round (arc points every `2 acos(1 - tol / h)` radians), miter
   (the point `p + h (n_a + n_b) / (1 + d_a · d_b)` when `1 / cos(φ / 2)` is within the limit, else bevel) or bevel.
   The inner side passes through the vertex itself (`p + h n_a`, `p`, `p + h n_b`). The ring is then the sum of every
   segment's quad and every join's wedge, all wound one way, so its winding is positive exactly where the stroke
   paints. Caps: butt adds nothing, square the two far corners `h` on, round a half circle.
3. **Closed contours** have no caps and a join at the start too; the left loop and the reversed right loop are joined
   into one ring through the start point (the bridge edges cancel).
4. **A contour of one point** (every trace point the same) paints a circle of radius `h` with a round cap, a square
   of side `2h` along the x-axis with a square cap, and nothing with butt.

## Data and persistence

Each landed path is an ordinary `PathElement` (`pathOfContours`): `closed`, `nodes`, `subpaths?`, `fillColor?` (six-digit
hex), `strokeColor?`, `strokeWidth` (a preset; `none` when unstroked), `opacity?` (two decimals, omitted at 0.995 and
above). No new field, no migration; stored, synced and undone like any other element. Nothing of the file is kept.

## Errors and edge cases

| Case                                      | Handling                                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Malformed path data, transform or colour  | Path data keeps what came before the error; a transform list is ignored whole; a colour is no paint |
| Arc with a zero radius / to its own start | A straight segment / nothing                                                                        |
| Radii too small to reach                  | Scaled up (SVG F.6.6)                                                                               |
| A closed subpath of two nodes             | `withThreeNodes` splits its first curve; a two-node straight one is dropped                         |
| A zero-length straight segment            | Adds no node                                                                                        |
| Gradient without stops / unreadable stop  | No paint (still counted as a gradient)                                                              |
| `url()` to a pattern or anything else     | Its fallback colour, else no paint; a pattern is counted                                            |
| A `use` cycle or chain deeper than 8      | Stops; draws nothing further                                                                        |
| Point cap for the nonzero check passed    | The check is skipped and the fill stays even-odd (D17)                                              |
| A file the picker reads past the cap      | Never read: placed as a picture from the file                                                       |
| An outline the engine cannot make         | The stroke stays a stroke, snapped to Extra thick                                                   |
| A dashed stroke past Extra thick          | Outlined solid (`stroke-dasharray` is a non-goal)                                                   |
| `miter-clip` or `arcs` joins (SVG 2)      | Drawn as miter (D21)                                                                                |
| A picture fallback with no picture route  | The unreadable message                                                                              |

## Security and trust

The file is untrusted. Only `parseInert` parses it; nothing of it is inserted; no attribute is copied to an element.
`NEVER_DRAWN` includes `script`, `foreignObject`, `iframe`, `audio`, `video`, `canvas`; `image` is counted, not
loaded. A reference is followed only when it is `#id` (`localId`), so `http:`, `data:` and file references are dropped.
The walk is bounded by `SVG_IMPORT_MAX_ELEMENTS` visits and depth 256; `<use>` by depth 8 and a chain check; every
scanner is linear.

## Performance and limits

Parsing and walking are linear in the file (2 MB cap). The nonzero check costs rings by samples by the points of rings
whose box holds the sample (`SVG_NONZERO_SAMPLES_PER_RING` = 24), skipped past 50,000 points. Measured in the unit
tests: a 100,000-segment path parses within a 400 ms CPU budget; a 1,000-icon file imports within 3 s; a bold icon
of 200 stroked curves outlined at page size within its CPU budget (`outline-stroke.test.ts`). Outlining costs one
engine union per outlined element over its traced ring, skipped before the union past `SVG_OUTLINE_MAX_POINTS`
(20,000) ring points: measured unions keep a fifth to three quarters of their ring points, so past four per
`MAX_PATH_NODES` node the outline would almost never fit one path, and the union (about 1.2 to 2 s CPU for 200
overlapping bold curves in one path) is not spent finding that out. That case now keeps its stroke within 200 ms
(`outline-stroke.test.ts`); under the cap a union costs at most about 0.5 s CPU (16,600 ring points). The importer
and its engine are dynamic imports: none of it reaches the editor's first bundle.

## Observability

One `[svg-import]` `debugLog` per import with `route`, `outcome`, the picture `reason`, `paths`, `nodes`, `nonzero`
(elements resolved through the engine), `outlined` (strokes outlined) and the report.

## Testing

| Spec rule                                        | Test                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| Every path command, error recovery, linear time  | `path-data.test.ts`                                                  |
| Transforms                                       | `transform.test.ts`                                                  |
| Basic shapes and 0.25 px precision               | `shapes.test.ts`, `import-svg.test.ts` "turns arcs under transforms" |
| Colours, the cascade                             | `colour.test.ts`, `style.test.ts`, `import-svg.test.ts` "style"      |
| Nonzero to even-odd                              | `nonzero.test.ts`, `import-svg.test.ts` "resolves a nonzero fill"    |
| Nodes, presets, opacity                          | `build.test.ts`                                                      |
| Stroke outlining: caps, joins, miter limit, dots | `outline-stroke.test.ts`                                             |
| Bold icons fill the page, thin strokes stay      | `import-svg.test.ts` "strokes"                                       |
| One path per element, groups, fit                | `import-svg.test.ts` "geometry"                                      |
| Report kinds and copy                            | `import-svg.test.ts`, `landing.test.ts` "report"                     |
| parseInert only; scripts, foreignObject, hrefs   | `import-svg.test.ts` "trust"                                         |
| 2 MB, 5,000 elements, 5,000 nodes, tab room      | `import-svg.test.ts` "limits", `useSvgImport.test.tsx`               |
| Landing page and box, detection, dialog routing  | `landing.test.ts`                                                    |
| Commit, selection, messages, gates               | `useSvgImport.test.tsx`                                              |
| Drop and paste routing                           | `useClipboard.svg.test.tsx`                                          |
| The SVG card and note                            | `ImportTabDialog.test.tsx`                                           |

## Constants and configuration

| Constant                       | Value  | Provenance                                              |
| ------------------------------ | ------ | ------------------------------------------------------- |
| `SVG_IMPORT_MAX_BYTES`         | 2 MiB  | Spec                                                    |
| `SVG_IMPORT_MAX_ELEMENTS`      | 5,000  | Spec                                                    |
| `SVG_USE_MAX_DEPTH`            | 8      | Spec                                                    |
| `SVG_ARC_TOLERANCE_PX`         | 0.1    | Spec (arc pieces); under the 0.25 px conversion budget  |
| `SVG_TRACE_TOLERANCE_PX`       | 0.25   | Spec                                                    |
| `SVG_ARC_MAX_PIECE`            | π / 2  | Spec (a quarter turn)                                   |
| `SVG_NONZERO_SAMPLES_PER_RING` | 24     | D18                                                     |
| `SVG_NONZERO_MAX_POINTS`       | 50,000 | Combine's `COMBINE_MAX_INPUT_POINTS`                    |
| `SVG_RESCALE_FACTOR`           | 1.5    | D14                                                     |
| `SVG_OUTLINE_TOLERANCE_PX`     | 0.125  | Spec: half the 0.25 px budget (trace, then round parts) |
| `SVG_OUTLINE_SLACK`            | 1.001  | D22                                                     |
| `SVG_MITER_LIMIT`              | 4      | SVG's default `stroke-miterlimit`                       |
| `SVG_OUTLINE_MAX_POINTS`       | 20,000 | D23: four ring points per `MAX_PATH_NODES` node         |
