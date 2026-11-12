# Paper label ink

Derived from [Light and dark](../light-and-dark.md), "What a viewer sees": "Words on the plain paper keep the
contrast they were made with".

## Domain and naming

- **Plain paper**: a page with no fill of its own. Stored and printed white (`CANVAS_PAPER.light`), drawn slate in
  the dark editor (`CANVAS_PAPER.dark`, `#0f172a`). `plainPaper(surface)` in `apps/live/lib/stock-colour-projector.ts`
  answers both.
- **Paper label**: a label whose backdrop, as `labelBackdrops` finds it, is the paper itself: no fill of its own and
  no filled element under its centre.
- **Made contrast**: the paper label's ink as stored against the stored paper.

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
  projector re-inks (an element or the canvas changed). Walked inks are cached by `ink|paper|target`, up to
  `PAPER_INK_CACHE_SIZE` (512) entries, cleared whole when full.

## Testing

- `packages/design/src/paper-label-ink.test.ts`: each rule above (paper label walked to its made contrast, hue kept;
  light editor untouched; card labels, filled backdrops, new labels and light words untouched; floor of 3:1; identity
  kept).
- `apps/live/lib/pages-template-contrast.test.ts`: every Wireframes template, the Logo Design template and the four logo explorations at 4.5:1
  in the light and the dark editor, as the canvas draws them.

## Constants and configuration

- `LABEL_BACKDROP_CONTRAST` (3, shared): the least a walked paper label reaches.
- `PAPER_INK_CACHE_SIZE` (512, safe range 64..4096): walked inks kept.

## Defaults ledger

- D9: the walk keeps a label's made contrast rather than a fixed 4.5:1, so a quiet caption stays quiet and three
  greys stay three steps.
