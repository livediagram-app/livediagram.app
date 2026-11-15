# Paper label ink

Derived from [Light and dark](../light-and-dark.md), "What a viewer sees": "Words on the plain paper keep the
contrast they were made with" and "Ink marks on the plain paper stay seen".

## Domain and naming

- **Plain paper**: a page with no fill of its own. Stored and printed white (`CANVAS_PAPER.light`), drawn slate in
  the dark editor (`CANVAS_PAPER.dark`, `#0f172a`). `plainPaper(surface)` in `apps/live/lib/stock-colour-projector.ts`
  answers both.
- **Paper label**: a label whose backdrop, as `labelBackdrops` finds it, is the paper itself: no fill of its own and
  no filled element under its centre.
- **Made contrast**: the paper label's ink as stored against the stored paper.
- **Ink mark**: a shape (not a cycle, opacity 1 or unset) that paints with one hex colour: an icon (`shape: 'icon'`)
  its `strokeColor`, any other shape its own `fillColor`. A **paper mark** is one whose backdrop is the paper.

## Behaviour and state

`withPaperLabelInks(before, storedPaper, after, drawnPaper)` in `packages/design/src/paper-label-ink.ts`, pure:

1. `now = labelBackdrops(after, drawnPaper)`; nothing to do when it is empty, or when `storedPaper` equals
   `drawnPaper` (the light editor).
2. `was = labelBackdrops(before, storedPaper)`, matched to `after` by element id.
3. A label is changed only when it is a paper label in both (`behind` is the paper colour, compared lower-case), and
   `contrast(now) < made - 0.01`.
4. Its target is `max(LABEL_BACKDROP_CONTRAST, made)`. Its ink is `reachContrast(ink, drawnPaper, target)`; where the
   walk ends short of the target (no lighter colour of its hue reads more), the walked ink is kept, since it is the
   most the hue reaches.
5. Only `textColor` is written. A rich label's coloured runs keep the 3:1 walk (`withReadableLabelInks`).
6. The same array when nothing changes; a changed array otherwise, with untouched elements kept by identity.

The canvas runs it after `withReadableLabelInks`, on that walk's output, in `createStockColourProjector`, and keeps
an element on a page with a fill of its own as `elementAsSeen` drew it.

### Ink marks

`withPaperMarkInks(before, storedPaper, after, drawnPaper)` in the same file, pure:

1. The same array when `storedPaper` equals `drawnPaper`.
2. A mark in `after` is a candidate only when its colour reads worse on the drawn paper than on the stored one
   (`- 0.01`) and, for a fill, under 3:1 on the drawn paper. No candidate: the same array, with no backdrop lookup.
3. `paperMarkBackdrops(elements, paper, ids)` finds each candidate's backdrop with one `labelBackdrops` pass over the
   list with a probe after each candidate: a `text` element on the candidate's box whose `textColor` is its colour.
   The candidate has the probe's area, so it is never its own backdrop (`labelBackdrops` takes only larger panels).
4. Run for `after` on the drawn paper and for `before` on the stored one, matched by id. A mark is changed only when
   it is a paper mark in both and `contrast(now) < made - 0.01`.
5. Target: an icon `max(LABEL_BACKDROP_CONTRAST, made)`, as a word; a fill `LABEL_BACKDROP_CONTRAST` (3:1, WCAG
   non-text). Nothing below the target is left. The walk is `reachContrast`, cached as the labels' are.
6. An icon gets `strokeColor`; a fill gets `fillColor`, and `strokeColor` too when it equalled the old fill.

`inkedOnPaper(stored, drawn, canvases)` in `apps/live/lib/stock-colour-projector.ts` runs the three walks in order:
marks, `withReadableLabelInks`, `withPaperLabelInks`, so a word on a walked fill is read against the walked fill. The
projector and the layout picker's tiles (`layoutRenderSvg`, a plain page in dark chrome) both call it. The projector's
re-ink cache keeps a prior object only when its `textColor`, `fillColor` and `strokeColor` all match.

The Contents page pictures (`pageThumbFor` in `apps/live/lib/page-thumb.ts`) draw a plain page in dark chrome through a
module-level `createStockColourProjector()`, given `themeViewMap(tab.theme, 'dark')` and `plainPaper('dark')`, so a
picture's elements are the canvas's own projection (theme half, stock colours, then `inkedOnPaper`). The projector keeps
each drawn object while its source is unchanged, so the picture's box cache (keyed by that object) still carries an
unchanged box over. A filled page, and any page in light chrome, draws its elements as stored, as before.
`usePageThumbnails` redraws every picture when `tab.theme` changes. The Map needs no walk of its own: it draws the
canvas's projected elements (`Canvas` passes `canvasElements` through to `CanvasChrome`).

Cost (Work Tracker 897, `vitest` in Node, CPU time, median of 7 runs): 40 cold sign-in screens (13 elements each) draw
in 12.4 ms in light chrome and 15.5 ms on the dark paper, about 0.08 ms more a page. `usePageThumbnails` calls
`pageThumbFor` only for a page whose elements or page changed, so the walk runs for the pages an edit touched.

## Interfaces and contracts

- Input: two element lists of the same elements by id, and two `#rrggbb` paper colours.
- Output: `readonly T[]`, the `after` list or a copy with walked `textColor`s.
- A non-hex ink or backdrop is left out by `labelBackdrops`, so it is never walked.

## Errors and edge cases

- A label new since `before` (no match by id) is left alone.
- A label that reads better on the dark paper than it did on white (light words) is left alone.
- A label made under 3:1 on white is walked to 3:1, as the shared walk would.
- A label on a card, a block or a filled page is never touched here.

## Performance and limits

- Two `labelBackdrops` passes (grid-bucketed, linear in elements) per projection in the dark editor, only when the
  projector re-inks (an element or the canvas changed). The mark walk adds one colour check per shape, and two more
  `labelBackdrops` passes (over the list plus one probe per candidate) only when some mark sinks. Walked inks are cached by `ink|paper|target`, up to
  `PAPER_INK_CACHE_SIZE` (512) entries, cleared whole when full.

## Testing

- `packages/design/src/paper-label-ink.test.ts`: each rule above (paper label walked to its made contrast, hue kept;
  light editor untouched; card labels, filled backdrops, new labels and light words untouched; floor of 3:1; identity
  kept).
- `packages/design/src/paper-label-ink.test.ts` `withPaperMarkInks`: fills to 3:1 with a matching stroke, icons to
  their made contrast with their steps kept, light editor and unsunk parts untouched, parts on cards, washes, cycles,
  words and stroke-less icons untouched, new and moved parts untouched, identity kept, a 4,000-part board in budget.
- `apps/live/lib/pages-template-contrast.test.ts`: every Wireframes template, the Logo Design template and the four
  logo explorations at 4.5:1 in the light and the dark editor, as the canvas draws them, and at 3:1 under every theme
  picked in either half and seen in either; each paper mark on the dark paper at 3:1 (or its made contrast, if less).
- `apps/live/components/canvas/layout-render-thumb.test.tsx`: a dark tile draws the canvas's walked button fill.
- `apps/live/lib/page-thumb.test.ts` "on the dark paper": a dark Contents picture draws the canvas's walked button
  fill, a filled page draws as in light chrome, unchanged boxes carry over, 40 screens in budget.
- `apps/live/components/canvas/Minimap.build.test.ts`: the Map built from the canvas's dark projection draws the walked
  button fill.

## Constants and configuration

- `LABEL_BACKDROP_CONTRAST` (3, shared): the least a walked paper label reaches.
- `PAPER_INK_CACHE_SIZE` (512, safe range 64..4096): walked inks kept.

## Defaults ledger

- D9: the walk keeps a label's made contrast rather than a fixed 4.5:1, so a quiet caption stays quiet and three
  greys stay three steps.
