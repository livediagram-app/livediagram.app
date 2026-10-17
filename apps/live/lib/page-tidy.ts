// An infographic page's Tidy Up (docs/specs/007-editor/illustrate-pages.md "Tidy"; blueprint
// "Page Tidy Up"): the layout the author made, straightened. Pure: elements in, elements out, the
// same array back when nothing would change.
//
// The page's elements are tidied as **blocks**: an element with others wholly inside it carries
// them, and what is inside a block is tidied inside it the same way (a level per depth). Each
// level runs, until nothing moves (at most PAGE_TIDY_PASSES):
//   1. sizes of shapes and stickies rounded to the grid;
//   2. back inside the frame (the page's content box, or the block it sits in), nudged, never
//      scaled; a block bigger than the frame on a side is left on that side;
//   3. shared lines: near-equal starts, centres and ends clustered (within the tolerance) onto one
//      line, a margin or the centre line when one is in the cluster; what lines up with nothing
//      sits on the grid;
//   4. even gaps: three or more similar blocks on one line whose gaps are already close get one;
//   5. the guard: a block that now overlaps one it did not, goes back where it was and stays.
// Locked (and rotated) blocks never move; they are anchors and obstacles like a margin.

import { isBoxed, type BoxedElement, type Element, type ElementId } from '@livediagram/document';
import {
  blocksOf,
  contains,
  EPS,
  featureOf,
  FEATURES,
  lo,
  other,
  overlaps,
  rectOf,
  sameRect,
  SAME,
  shift,
  shiftAlong,
  size,
  type Axis,
  type Block,
  type Rect,
} from './page-tidy-blocks';
import { guard, overlapsAt, rectsIn } from './page-tidy-guard';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The grid what lines up with nothing sits on, and sizes round to: canvas px. */
export const PAGE_TIDY_GRID = 4;
/** "Nearly lined up": a share of the page's short side (about 10 px on A4). */
const PAGE_TIDY_ALIGN_FRACTION = 0.012;
/** The tolerance's floor, so a tiny page still tidies 4 px of drift. */
const PAGE_TIDY_ALIGN_MIN = 4;
/** Gaps are evened when their spread is within this share of their mean (or the tolerance). */
const PAGE_TIDY_GAP_SPREAD = 0.25;
/** "A similar size": the largest at most this many times the smallest, on each side. */
const PAGE_TIDY_SIMILAR_RATIO = 1.5;
/** Passes per level before it settles; each pass only ever moves less. */
const PAGE_TIDY_PASSES = 6;

type Frame = {
  box: Rect;
  // Whether the frame's own lines (its edges, its centre) attract: the page's content box does, a
  // card's edges do not (text is never pulled onto a card's border).
  lines: boolean;
};

export type PageTidyInput = {
  // The ids of the elements on the page (elementIdsOnPage).
  ids: ReadonlySet<ElementId>;
  // The page's rectangle on the canvas.
  rect: Rect;
  // The page's margin (pageMargin): the content box is the rect less it on every side.
  margin: number;
  // Locked elements and everything on a locked layer (lockedElementIds): never moved.
  lockedIds: ReadonlySet<ElementId>;
};

type LevelCtx = { tol: number; origin: { x: number; y: number } };

const snapTo = (v: number, origin: number) =>
  origin + Math.round((v - origin) / PAGE_TIDY_GRID) * PAGE_TIDY_GRID;

// Groups of three or more movable blocks along an axis that share a cross line, are of a similar
// size (each run broken where a block is not) and do not overlap along it, sorted along it.
function linesOf(blocks: Block[], a: Axis): Block[][] {
  const cross = other(a);
  const out: Block[][] = [];
  const taken = new Set<Block>();
  for (const f of FEATURES) {
    const byValue = new Map<number, Block[]>();
    for (const b of blocks) {
      if (!b.movable || taken.has(b)) continue;
      const key = Math.round(featureOf(b.rect, cross, f) / SAME);
      const group = byValue.get(key);
      if (group) group.push(b);
      else byValue.set(key, [b]);
    }
    for (const group of byValue.values()) {
      if (group.length < 3) continue;
      group.sort((p, q) => lo(p.rect, a) - lo(q.rect, a));
      let run: Block[] = [];
      const flush = () => {
        if (run.length >= 3) {
          out.push(run);
          run.forEach((b) => taken.add(b));
        }
        run = [];
      };
      for (const b of group) {
        const head = run[0];
        const prev = run.at(-1);
        const similar =
          !!head &&
          Math.max(head.rect.width, b.rect.width) <=
            PAGE_TIDY_SIMILAR_RATIO * Math.min(head.rect.width, b.rect.width) &&
          Math.max(head.rect.height, b.rect.height) <=
            PAGE_TIDY_SIMILAR_RATIO * Math.min(head.rect.height, b.rect.height);
        const apart = !!prev && lo(b.rect, a) >= lo(prev.rect, a) + size(prev.rect, a) - SAME;
        if (!similar || !apart) flush();
        run.push(b);
      }
      flush();
    }
  }
  return out;
}

const gapsOf = (line: Block[], a: Axis) =>
  line.slice(1).map((b, i) => lo(b.rect, a) - (lo(line[i]!.rect, a) + size(line[i]!.rect, a)));
const evenlySpaced = (line: Block[], a: Axis) => {
  const gaps = gapsOf(line, a);
  return Math.max(...gaps) - Math.min(...gaps) < SAME;
};

// Step 3 along one axis.
function alignAxis(blocks: Block[], frame: Frame, a: Axis, ctx: LevelCtx) {
  // A block between the ends of an evenly spaced line along this axis keeps its place on it: the
  // spacing is the line's, and the grid or a near line must not undo it. The ends still align (the
  // line's gaps follow them).
  const spaced = new Set(
    linesOf(blocks, a)
      .filter((l) => evenlySpaced(l, a))
      .flatMap((l) => l.slice(1, -1)),
  );
  const movers = blocks.filter(
    (b) => b.movable && !spaced.has(b) && size(b.rect, a) <= size(frame.box, a) + EPS,
  );
  if (movers.length === 0) return;
  const moverSet = new Set(movers);
  type Point = { value: number; block?: Block; line?: true };
  // Each block takes the strongest line it is near (the most blocks on it), then the nearest.
  const best = new Map<Block, { delta: number; strength: number }>();
  for (const f of FEATURES) {
    const points: Point[] = blocks.map((b) => ({ value: featureOf(b.rect, a, f), block: b }));
    if (frame.lines) points.push({ value: featureOf(frame.box, a, f), line: true });
    points.sort((p, q) => p.value - q.value);
    for (let i = 0; i < points.length;) {
      // A cluster takes what is within the tolerance of its first point, and goes on through
      // points packed closer than half of it (many copies of one line, each a little off), but
      // never past twice the tolerance, so distinct lines do not chain.
      let j = i + 1;
      while (
        j < points.length &&
        (points[j]!.value - points[i]!.value <= ctx.tol ||
          (points[j]!.value - points[j - 1]!.value <= ctx.tol / 2 &&
            points[j]!.value - points[i]!.value <= 2 * ctx.tol))
      )
        j++;
      const cluster = points.slice(i, j);
      i = j;
      const members = cluster.filter((p) => p.block && moverSet.has(p.block));
      if (members.length === 0) continue;
      const anchors = cluster.filter((p) => p.line || (p.block && !moverSet.has(p.block)));
      if (anchors.length === 0 && members.length < 2) continue;
      const target = clusterTarget(members, anchors);
      for (const m of members) {
        const delta = target - m.value;
        const was = best.get(m.block!);
        // Already on a line it shares: it stays there (a stronger line never pulls it off, so a
        // thin block whose edges sit in three clusters cannot hop between them).
        const strength = Math.abs(delta) < SAME ? Infinity : cluster.length;
        if (
          !was ||
          strength > was.strength ||
          (strength === was.strength && Math.abs(delta) < Math.abs(was.delta) - SAME)
        )
          best.set(m.block!, { delta, strength });
      }
    }
  }
  const origin = a === 'x' ? ctx.origin.x : ctx.origin.y;
  for (const b of movers) {
    const delta = best.get(b)?.delta ?? snapTo(lo(b.rect, a), origin) - lo(b.rect, a);
    if (Math.abs(delta) >= SAME) shiftAlong(b, a, delta);
  }
}

// Where a cluster's line goes: a frame line in it; else the value most of the cluster already
// shares (two or more, anchors counting with members: they are lined up, the rest join them), an
// anchor's on a tie, then the one nearest the middle; else the anchor nearest the middle; else the
// middle member's own line (it stays, the rest join it; never a grid line, which would round each
// of a block's lines differently and split blocks that agree). A single pinned block never pulls a
// line of others onto itself.
function clusterTarget(
  members: { value: number }[],
  anchors: { value: number; line?: true }[],
): number {
  const line = anchors.find((p) => p.line);
  if (line) return line.value;
  const values = members.map((m) => m.value).sort((p, q) => p - q);
  const median = values[Math.floor((values.length - 1) / 2)]!;
  const counts = new Map<number, { value: number; n: number; anchor: boolean }>();
  const count = (v: number, anchor: boolean) => {
    const key = Math.round(v / SAME);
    const c = counts.get(key);
    counts.set(key, { value: c?.value ?? v, n: (c?.n ?? 0) + 1, anchor: anchor || !!c?.anchor });
  };
  for (const v of values) count(v, false);
  for (const p of anchors) count(p.value, true);
  let shared: { value: number; n: number; anchor: boolean } | undefined;
  for (const c of counts.values()) {
    if (c.n < 2) continue;
    const better =
      !shared ||
      c.n > shared.n ||
      (c.n === shared.n && c.anchor && !shared.anchor) ||
      (c.n === shared.n &&
        c.anchor === shared.anchor &&
        Math.abs(c.value - median) < Math.abs(shared.value - median));
    if (better) shared = c;
  }
  if (shared) return shared.value;
  if (anchors.length > 0) {
    return anchors.reduce((p, q) =>
      Math.abs(q.value - median) < Math.abs(p.value - median) ? q : p,
    ).value;
  }
  return median;
}

// Step 4 along one axis: the first and last of each line stay, the ones between take the mean gap.
function evenGaps(blocks: Block[], a: Axis, ctx: LevelCtx) {
  for (const line of linesOf(blocks, a)) {
    const gaps = gapsOf(line, a);
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const spread = Math.max(...gaps) - Math.min(...gaps);
    if (spread < SAME || mean < 0 || spread > Math.max(ctx.tol, PAGE_TIDY_GAP_SPREAD * mean))
      continue;
    let at = lo(line[0]!.rect, a) + size(line[0]!.rect, a);
    for (const b of line.slice(1, -1)) {
      const to = at + mean;
      shiftAlong(b, a, to - lo(b.rect, a));
      at = to + size(b.rect, a);
    }
  }
}

// Step 2: back inside the frame where it fits on that side.
function clamp(blocks: Block[], frame: Frame) {
  for (const b of blocks) {
    if (!b.movable) continue;
    for (const a of ['x', 'y'] as const) {
      const room = size(frame.box, a);
      const s = size(b.rect, a);
      if (s > room + EPS) continue;
      const min = lo(frame.box, a);
      const at = lo(b.rect, a);
      const to = Math.min(Math.max(at, min), min + room - s);
      if (Math.abs(to - at) >= SAME) shiftAlong(b, a, to - at);
    }
  }
}

// Step 1.
function roundSizes(blocks: Block[]) {
  for (const b of blocks) {
    if (!b.movable || !b.resizable) continue;
    const w = Math.max(PAGE_TIDY_GRID, Math.round(b.rect.width / PAGE_TIDY_GRID) * PAGE_TIDY_GRID);
    const h = Math.max(PAGE_TIDY_GRID, Math.round(b.rect.height / PAGE_TIDY_GRID) * PAGE_TIDY_GRID);
    b.rect = { ...b.rect, width: w, height: h };
  }
}

// Steps 1 to 5 over one level's blocks, until a pass moves nothing.
function settleLevel(blocks: Block[], frame: Frame, ctx: LevelCtx, obstacles: readonly Rect[]) {
  if (!blocks.some((b) => b.movable)) return;
  const before = overlapsAt(blocks, obstacles);
  // Back inside first, guarded on its own: what goes back afterwards goes back to here, inside.
  clamp(blocks, frame);
  guard(blocks, obstacles, before);
  for (const b of blocks) b.start = b.rect;
  for (let pass = 0; pass < PAGE_TIDY_PASSES; pass++) {
    const was = blocks.map((b) => b.rect);
    roundSizes(blocks);
    for (const a of ['x', 'y'] as const) alignAxis(blocks, frame, a, ctx);
    for (const a of ['x', 'y'] as const) evenGaps(blocks, a, ctx);
    clamp(blocks, frame);
    const reverted = guard(blocks, obstacles, before);
    if (!reverted && blocks.every((b, i) => sameRect(b.rect, was[i]!))) break;
  }
}

const moveRect = (r: Rect, dx: number, dy: number): Rect => ({ ...r, x: r.x + dx, y: r.y + dy });

function tidyLevel(
  blocks: Block[],
  frame: Frame,
  ctx: LevelCtx,
  obstacles: readonly Rect[],
  // Already settled with its twins' (below): only what is inside its blocks is left to tidy.
  settled = false,
) {
  if (!settled) settleLevel(blocks, frame, ctx, obstacles);
  // Then inside each block, framed by it: a block covering the whole frame (a background) frames
  // its content with the frame itself, lines and all; any other block frames it with its own box,
  // its grid from its own corner. What reaches into the block from outside it (a sibling
  // overlapping it and all it holds, the level's own obstacles) is kept clear of.
  const holders = blocks.filter((b) => b.children.length > 0);
  const covers = (b: Block) => contains(b.rect, frame.box);
  const innerOf = (b: Block) =>
    [
      ...obstacles,
      ...blocks.filter((o) => o !== b && overlaps(o.rect, b.rect)).flatMap(rectsIn),
    ].filter((o) => overlaps(o, b.rect));
  // Twins: blocks of one size (the cards of a grid, the columns of a comparison). What is inside
  // them is first lined up together, each in its own block's coordinates, so every card's icon,
  // figure and caption sit in the same place in it.
  const twins: Block[][] = [];
  for (const b of holders) {
    if (covers(b)) continue;
    // Twins never overlap one another (a Venn's circles): what is inside one would be checked
    // against the other's contents only in its own coordinates.
    const twin = twins.find(
      (g) =>
        Math.abs(g[0]!.rect.width - b.rect.width) < EPS &&
        Math.abs(g[0]!.rect.height - b.rect.height) < EPS &&
        !g.some((o) => overlaps(o.rect, b.rect)),
    );
    if (twin) twin.push(b);
    else twins.push([b]);
  }
  const twinned = new Set<Block>();
  for (const group of twins) {
    if (group.length < 2) continue;
    group.forEach((b) => twinned.add(b));
    const all: Block[] = [];
    const held: Rect[] = [];
    for (const b of group) {
      const { x, y } = b.rect;
      for (const c of b.children) {
        shift(c, -x, -y);
        c.start = c.rect;
        all.push(c);
      }
      held.push(...innerOf(b).map((o) => moveRect(o, -x, -y)));
    }
    const { width, height } = group[0]!.rect;
    settleLevel(
      all,
      { box: { x: 0, y: 0, width, height }, lines: false },
      { ...ctx, origin: { x: 0, y: 0 } },
      held,
    );
    for (const b of group) for (const c of b.children) shift(c, b.rect.x, b.rect.y);
  }
  for (const b of holders) {
    for (const c of b.children) c.start = c.rect;
    if (covers(b)) tidyLevel(b.children, frame, ctx, innerOf(b));
    else
      tidyLevel(
        b.children,
        { box: b.rect, lines: false },
        { ...ctx, origin: { x: b.rect.x, y: b.rect.y } },
        innerOf(b),
        twinned.has(b),
      );
  }
}

/** Passes over the whole page until a pass changes nothing, so a second Tidy Up never does. */
const PAGE_TIDY_RUNS = 10;

/** The page's elements tidied (see the header). The same array when nothing would change. */
export function tidyPageElements(elements: Element[], input: PageTidyInput): Element[] {
  let out = elements;
  for (let run = 0; run < PAGE_TIDY_RUNS; run++) {
    const next = tidyOnce(out, input);
    if (next === out) break;
    out = next;
  }
  return out;
}

function tidyOnce(elements: Element[], input: PageTidyInput): Element[] {
  const { ids, rect, margin, lockedIds } = input;
  const els = elements.filter((el): el is BoxedElement => ids.has(el.id) && isBoxed(el));
  if (els.length === 0) return elements;
  const box = {
    x: rect.x + margin,
    y: rect.y + margin,
    width: Math.max(0, rect.width - 2 * margin),
    height: Math.max(0, rect.height - 2 * margin),
  };
  const tol = Math.max(
    PAGE_TIDY_ALIGN_MIN,
    PAGE_TIDY_ALIGN_FRACTION * Math.min(rect.width, rect.height),
  );
  const roots = blocksOf(els, lockedIds);
  tidyLevel(roots, { box, lines: true }, { tol, origin: { x: box.x, y: box.y } }, []);
  const final = new Map<ElementId, Rect>();
  const collect = (b: Block) => {
    final.set(b.id, b.rect);
    b.children.forEach(collect);
  };
  roots.forEach(collect);
  let changed = false;
  const out = elements.map((el) => {
    const to = final.get(el.id);
    if (!to || !isBoxed(el) || sameRect(to, rectOf(el))) return el;
    changed = true;
    return { ...el, x: r2(to.x), y: r2(to.y), width: r2(to.width), height: r2(to.height) };
  });
  return changed ? out : elements;
}
