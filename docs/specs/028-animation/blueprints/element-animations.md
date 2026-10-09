# Element animations blueprint

Derived from [Element animations](../element-animations.md). Defaults applied where the spec is silent are rows
EA1 onwards in [DEFAULTS.md](DEFAULTS.md).

## Domain and naming

| Spec term                | Identifier                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| animation set            | `AnimationSetId` = `'shape' \| 'sticky' \| 'drawing' \| 'media' \| 'table' \| 'text'`                     |
| body set                 | `BodyAnimationSet` = `Exclude<AnimationSetId, 'text'>`                                                    |
| the set of an element    | `bodyAnimationSetOf(el): BodyAnimationSet \| undefined`                                                   |
| carries words            | `carriesWords(el): boolean`                                                                               |
| a category acts on it    | `inAnimationSet(set, el): boolean`                                                                        |
| Shape set values         | `ShapeAnimation`, `SHAPE_ANIMATIONS`                                                                      |
| Sticky set values        | `StickyAnimation`, `STICKY_ANIMATIONS`                                                                    |
| Drawing set values       | `DrawingAnimation`, `DRAWING_ANIMATIONS`                                                                  |
| Media set values         | `MediaAnimation`, `MEDIA_ANIMATIONS`                                                                      |
| Table set values         | `TableAnimation`, `TABLE_ANIMATIONS`                                                                      |
| Text set values          | `TextAnimation`, `TEXT_ANIMATIONS`, `isTextAnimation`                                                     |
| a set's offered values   | `ANIMATION_SET_VALUES: Record<AnimationSetId, readonly string[]>`, `isAnimationInSet`                     |
| reveal                   | `isRevealAnimation(set, value)`                                                                           |
| a value kept from before | `keptAnimation(set, value)`: the value when the set does not offer it, else undefined                     |
| the body value union     | `ElementAnimation` = the union of the five body sets' values                                              |
| section name             | `ANIMATION_SET_NAME[set]`: `'Shape'`, … `'Text'`; the parent row is `Animation`                           |
| tile label               | `animationLabel(value)`: `Ken Burns` for `kenburns`, else the capitalised value                           |
| telemetry type           | `ANIMATION_SET_TELEMETRY_TYPE[set]`                                                                       |
| a set's class prefix     | `ANIMATION_CLASS_PREFIX[set]`: `lvd-anim-`, `lvd-tx-`, `lvd-note-`, `lvd-draw-`, `lvd-media-`, `lvd-tbl-` |
| play once                | the `lvd-once` class (`ONCE_CLASS`), on a reveal whose Repeat is off                                      |

`ElementAnimation` keeps its name: it is the type of the stored `animation` field. `ELEMENT_ANIMATIONS` became
`SHAPE_ANIMATIONS` (its values were exactly the Shape set).

## Modules

| Module                                                    | Holds                                                                                                           |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/animation-sets.ts`                 | the six catalogues, reveals, titles, labels, telemetry types, kept values; a leaf                               |
| `packages/document/src/animation.ts`                      | speed, `animLoops`, icon and progress sets; re-exports `animation-sets`                                         |
| `packages/document/src/animation-membership.ts`           | `bodyAnimationSetOf`, `carriesWords`, `inAnimationSet`, `animationSetsOf`                                       |
| `apps/live/lib/animation-set-writes.ts`                   | `withSetAnimation`, `withSetAnimationSpeed`, `withSetAnimationRepeat`, `withoutAnimations`, `setAnimationState` |
| `apps/live/lib/animation-classes.ts`                      | `ANIMATION_CLASS_PREFIX`, `setAnimationClass`, `bodySetClass`                                                   |
| `apps/live/components/palette/AnimationSections.tsx`      | every animation category for a selection, `animationCategoriesOf` (single and multi menus)                      |
| `apps/live/components/palette/AnimationSetTiles.tsx`      | the tile grid + Speed / Repeat rows for any set, kept tile included                                             |
| `apps/live/components/canvas/useBoxedElementAnimation.ts` | `wrapperShapeAnimation`; the wrapper's Shape / Sticky class, layer flag and variables                           |
| `apps/live/components/canvas/useShapeSvgAnimation.tsx`    | the SVG-rendered shape's Pulse ring, Glow halo, Trace copies and Gradient defs                                  |
| `apps/live/components/canvas/useTraceDashes.ts`           | measures the SVG Trace copies' on-screen length onto them                                                       |
| `apps/live/components/canvas/AnimationLayer.tsx`          | the element's effect layer, above its face; Trace as a measured rounded rectangle                               |
| `apps/live/components/canvas/animated-words.tsx`          | `planTextAnimation`, `renderUnits`, `unitCount`, `scrambleGlyph`, `flickerPhase`                                |
| `apps/live/components/canvas/useTextAnimation.ts`         | `textAnimationView`, `useTextAnimation`, `useLabelTextAnimation`                                                |
| `apps/live/components/canvas/useTableAnimation.ts`        | a table's grid class, counts, cells' Text view and unit starts                                                  |
| `apps/live/components/canvas/drawing-animation.tsx`       | `useDrawingAnimation`: a drawing's mask, filters and overlay                                                    |
| `apps/live/app/motion-<set>.css`                          | each set's keyframes (`shape`, `text`, `sticky`, `drawing`, `media`, `table`)                                   |

`canvas-motion.css` keeps arrow, icon, progress, rating and chart animations and the legacy text-native and
sticker classes a kept Shape value still draws.

## Membership

`bodyAnimationSetOf(el)`:

| Element                                                                | Set                  |
| ---------------------------------------------------------------------- | -------------------- |
| `sticky`                                                               | `sticky`             |
| `freehand`, `path`                                                     | `drawing`            |
| `image`, `video`                                                       | `media`              |
| `table`                                                                | `table`              |
| `text`                                                                 | undefined            |
| `shape` that is an icon, chart, progress or rating                     | undefined (own sets) |
| any other `shape` (stickers and chairs too), `annotation`, `link-card` | `shape`              |

`carriesWords(el)`: `text`, `sticky` and `table` are true; a `shape` is true when `takesTypedLabel(el)`, not
`selfLabelled(el)`, not icon / chart / progress / rating, and not `chair` or `sticker`; everything else is false.

`animationCategoriesOf(elements)` adds icon, chart and arrow to `animationSetsOf` and orders all by
`shape, sticky, drawing, media, table, icon, chart, text, arrow`.

## Data and persistence

New optional fields on `ShapeElement`, `TextElement`, `StickyElement`, `TableElement`: `textAnimation?:
TextAnimation`, `textAnimationSpeed?: AnimationSpeed`, `textAnimationRepeat?: boolean` (Text plays once by default: stored only when true; `setRepeats(set, stored)` reads either default). They
are listed in `ELEMENT_FIELD_NAMES`, mapped to the format painter's `effects` group (`lib/format-config.ts`),
projected by `paintableBoxedFields` for a word-carrying source, and in the OpenAPI document (regenerated with
`node scripts/gen-openapi-schemas.mjs` in `apps/api`). Validation stays lenient.

A text element's `animation` is legacy: `setAnimationState` reads it as the Text value (shown as the kept tile);
`withSetAnimation(el, 'text', v)` on a text element deletes `animation`, `animationSpeed` and `animationRepeat`.

## Behaviour and state

### Writing

Each write maps the selection and returns any element outside the set unchanged (the same reference):

- `previewSetAnimation(set, v)` / `commitSetAnimation(set, v)` in `useStylePreview` (hover preview and the click
  commit, telemetry `ANIMATION_SET_TELEMETRY_TYPE[set]`);
- `setSetAnimationSpeedSelected(set, s)` / `setSetAnimationRepeatSelected(set, r)` in `useElementStyle` (telemetry
  `AnimationSpeed` / `AnimationRepeat`);
- `clearAnimationsSelected()` (Clear animation) removes `animation` and `textAnimation`; the command palette offers
  it when either is set.

The format painter's `fitPaintToTarget(source, target, patch)` drops the body trio between different sets and the
Text trio onto a target without words.

### Rendering

| Set     | Where the class lands                                                        | Built by                                                      |
| ------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| shape   | the wrapper, its `.lvd-anim-layer` child, the SVG overlay, or silhouette art | `useBoxedElementAnimation`, `useShapeSvgAnimation`            |
| text    | the label's content node (`lvd-tx lvd-tx-<v>`) and its unit spans            | `useLabelTextAnimation` / `useTableAnimation` + `renderUnits` |
| sticky  | the wrapper, and the layer for Peel, Lift and Slap                           | `bodySetClass(el, 'sticky')` in the hook                      |
| drawing | the main line, a mask or filters in its svg, and an overlay svg              | `useDrawingAnimation`                                         |
| media   | the image / video frame; its `img` / `iframe` child moves inside it          | `bodySetClass(el, 'media')`                                   |
| table   | the grid (`--lvd-rows`, `--lvd-cols`) and each cell (`--lvd-r`, `--lvd-c`)   | `useTableAnimation`                                           |

`wrapperShapeAnimation(el)` is the Shape value the wrapper draws: a Shape member's own value; on a sticky or table
the shared Pulse / Glow / Highlight (a note and a table are rectangles); a kept value on any set; and a text
element's legacy value unless it has a `textAnimation`. Annotations, stickers, chairs and timeline rails draw Pulse,
Glow, Trace and Gradient on their silhouette (the `lvd-anim-text-*` / sticker classes: on the art for a sticker or
chair, on the element for a pin or rail); shapes ShapeSvgOverlay really draws (`drawsShapeSvgOverlay`: SVG-rendered
and not claimed by a face of its own) in the overlay; every other element on `AnimationLayer`, rendered after its
face so an opaque face (a plan board, a code block) cannot hide it. Gradient's band multiplies over the face.

The wrapper carries `--lvd-anim-speed`, `--lvd-anim-iter`, `--lvd-anim-color` (the stroke as drawn, or a text
element's ink), `--lvd-anim-size` (`min(w, h)`, unitless px), `--lvd-w`, `--lvd-h`, and `--lvd-anim-bg` for Gradient
and Peel.

### Loops, reveals and rest

Every class is invisible or still at rest: layers and overlays have `opacity: 0` outside keyframes, dashes and
filters live inside keyframes, and the progress properties start at 1.

A reveal's loop cycle reveals by 45%, holds to 86%, fades out by 93% and is whole again at 100%, so the app's own
Reduce Motion (which jumps to the last frame) shows it revealed. `lvd-once` swaps a reveal to keyframes that reveal
and hold, or to one progress pass.

### Text: one progress per label

The content node animates the registered `--lvd-tx-p` (`<number>`, inherits, initial 1) from 0 to 1 over its cycle
`--lvd-tx-d`. Each unit derives its own state with `calc()`: `--lvd-tx-rp = clamp(0, p / 0.45, 1)` is the reveal's
progress and `--r = clamp(0, rp × n − i, 1)` the unit's share. Overlapping variants (`--r2`, `--r3`, `--r4`) spread
a unit over two to four turns. Reveals add `lvd-tx-clear` (the container's opacity). Loops (Wave, Shine, Rainbow)
use the progress alone and are at rest at both ends of their cycle; Rainbow's progress runs in 24 steps. Flicker, Glow, Bounce and Float are ordinary
keyframes.

- **Typewriter.** A unit is shown once `r > 0`. Its `::after` caret shows while `0 < r < 1`; the last unit's
  caret shows from its turn until 86% and blinks by `scale`.
- **Scramble.** `data-a` / `data-b` hold stand-ins from `scrambleGlyph` (FNV-1a of id, index and slot into
  `A–Z a–z 0–9 #%&*?@`); `::before` / `::after` show them by `content: attr()` in the first and second half of the
  unit's turns, in `--lvd-tx-color`; the letter's own colour is mixed to transparent until its turns end.
- **Flicker.** `flickerPhase` marks 12% of letters (always the first) with `data-flick` and a phase `--h`; each runs
  its own keyframe offset by `--h`.
- **Accents.** `--lvd-anim-color` is the stroke or brand sky; `--lvd-tx-mark` the stroke or marker yellow.

### Text: granularity

`planTextAnimation(texts, animation, seed)` counts graphemes (`Intl.Segmenter`, else `Array.from`) and words
(whitespace split) across every text. Letter animations (Typewriter, Cascade, Scramble, Wave, Shine, Flicker,
Rainbow) split letters; Words splits words; the rest are one block. Past `TEXT_ANIM_MAX_LETTERS` a letter animation
runs on words (Scramble as Typewriter); past `TEXT_ANIM_MAX_WORDS` everything runs as one block (reveals as Focus,
loops as Glow). Whitespace stays plain text; in letters mode each word is a no-wrap `lvd-tx-word`. Rich runs split in
turn with a shared counter; a table's cells start where the previous cell ended (`unitCount`).

A page's masthead (`PageMasthead`) plans its title and subtitle as one label and lays an animated copy over each
`InlineTextLine` while it is not being edited. Auto-fit (`scale`) labels keep their SVG `<text>` to measure the fit, painted transparent, and draw the animated
words as HTML in a `foreignObject` over the measured box, at the same 20px, line height 1.2, no wrapping.

The content node carries the full text as `aria-label`; units (or their word groups) are `aria-hidden`; the DOM
text is unchanged.

### Shape set specifics

- **Pulse** ring layer: 2px border in the accent, scaled by `1 + 24 / w` and `1 + 24 / h` as it fades, rest 40%.
- **Glow** layer: a static box-shadow sized from `--lvd-anim-size`, opacity breathing.
- **Trace** layer: an SVG rounded rectangle the element's size (radius its corner, half the short side for a circle
  or stadium) with a tail and head copy, dashes measured by `useTraceDashes`, linear, so the light keeps one speed.
- **Gradient** layer: a 300%-wide band sheet translating, alternate.
- **Shimmer**, **Highlight**: `filter` keyframes on the wrapper (follow any silhouette).
- **SVG-rendered shapes**: `EffectCopy` draws the edge parts again: Pulse a stroked copy scaled from the view box's
  centre; Glow a filled, blurred copy behind; Trace a wide faint tail and a bright head whose px dashes and
  `--lvd-perim` `useTraceDashes` measures (96 samples, re-measured by a `ResizeObserver`), because `pathLength`
  does not hold under `vector-effect: non-scaling-stroke`.

### Drawing specifics

`useDrawingAnimation(el, mainLine, strokePx, ink)` works from the centre line: the drawn path for stroked lines,
the raw points for pen ink (`freehandCanvasPoints` → `catmullRomToBezierPath`). Its main svg units per px are 1 for a
path or pen stroke and `100 / min(w, h)` for another freehand stroke.

- **Draw**: a mask of the centre line, `strokePx × 1.6 + 6` px wide (butt caps), `pathLength 1`, dash offset 1 → 0
  → −1, plus a full rect that joins once the line is drawn (a closed shape's fill).
- **Dash**: a stroked line's own dashes march (`--lvd-dash`); pen ink is dashed by a marching dashed mask.
- **Boil**: three `feTurbulence` (fractal noise, 0.018 per px, one octave) + `feDisplacementMap` (3 to 6 px) filters
  stepped at 8 fps through `--lvd-boil-0..2`.
- **Ink**: stroke width × 2.2 at its peak on a stroked line; pen ink grows an outline 0.9 × its width in its own colour.
- Masks and filters cover the drawing's box plus a margin (`strokePx × 2 + 12` px) in user space, never more.
- **Trace**, **Shimmer**: an overlay svg in the box's px space with `pathLength 1` copies.
- **Glow**: a `drop-shadow` filter on the line.

### Media specifics

Ken Burns, Zoom and Pan move the frame's `img` / `iframe`; Tilt turns the frame with `perspective(600px)` up to 7° and
10°; Develop, Focus,
Wipe and Iris filter or clip the frame; Sheen sweeps the frame's `::after`.

### Table specifics

Rows, Columns and Cells animate the registered `--lvd-tbl-p` on the grid over a 5s cycle; each cell's moment is its
row, column or `r + c` of `--n`, and its share `--k` spans two turns. Scan and Sweep are the grid's `::after` bar
sized `100% / rows` or `100% / cols`; Header sweeps a band across each first-row cell (`data-first-row`), staggered by
column.

## Interfaces and contracts

`AnimationSetTiles` props: `set`, `current: string | null`, `speed`, `repeat`, `onSet`, `onSetSpeed`, `onSetRepeat`,
`onPreview?`, `onPreviewEnd?`. The kept tile is captured at open (like the Speed gate) so hover previews never add or
remove it, and a pick of anything else drops it. It replaced `AnimationTiles`.

`AnimationSections` props: `elements`, `keyPrefix: '' | 'm-'`, `sectionProps`, `flyoutProps`, `handlers` (a `Pick`
of `EditorContextMenuProps`). It renders one `MenuFlyoutSection` titled Animation (key `<prefix>animation`) holding a
`MenuAccordionSection` per category, named by `nameOf` (`ANIMATION_SET_NAME`, or Icon / Chart / Arrow); with one
category it renders that section alone, titled Animation. Section keys are `<prefix>animation-<category>`, and
`<prefix>flow` for arrows.

`EditorContextMenuProps` gained `onSetSetAnimation(set, v)`, `onPreviewSetAnimation(set, v)`,
`onSetSetAnimationSpeed(set, s)`, `onSetSetAnimationRepeat(set, r)` and lost `onSetAnimation`,
`onPreviewAnimation`, `onSetAnimationSpeed`, `onSetAnimationRepeat`; the multi menu lost `bothAnimated`.

## Errors and edge cases

| Case                                                     | Handling                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| Unknown stored value                                     | No class; renders still; no kept tile                                     |
| Empty label with a text animation                        | `textAnimationView` returns undefined                                     |
| Label or cell being edited                               | undefined while editing                                                   |
| Text element with legacy `animation` and `textAnimation` | `textAnimation` wins; the legacy class is not applied                     |
| Image loading, broken or placeholder                     | Media classes apply only to the loaded frame                              |
| Freehand with fewer than two points                      | No centre line; no parts                                                  |
| Table with one row or column                             | `n = 1`: the whole cascade in one turn                                    |
| Rotated element                                          | Independent `translate` / `rotate` / `scale` compose with its `transform` |
| Swing / Sway / Flutter on a rotated element              | Their top-centre origin also moves the rotation's pivot while they run    |

## Security and trust

The fields are cosmetic and closed-set; validation stays lenient. Stand-in glyphs come from a fixed alphabet and
live only in pseudo-element `content`, so a label can never inject markup.

## Performance and limits

- Pure CSS; no animation-frame loop and no timers beyond the existing pop-in drop-off. A board with no animation
  does no new work: every path is behind a value check.
- Text and table cascades animate one registered number per element; the browser restyles that element's units
  each frame. Bounded by 400 letter units (or 120 words) per label, counted across a table's cells.
- Splitting is memoised on the texts and the animation fields; 10 splits of a 400-letter Scramble label measured
  under 5 ms each in the budget test (well under 1 ms on a desktop).
- `useTraceDashes` measures once per mount and on resize (96 `getPointAtLength` samples per copy).
- Boil is the costliest option (three displacement filters, stepped) and is offered only for drawings.

## Presentation and UX

One Animation row with a flyout of sections named as in Domain and naming (a lone section inline, titled
Animation). Tiles are `AnimationPreviewTile`s: a 46 × 30 stage holding the miniature, frozen with
`useFrozenAnimations` at `previewFrame(set, value)` (one `getAnimations({ subtree: true })` pass on mount: pause, set
`currentTime` to frame × duration) and played on pointer enter; moving values (`MOVES`, `ICON_MOVES`) add a dashed
ghost at rest. The miniatures set the variables the canvas would, scaled as for a 120 × 80 element. The kept tile
shows a Shape miniature and the old label. The old static glyphs (`AnimationKindGlyph`, `FlowKindGlyph`,
`IconAnimKindGlyph`, `ProgressAnimKindGlyph`) are gone.

## Accessibility

- Each `motion-<set>.css` lists every class in its `@media (prefers-reduced-motion: reduce)` block with
  `animation: none` (the class test enforces it); the app's Reduce Motion jumps to the last frame, which is the rest
  frame for every loop and the revealed frame for every reveal.
- Split text keeps its full `aria-label`; units are `aria-hidden`.

## Observability

`track('Element', 'Changed', type)` on commit with `ANIMATION_SET_TELEMETRY_TYPE[set]`; each new type is explained
in `apps/telemetry/app/event-explanations.ts`.

## Testing

| Rule                                                                | Test                                                      |
| ------------------------------------------------------------------- | --------------------------------------------------------- |
| Membership, carries words, set order, catalogues, kept values       | `packages/document/src/animation-membership.test.ts`      |
| Every option has a rule in its sheet, none orphaned, reduced motion | `apps/live/app/animation-classes.test.ts`                 |
| One category per set present                                        | `apps/live/components/palette/AnimationSections.test.tsx` |
| Tiles, labels, kept tile                                            | `apps/live/components/palette/AnimationSetTiles.test.tsx` |
| Writes act on members only; Text clears legacy; Clear animation     | `apps/live/lib/animation-set-writes.test.ts`              |
| Painter copies within a set, Text to words                          | `apps/live/lib/format-painter.test.ts`                    |
| Granularity, fallbacks, counting, determinism, aria, budget         | `apps/live/components/canvas/animated-words.test.tsx`     |
| New stylesheets kept out of the chrome motion budget                | `apps/live/motion-budget.test.ts`                         |

## Constants and configuration

| Constant                | Value           | Provenance                                   | Safe range |
| ----------------------- | --------------- | -------------------------------------------- | ---------- |
| `TEXT_ANIM_MAX_LETTERS` | 400             | a long paragraph; bounds per-frame restyling | 100–1000   |
| `TEXT_ANIM_MAX_WORDS`   | 120             | a long sticky note                           | 40–300     |
| Reveal share            | 0.45            | reveal reads as a gesture, not a wait (EA2)  | 0.3–0.6    |
| Hold end / faded        | 0.86 / 0.93     | long enough to read; a short clear           | 0.7–0.95   |
| `FLICKER_SHARE`         | 0.12            | a sign with a few bad letters                | 0.05–0.3   |
| Boil                    | 8 fps, 3 frames | classic hand-drawn boil (EA9)                | 6–12 fps   |
| `TEXT_ACCENT`           | `#0ea5e9`       | brand sky                                    | any        |
| `MARKER_YELLOW`         | `#facc15`       | a highlighter's yellow                       | any        |
| Trace samples           | 96              | sub-pixel accurate on any outline            | 32–256     |

## Assets and external resources

No new assets.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md).
