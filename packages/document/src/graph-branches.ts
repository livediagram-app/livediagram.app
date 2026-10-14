// How graph input's lines leave and join their boxes (docs/specs/015-api/mcp-server.md §4.7 "The graph look"): which
// arrows meet in one trunk or bus, and which of a step's exits leave by another side.

import { isBoxed, type Anchor, type ArrowElement, type BoxedElement, type Element } from './index';

const pinned = (end: ArrowElement['from']) => (end.kind === 'pinned' ? end.elementId : null);

// What an arrow says, for telling apart arrows that would share a trunk: its label and its line.
const saying = (a: ArrowElement) => `${a.label?.trim().toLowerCase() ?? ''}|${a.strokeStyle ?? ''}`;

// Arrows leaving one node share one trunk, and arrows into one node one bus, the org-chart shape: each end sits exactly
// on its anchor, so siblings' bends at the same height merge into one line. Only lines drawn alike merge: where solid
// and dashed meet at one end of a node, the style most of them have (solid on a tie) shares it and the rest keep their
// own ends, so a dashed event line never rides a solid call's trunk. A labelled arrow keeps its own ends, as a label on
// a shared line could not say which line it names, unless the arrows meeting there all say the same thing in the same
// line (services that each "publish" to one bus): those merge, and each label sits on its own leg.
export function withExactEnds(elements: Element[]): Element[] {
  const arrows = elements.filter((el): el is ArrowElement => el.type === 'arrow');
  const line = (a: ArrowElement) => a.strokeStyle ?? 'solid';
  const said = new Map<string, number>();
  const styles = new Map<string, Map<string, number>>();
  const at = (side: 'from' | 'to', a: ArrowElement) => `${side}:${pinned(a[side])}`;
  for (const a of arrows)
    for (const side of ['from', 'to'] as const) {
      if (a.label?.trim())
        said.set(`${at(side, a)}:${saying(a)}`, (said.get(`${at(side, a)}:${saying(a)}`) ?? 0) + 1);
      const m = styles.get(at(side, a)) ?? styles.set(at(side, a), new Map()).get(at(side, a))!;
      m.set(line(a), (m.get(line(a)) ?? 0) + 1);
    }
  const dominant = (key: string) =>
    [...styles.get(key)!].sort(
      ([p, n], [q, k]) => k - n || (p === 'solid' ? -1 : q === 'solid' ? 1 : p < q ? -1 : 1),
    )[0]![0];
  const exact = (side: 'from' | 'to', a: ArrowElement) =>
    line(a) === dominant(at(side, a)) &&
    (!a.label?.trim() || (said.get(`${at(side, a)}:${saying(a)}`) ?? 0) > 1);
  return elements.map((el) => {
    if (el.type !== 'arrow') return el;
    const [start, end] = [exact('from', el), exact('to', el)];
    if (!start && !end) return el;
    return { ...el, ...(start ? { exactStart: true } : {}), ...(end ? { exactEnd: true } : {}) };
  });
}

// How far beyond a step's own edge its next step must lie for an exit to leave that side: nearer, the line would turn
// back on itself.
export const BRANCH_CLEAR = 24;

export type BranchOptions = {
  // The flow's direction: exits leave the point toward it, the others the sides across it.
  axis: 'TB' | 'LR';
  // The exits that may move (a flow's unlabelled exits share a trunk and stay).
  eligible?: (a: ArrowElement) => boolean;
};

// A step's exits leave by different sides: the one whose next step sits most nearly in line with it keeps the point
// toward the flow; each other leaves from the side across the flow toward its next step and enters that step square
// (one bend, arrow-orthogonal.ts). Farthest first, an exit takes its side only when nothing else ends there (a
// hand-off arriving), its next step lies clearly beyond that side (BRANCH_CLEAR) and another exit is left on the
// point; otherwise it stays on the point, fanned.
export function branchExits(elements: Element[], opts: BranchOptions): Element[] {
  const tb = opts.axis === 'TB';
  const point: Anchor = tb ? 's' : 'e';
  const [before, after]: [Anchor, Anchor] = tb ? ['w', 'e'] : ['n', 's'];
  const boxes = new Map(elements.filter(isBoxed).map((b) => [b.id, b as BoxedElement] as const));
  const arrows = elements.filter((el): el is ArrowElement => el.type === 'arrow');
  // The boxes a side exit's one bend must clear: every box but the frames and lanes that hold them.
  const solid = [...boxes.values()].filter(
    (b) => !(b.type === 'shape' && (b.shape === 'frame' || b.shape === 'lane')),
  );
  const used = new Set<string>();
  for (const a of arrows)
    for (const end of [a.from, a.to])
      if (end.kind === 'pinned') used.add(`${end.elementId}:${end.anchor}`);
  const bySource = new Map<string, ArrowElement[]>();
  for (const a of arrows) {
    const from = pinned(a.from);
    if (!from || a.from.kind !== 'pinned' || a.from.anchor !== point) continue;
    if (!boxes.has(from) || !boxes.has(pinned(a.to) ?? '')) continue;
    (bySource.get(from) ?? bySource.set(from, []).get(from)!).push(a);
  }
  const side = new Map<string, Anchor>();
  for (const [id, exits] of bySource) {
    if (exits.length < 2) continue;
    const src = boxes.get(id)!;
    const centre = tb ? src.x + src.width / 2 : src.y + src.height / 2;
    const half = (tb ? src.width : src.height) / 2;
    const off = (a: ArrowElement) => {
      const t = boxes.get(pinned(a.to)!)!;
      return (tb ? t.x + t.width / 2 : t.y + t.height / 2) - centre;
    };
    let onPoint = exits.length;
    for (const a of [...exits].sort((p, q) => Math.abs(off(q)) - Math.abs(off(p)))) {
      if (onPoint < 2) break;
      if (opts.eligible && !opts.eligible(a)) continue;
      const anchor = off(a) < 0 ? before : after;
      if (Math.abs(off(a)) <= half + BRANCH_CLEAR || used.has(`${id}:${anchor}`)) continue;
      if (!clearPath(src, boxes.get(pinned(a.to)!)!, anchor, tb, solid)) continue;
      side.set(a.id, anchor);
      used.add(`${id}:${anchor}`);
      onPoint--;
    }
  }
  if (side.size === 0) return elements;
  return elements.map((el) => {
    const anchor = el.type === 'arrow' ? side.get(el.id) : undefined;
    return anchor && el.type === 'arrow' && el.from.kind === 'pinned'
      ? { ...el, from: { ...el.from, anchor } }
      : el;
  });
}

// Whether a side exit's one bend (out of the side across the flow, then along it into the next step) clears every
// box but its two ends: one that would run behind a box between stays on the point, where the router can take it.
function clearPath(
  src: BoxedElement,
  dst: BoxedElement,
  anchor: Anchor,
  tb: boolean,
  solid: readonly BoxedElement[],
): boolean {
  const start = {
    x: anchor === 'e' ? src.x + src.width : anchor === 'w' ? src.x : src.x + src.width / 2,
    y: anchor === 's' ? src.y + src.height : anchor === 'n' ? src.y : src.y + src.height / 2,
  };
  const end = tb
    ? { x: dst.x + dst.width / 2, y: start.y < dst.y ? dst.y : dst.y + dst.height }
    : { x: start.x < dst.x ? dst.x : dst.x + dst.width, y: dst.y + dst.height / 2 };
  const corner = tb ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
  const hits = (p: { x: number; y: number }, q: { x: number; y: number }, b: BoxedElement) =>
    Math.max(p.x, q.x) > b.x &&
    Math.min(p.x, q.x) < b.x + b.width &&
    Math.max(p.y, q.y) > b.y &&
    Math.min(p.y, q.y) < b.y + b.height;
  return !solid.some(
    (b) => b.id !== src.id && b.id !== dst.id && (hits(start, corner, b) || hits(corner, end, b)),
  );
}
