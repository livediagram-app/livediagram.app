// What is drawn behind a label, and keeping a label readable on it when a theme or a dark editor repaints one without
// the other ("A theme never sinks a label into what is behind it" in each product's docs/specs/011-theme/
// light-and-dark.md). One set of rules for every product: each binds it to its own colours (labelInks). Pure.
import { mixHex } from './color-wash';

/** The floor a label keeps against what is behind it: WCAG's large-text and non-text minimum. Below it a label is
 *  unreadable, not just quiet. */
export const LABEL_BACKDROP_CONTRAST = 3;

type Surface = 'light' | 'dark';

/** A product's colour rules the label lookup reads by: which surface a canvas colour is, the WCAG ratio of two
 *  colours, an element's own fill and ink where it stores none, and the least walk of an ink to a ratio on a colour. */
export type LabelInkColours<E> = {
  canvasSurface: (canvas: string) => Surface;
  contrastRatio: (a: string, b: string) => number;
  defaultFillColor: (el: E, surface: Surface) => string;
  defaultTextColor: (el: E, surface: Surface) => string;
  reachContrast: (fg: string, bg: string, min: number) => string;
};

/** The grid the panel lookup buckets by, in canvas px: a label checks only the panels in its own cell. A panel wider
 *  than this spans several cells; one spanning more than LABEL_GRID_MAX_CELLS goes on a list every label checks.
 *  Safe ranges: 128..2048 px, 256..65536 cells. */
const LABEL_GRID_PX = 512;
const LABEL_GRID_MAX_CELLS = 4096;

const HEX = /^#[0-9a-f]{6}$/i;
const NONE: readonly number[] = [];

type Box = {
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  label?: unknown;
  shape?: string;
  fillColor?: unknown;
  textColor?: unknown;
  richText?: unknown;
  opacity?: unknown;
};

type Run = { color?: unknown };
const runsOf = (el: object): readonly Run[] => {
  const runs = (el as Box).richText;
  return Array.isArray(runs) ? (runs as Run[]) : [];
};

const num = (v: number | undefined): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

/** Elements whose fill can sit behind a label: shapes and stickies. */
const isPanel = (b: Box): boolean => b.type === 'shape' || b.type === 'sticky';
/** Elements that write a label of their own, plain or rich. */
const isLabel = (b: Box): boolean =>
  (b.type === 'text' || b.type === 'shape') &&
  ((typeof b.label === 'string' && b.label.trim() !== '') || runsOf(b).length > 0);

const centreOf = (b: Box) => ({
  x: num(b.x) + num(b.width) / 2,
  y: num(b.y) + num(b.height) / 2,
});
const area = (b: Box) => num(b.width) * num(b.height);

/** A label's ink and the colour drawn behind it. */
type Backdrop = { ink: string; behind: string };

/** How many walked inks are kept: a tab repeats a handful of ink-on-backdrop pairs, so a small cache answers nearly
 *  every label (4,000 sunk labels: 115 ms of walking uncached). Cleared whole when full; safe range 64..4096. */
const READABLE_INK_CACHE_SIZE = 512;

/** The label lookup bound to one product's colours: labelBackdrops (what each label is read against),
 *  withReadableLabelInks (a redraw's labels lifted off what they sank into) and backdropBehind (what any box is read
 *  against, on the same grid). Each binding keeps its own small cache of
 *  walked inks. */
export function labelInks<E extends { id: string; type: string }>(colours: LabelInkColours<E>) {
  const { canvasSurface, contrastRatio, defaultFillColor, defaultTextColor, reachContrast } =
    colours;
  const READABLE_INK = new Map<string, string>();
  const boxOf = (el: E): Box => el;

  function fillOf(b: Box, surface: Surface): string | null {
    const fill =
      typeof b.fillColor === 'string' ? b.fillColor : defaultFillColor(b as unknown as E, surface);
    return HEX.test(fill) ? fill : null;
  }

  function inkOf(b: Box, surface: Surface): string | null {
    const ink =
      typeof b.textColor === 'string' ? b.textColor : defaultTextColor(b as unknown as E, surface);
    return HEX.test(ink) ? ink : null;
  }

  // Each board's answer by canvas, kept while the board is: a redraw asks the same question of the same board more than
  // once (the 3:1 walk and the paper walk both read the stored board, and the drawn one when the walk changed nothing).
  const BACKDROPS = new WeakMap<readonly E[], Map<string, ReadonlyMap<number, Backdrop>>>();

  /** Each label's ink and the colour drawn behind it, by element index: its own fill (a shape, but not a cycle, which
   *  writes between its discs), else the topmost filled element under its centre that is larger than it (a translucent
   *  one mixed over what is under it), else the canvas. Labels whose ink or backdrop is not a hex colour are left out.
   *  Answered once per board and canvas (elements are never changed in place). */
  function labelBackdrops(elements: readonly E[], canvas: string): ReadonlyMap<number, Backdrop> {
    let byCanvas = BACKDROPS.get(elements);
    const known = byCanvas?.get(canvas);
    if (known) return known;
    const out = backdropsOf(elements, canvas);
    if (!byCanvas)
      BACKDROPS.set(elements, (byCanvas = new Map<string, ReadonlyMap<number, Backdrop>>()));
    byCanvas.set(canvas, out);
    return out;
  }

  /** Fill panels by grid cell, in paint order, for one board on one surface: what every backdrop lookup on that board
   *  reads. Built once per board and surface and shared by every pass that asks (the label lookup, and the ink marks'
   *  backdropBehind), so a redraw that reads the same board twice buckets it once. */
  type Grid = { boxes: readonly Box[]; cells: Map<string, number[]>; everywhere: number[] };
  const GRIDS = new WeakMap<readonly E[], Map<Surface, Grid>>();

  function gridOf(elements: readonly E[], surface: Surface): Grid {
    let bySurface = GRIDS.get(elements);
    const known = bySurface?.get(surface);
    if (known) return known;
    const boxes = elements.map(boxOf);
    const cells = new Map<string, number[]>();
    const everywhere: number[] = [];
    boxes.forEach((b, j) => {
      if (!isPanel(b) || !fillOf(b, surface)) return;
      const x0 = Math.floor(num(b.x) / LABEL_GRID_PX);
      const y0 = Math.floor(num(b.y) / LABEL_GRID_PX);
      const x1 = Math.floor((num(b.x) + num(b.width)) / LABEL_GRID_PX);
      const y1 = Math.floor((num(b.y) + num(b.height)) / LABEL_GRID_PX);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > LABEL_GRID_MAX_CELLS) {
        everywhere.push(j);
        return;
      }
      for (let cx = x0; cx <= x1; cx++)
        for (let cy = y0; cy <= y1; cy++) {
          const key = `${cx},${cy}`;
          const list = cells.get(key);
          if (list) list.push(j);
          else cells.set(key, [j]);
        }
    });
    const grid = { boxes, cells, everywhere };
    if (!bySurface) GRIDS.set(elements, (bySurface = new Map<Surface, Grid>()));
    bySurface.set(surface, grid);
    return grid;
  }

  /** The colour drawn under `b`'s centre by the panels painted before index `before` that are larger than it (a
   *  translucent one mixed over what is under it), else the canvas. */
  function behindOn(grid: Grid, surface: Surface, canvas: string, b: Box, before: number): string {
    const { boxes, cells, everywhere } = grid;
    const c = centreOf(b);
    const inCell =
      cells.get(`${Math.floor(c.x / LABEL_GRID_PX)},${Math.floor(c.y / LABEL_GRID_PX)}`) ?? NONE;
    // Panels painted before, topmost first. Both lists are in paint order, so each is read up to `before` and no
    // further, with no copy of either: this runs once per label and per ink mark on every redraw.
    const under: number[] = [];
    const take = (list: readonly number[]) => {
      for (const j of list) {
        if (j >= before) break;
        const p = boxes[j]!;
        if (
          c.x > num(p.x) &&
          c.x < num(p.x) + num(p.width) &&
          c.y > num(p.y) &&
          c.y < num(p.y) + num(p.height) &&
          area(p) > area(b)
        )
          under.push(j);
      }
    };
    take(inCell);
    take(everywhere);
    if (everywhere.length > 0) under.sort((p, q) => q - p);
    else under.reverse();
    const behind = (k: number): string => {
      const j = under[k];
      if (j === undefined) return canvas;
      const p = boxes[j]!;
      const fill = fillOf(p, surface)!;
      const opacity = typeof p.opacity === 'number' ? p.opacity : 1;
      return opacity >= 1 ? fill : mixHex(fill, behind(k + 1), opacity);
    };
    return behind(0);
  }

  function backdropsOf(elements: readonly E[], canvas: string): Map<number, Backdrop> {
    const surface = canvasSurface(canvas);
    const grid = gridOf(elements, surface);
    const out = new Map<number, Backdrop>();
    grid.boxes.forEach((b, i) => {
      if (!isLabel(b)) return;
      const ink = inkOf(b, surface);
      if (!ink) return;
      if (b.type === 'shape' && b.shape !== 'cycle') {
        const own = fillOf(b, surface);
        if (own) {
          out.set(i, { ink, behind: own });
          return;
        }
      }
      const backdrop = behindOn(grid, surface, canvas, b, i);
      if (HEX.test(backdrop)) out.set(i, { ink, behind: backdrop });
    });
    return out;
  }

  /** What is drawn behind a box of `box`'s size at its place on `canvas`, as if it were painted straight after element
   *  `after` of `elements` (so that element, the same size, is never its own backdrop): the topmost larger panel under
   *  its centre, else the canvas. Null when that is not a hex colour. Reads the same grid as labelBackdrops on that
   *  board, built once per board and surface. */
  function backdropBehind(
    elements: readonly E[],
    canvas: string,
    box: { x?: number; y?: number; width?: number; height?: number },
    after: number,
  ): string | null {
    const surface = canvasSurface(canvas);
    const backdrop = behindOn(gridOf(elements, surface), surface, canvas, box as Box, after + 1);
    return HEX.test(backdrop) ? backdrop : null;
  }

  // The ink walked in lightness to the floor; where a saturated hue cannot get there, black or white, whichever reads.
  function readableOn(ink: string, behind: string): string {
    const key = `${ink}|${behind}`;
    const known = READABLE_INK.get(key);
    if (known) return known;
    const walked = reachContrast(ink, behind, LABEL_BACKDROP_CONTRAST);
    const out =
      contrastRatio(walked, behind) >= LABEL_BACKDROP_CONTRAST
        ? walked
        : contrastRatio('#000000', behind) >= contrastRatio('#ffffff', behind)
          ? '#000000'
          : '#ffffff';
    if (READABLE_INK.size >= READABLE_INK_CACHE_SIZE) READABLE_INK.clear();
    READABLE_INK.set(key, out);
    return out;
  }

  /** `after` (the same elements as `before`, by id, after a theme was applied or drawn in the other half, on
   *  `afterCanvas`) with each label the change left under LABEL_BACKDROP_CONTRAST against what is behind it, and
   *  reading worse than it did in `before` on `beforeCanvas`, given an ink walked in lightness until it reaches the
   *  floor; a rich label's coloured runs the same, each against its own colour before. A label that reads no worse
   *  than it did keeps its ink: no theme did that. The same array when nothing changes. */
  function withReadableLabelInks<T extends E>(
    before: readonly E[],
    beforeCanvas: string,
    after: readonly T[],
    afterCanvas: string,
  ): readonly T[] {
    const now = labelBackdrops(after, afterCanvas);
    if (now.size === 0) return after;
    let was: ReadonlyMap<number, Backdrop> | null = null;
    let beforeIndex: Map<string, number> | null = null;
    // The label as it was before the change: its element, and its ink and backdrop then.
    const priorOf = (i: number) => {
      was ??= labelBackdrops(before, beforeCanvas);
      beforeIndex ??= new Map(before.map((el, k) => [el.id, k] as const));
      const k = beforeIndex.get(after[i]!.id);
      return k === undefined ? null : { el: before[k]!, drawn: was.get(k) };
    };
    // Sunk by the change: under the floor now, and reading worse than it did.
    const sunk = (ratio: number, prior: number) =>
      ratio < LABEL_BACKDROP_CONTRAST && ratio < prior - 0.01;
    let out: T[] | null = null;
    for (const [i, { ink, behind }] of now) {
      const el = after[i]!;
      let patch: { textColor?: string; richText?: Run[] } | null = null;
      const ratio = contrastRatio(ink, behind);
      if (ratio < LABEL_BACKDROP_CONTRAST) {
        const prior = priorOf(i)?.drawn;
        if (sunk(ratio, prior ? contrastRatio(prior.ink, prior.behind) : Infinity))
          patch = { textColor: readableOn(ink, behind) };
      }
      const runs = runsOf(el);
      let walked: Run[] | null = null;
      runs.forEach((run, r) => {
        if (typeof run.color !== 'string' || !HEX.test(run.color)) return;
        const runRatio = contrastRatio(run.color, behind);
        if (!(runRatio < LABEL_BACKDROP_CONTRAST)) return;
        const prior = priorOf(i);
        const priorColour = prior ? runsOf(prior.el)[r]?.color : undefined;
        const priorRatio =
          prior?.drawn && typeof priorColour === 'string' && HEX.test(priorColour)
            ? contrastRatio(priorColour, prior.drawn.behind)
            : Infinity;
        if (!sunk(runRatio, priorRatio)) return;
        walked ??= [...runs];
        walked[r] = { ...run, color: readableOn(run.color, behind) };
      });
      if (walked) patch = { ...patch, richText: walked };
      if (!patch) continue;
      out ??= [...after];
      out[i] = { ...el, ...patch };
    }
    return out ?? after;
  }

  return { labelBackdrops, withReadableLabelInks, backdropBehind };
}
