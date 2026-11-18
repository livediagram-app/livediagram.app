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
  its `strokeColor`, any other shape its own `fillColor` unless it sets `themeLockFill` (a fixed colour, drawn at
  its exact value). A **paper mark** is one whose backdrop is the paper.

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
3. `paperMarkBackdrops(elements, paper, ids)` finds each candidate's backdrop with `backdropBehind(elements, paper,
candidate, index)` (`@liveworkspace/model-core/label-backdrop`): what a box of the candidate's size is read
   against as if painted straight after it. The candidate has the box's area, so it is never its own backdrop (only
   larger panels count). It reads the board's own backdrop grid, the one `labelBackdrops` builds, kept per board and
   paper surface, so the mark pass and the two label passes bucket each board once (Work Tracker 896).
4. Run for `after` on the drawn paper and for `before` on the stored one, matched by id. A mark is changed only when
   it is a paper mark in both and `contrast(now) < made - 0.01`.
5. Target: an icon `max(LABEL_BACKDROP_CONTRAST, made)`, as a word; a fill `LABEL_BACKDROP_CONTRAST` (3:1, WCAG
   non-text). Nothing below the target is left. The walk is `reachContrast`, cached as the labels' are.
6. An icon gets `strokeColor`; a fill gets `fillColor`, and `strokeColor` too when it equalled the old fill.

`inkedOnPaper(stored, drawn, canvases)` in `apps/live/lib/paper-reink.ts` (re-exported by
`apps/live/lib/stock-colour-projector.ts`) runs the three walks in order: marks, `withReadableLabelInks`,
`withPaperLabelInks`, so a word on a walked fill is read against the walked fill. The layout picker's tiles
(`layoutRenderSvg`, a plain page in dark chrome) call it. The projector's re-ink cache keeps a prior object only when
its `textColor`, `fillColor` and `strokeColor` all match.

### Re-inking only what an edit changed

The projector calls `reinkOnPaper(prev, stored, drawn, canvases)` (same file, Work Tracker 963), which keeps the last
run (`InkedBoard`: both boards, the inked board, an id index, the canvases) and answers an edit, local or remote, from
it:

1. **Changed**: an element of the new board whose stored or drawn object differs from the last run's (by id), or that
   is new; and every id gone since. A panel (a shape or a sticky) among them, as it was and as it is, marks its box
   as a **dirty region**.
2. **Affected**: the changed elements, plus every element whose centre lies in a dirty region (edges included). An
   affected panel's box is a dirty region too, repeated until nothing new is added: a part a moved panel now sits
   on can take a walked fill, and the words on that part are read against it.
3. **Supports**: every panel painted before an affected element (or before another support) whose box holds its
   centre, edges included: all that `backdropBehind` and `labelBackdrops` can read for it on either board.
4. The three walks run on the affected elements and their supports only, in paint order, on the stored and the
   drawn board alike; the affected elements take the result, every other element keeps the last run's inked object.
   A sub-board answers as the whole board would: a backdrop is only ever a panel under the centre, painted before,
   and every such panel (and every panel under it, for its own walked fill) is in it.
5. A whole re-ink instead when there is no last run or the canvases changed, when ids repeat, when the paint order
   of kept elements changed (a bring to front), when more than `REINK_MAX_CHANGED` (32) elements changed or went,
   or when affected and supports pass `REINK_MAX_SUB` (512).
6. The drawn board itself when no element took a walk, as `inkedOnPaper` returns it.

The projector forgets the last run whenever it drops its caches (a surface, theme map, canvas or page-view map
change) and whenever it skips the walks.

The Contents page pictures and the Map run no walk of their own. `EditorCanvasHost` hands the canvas its projected
elements (`canvasElements`, through `inkedOnPaper`); `Canvas` spreads them into `CanvasChrome`, `useContentsChrome`
builds the Contents tab from those `elements` unchanged, and `pageThumbFor` draws them as they are. The Map
(`minimapBuild`) draws the same elements. A second projection in `pageThumbFor` was tried and dropped (Work Tracker 897):
walking the already-projected elements again with the default theme map drifted a themed tab's fills (Mono's #2b2e32
drawn #66696e, an Ocean card's #254752 drawn #4b6e7a).

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
  projector re-inks (an element or the canvas changed). The mark walk adds one colour check per distinct colour, and
  one grid lookup per candidate on each paper only when some mark sinks; the grid is the label passes' own (built
  once per board and surface), and a lookup reads its cell up to the candidate's paint index with no copy. Walked inks
  are cached by `ink|paper|target`, up to `PAPER_INK_CACHE_SIZE` (512) entries, cleared whole when full; contrast
  ratios are kept per call by colour.
- Measured (Work Tracker 896), 4,000 parts plus 40 cards with words and icons, in Node on a loaded machine, median of
  eight: the whole `inkedOnPaper` chain with every part sunk 26 to 31 ms before, 15 to 20 ms after; with nothing
  sunk 12 to 13 ms before, 9 to 11 ms after. At a 4x CPU throttle the sunk case is about 60 to 80 ms per re-ink. The
  projector re-inks when an element or the canvas changes (a remote edit included), so a dark-editor board of
  thousands of sunk parts spent a few frames per edit. The 4,000-part budget test holds the mark walk at 150 ms (was
  400).
- Re-inking only what an edit changed (Work Tracker 963), measured on the same kind of board through the projector,
  one part moved per edit (4,000 parts, every one sunk, plus 40 cards with words), in Node on a loaded machine,
  median of 40 edits: the walks 0.56 ms (a whole re-ink of the same board 10.1 ms), the projector's whole call 1 to
  1.5 ms (was 9 to 12 ms). At a 4x CPU throttle that is about 2 ms for the walks, under the 16 ms frame. Finding what
  changed is one pass over the board with a map lookup each; the dirty regions and the supports add one pass per
  region round and per affected element, bounded by `REINK_MAX_CHANGED` and `REINK_MAX_SUB`.

## Testing

- `packages/design/src/paper-label-ink.test.ts`: each rule above (paper label walked to its made contrast, hue kept;
  light editor untouched; card labels, filled backdrops, new labels and light words untouched; floor of 3:1; identity
  kept).
- `packages/design/src/paper-label-ink.test.ts` `withPaperMarkInks`: fills to 3:1 with a matching stroke, icons to
  their made contrast with their steps kept, light editor and unsunk parts untouched, parts on cards, washes, cycles,
  words, stroke-less icons and locked fills (`themeLockFill`) untouched, new and moved parts untouched, identity kept, a 4,000-part board in budget.
- `apps/live/lib/paper-reink.test.ts`: `reinkOnPaper` equals a whole `inkedOnPaper` after every one of 960 random
  edits (moves, recolours, resizes, adds, removals, a bring to front) on 24 seeded boards with nested cards, washes,
  stickies, cycles, words and icons; a moved part re-inks alone and every other walked part keeps its object; a label
  a part moves off or onto is re-inked, as is one under a card a moved card now holds; each whole re-ink case; a
  4,000-part board re-inks one remote edit within 4 ms of CPU (16 ms at a 4x throttle); the projector after a remote
  edit draws what a fresh projector draws.
- `apps/live/lib/pages-template-contrast.test.ts`: every Wireframes template, the Logo Design template and the four
  logo explorations at 4.5:1 in the light and the dark editor, as the canvas draws them, and at 3:1 under every theme
  picked in either half and seen in either; each paper mark on the dark paper at 3:1 (or its made contrast, if less).
- `apps/live/components/canvas/layout-render-thumb.test.tsx`: a dark tile draws the canvas's walked button fill.
- `apps/live/lib/page-thumb.test.ts` "on the dark paper": a dark Contents picture of the canvas's projected elements
  draws every fill the canvas draws (the default theme, Mono and Ocean screens) and the button the canvas lifted.
- `apps/live/components/canvas/useContentsChrome.test.tsx`: Contents is handed the canvas's `elements` array as it is.
- `apps/live/components/canvas/Minimap.build.test.ts`: the Map built from the canvas's dark projection draws the walked
  button fill.

## Constants and configuration

- `LABEL_BACKDROP_CONTRAST` (3, shared): the least a walked paper label reaches.
- `PAPER_INK_CACHE_SIZE` (512, safe range 64..4096): walked inks kept.

## Defaults ledger

- D9: the walk keeps a label's made contrast rather than a fixed 4.5:1, so a quiet caption stays quiet and three
  greys stay three steps.
