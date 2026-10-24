// What is drawn behind a label, and keeping a label readable on it when a theme repaints one without the other
// (docs/specs/011-theme/light-and-dark.md "A theme never sinks a label into what is behind it"). Pure.
import { mixHex } from '@liveworkspace/model-core/color-wash';
import {
  canvasSurface,
  contrastRatio,
  defaultFillColor,
  defaultTextColor,
  type CanvasSurface,
} from './colors';
import { reachContrast } from './readable-colour';
import type { BoxedElement, Element } from './index';

/** The floor a label keeps against what is behind it: WCAG's large-text and non-text minimum. Below it a label is
 *  unreadable, not just quiet. */
export const LABEL_BACKDROP_CONTRAST = 3;

/** The grid the panel lookup buckets by, in canvas px: a label checks only the panels in its own cell. A panel wider
 *  than this spans several cells; one spanning more than LABEL_GRID_MAX_CELLS goes on a list every label checks.
 *  Safe ranges: 128..2048 px, 256..65536 cells. */
const LABEL_GRID_PX = 512;
const LABEL_GRID_MAX_CELLS = 4096;

const HEX = /^#[0-9a-f]{6}$/i;

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

const boxOf = (el: Element): Box => el;
const num = (v: number | undefined): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

/** Elements whose fill can sit behind a label: shapes and stickies. */
const isPanel = (b: Box): boolean => b.type === 'shape' || b.type === 'sticky';
/** Elements that write a label of their own, plain or rich. */
const isLabel = (b: Box): boolean =>
  (b.type === 'text' || b.type === 'shape') &&
  ((typeof b.label === 'string' && b.label.trim() !== '') || runsOf(b).length > 0);

function fillOf(b: Box, surface: CanvasSurface): string | null {
  const fill =
    typeof b.fillColor === 'string' ? b.fillColor : defaultFillColor(b as BoxedElement, surface);
  return HEX.test(fill) ? fill : null;
}

function inkOf(b: Box, surface: CanvasSurface): string | null {
  const ink =
    typeof b.textColor === 'string' ? b.textColor : defaultTextColor(b as BoxedElement, surface);
  return HEX.test(ink) ? ink : null;
}

const centreOf = (b: Box) => ({
  x: num(b.x) + num(b.width) / 2,
  y: num(b.y) + num(b.height) / 2,
});
const area = (b: Box) => num(b.width) * num(b.height);

/** Each label's ink and the colour drawn behind it, by element index: its own fill (a shape, but not a cycle, which
 *  writes between its discs), else the topmost filled element under its centre that is larger than it (a translucent
 *  one mixed over what is under it), else the canvas. Labels whose ink or backdrop is not a hex colour are left out. */
export function labelBackdrops(
  elements: readonly Element[],
  canvas: string,
): Map<number, { ink: string; behind: string }> {
  const surface = canvasSurface(canvas);
  const boxes = elements.map(boxOf);
  // Panels by grid cell, in paint order.
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

  const out = new Map<number, { ink: string; behind: string }>();
  boxes.forEach((b, i) => {
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
    const c = centreOf(b);
    const inCell =
      cells.get(`${Math.floor(c.x / LABEL_GRID_PX)},${Math.floor(c.y / LABEL_GRID_PX)}`) ?? [];
    // Panels painted before the label, topmost first.
    const under = [...inCell, ...everywhere]
      .filter((j) => j < i)
      .sort((p, q) => q - p)
      .filter((j) => {
        const p = boxes[j]!;
        return (
          c.x > num(p.x) &&
          c.x < num(p.x) + num(p.width) &&
          c.y > num(p.y) &&
          c.y < num(p.y) + num(p.height) &&
          area(p) > area(b)
        );
      });
    const behind = (k: number): string => {
      const j = under[k];
      if (j === undefined) return canvas;
      const p = boxes[j]!;
      const fill = fillOf(p, surface)!;
      const opacity = typeof p.opacity === 'number' ? p.opacity : 1;
      return opacity >= 1 ? fill : mixHex(fill, behind(k + 1), opacity);
    };
    const backdrop = behind(0);
    if (HEX.test(backdrop)) out.set(i, { ink, behind: backdrop });
  });
  return out;
}

/** How many walked inks are kept: a tab repeats a handful of ink-on-backdrop pairs, so a small cache answers nearly
 *  every label (4,000 sunk labels: 115 ms of walking uncached). Cleared whole when full; safe range 64..4096. */
const READABLE_INK_CACHE_SIZE = 512;
const READABLE_INK = new Map<string, string>();

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
export function withReadableLabelInks<T extends Element>(
  before: readonly Element[],
  beforeCanvas: string,
  after: readonly T[],
  afterCanvas: string,
): readonly T[] {
  const now = labelBackdrops(after, afterCanvas);
  if (now.size === 0) return after;
  let was: Map<number, { ink: string; behind: string }> | null = null;
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
