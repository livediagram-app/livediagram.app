// How graph input's lines leave and join their boxes (docs/specs/015-api/mcp-server.md §4.7 "The graph look"): which
// arrows meet in one trunk or bus, and which of a step's exits leave by another side.

import { isBoxed, type Anchor, type ArrowElement, type BoxedElement, type Element } from './index';

const pinned = (end: ArrowElement['from']) => (end.kind === 'pinned' ? end.elementId : null);

// The line an arrow is drawn with, an unset stroke being solid.
const line = (a: ArrowElement) => a.strokeStyle ?? 'solid';
// What an arrow says, for telling apart arrows that would share a trunk: its label and its line.
const saying = (a: ArrowElement) => `${a.label?.trim().toLowerCase() ?? ''}|${line(a)}`;

// Arrows leaving one node share one trunk, and arrows into one node one bus, the org-chart shape: each end sits exactly
// on its anchor, so siblings' bends at the same height merge into one line. Only lines drawn alike merge: where solid
// and dashed meet at one end of a node, the style most of the mergeable ones have (solid on a tie) shares it and the
// rest keep their own ends, so a dashed event line never rides a solid call's trunk. A labelled arrow keeps its own
// ends, as a label on a shared line could not say which line it names, unless the arrows meeting there all say the
// same thing in the same line (services that each "publish" to one bus): those merge, and each label sits on its own
// leg; so does the one labelled arrow among unlabelled ones into one node in its line, which names the bus. A decision's
// labelled exits never merge so: each names its own decision's branch. A labelled arrow that
// can never merge does not count toward the style that shares.
export function withExactEnds(elements: Element[]): Element[] {
  const arrows = elements.filter((el): el is ArrowElement => el.type === 'arrow');
  const said = new Map<string, number>();
  const styles = new Map<string, Map<string, number>>();
  const at = (side: 'from' | 'to', a: ArrowElement) => `${side}:${pinned(a[side])}`;
  const sayingAt = (side: 'from' | 'to', a: ArrowElement) => `${at(side, a)}:${saying(a)}`;
  for (const a of arrows)
    for (const side of ['from', 'to'] as const)
      if (a.label?.trim()) said.set(sayingAt(side, a), (said.get(sayingAt(side, a)) ?? 0) + 1);
  // A decision's exit label names its own decision's branch: two decisions' "no" merged into one bus could not say
  // which was which (lanes' two rejections, one trunk), so a labelled exit out of a decision keeps its own ends.
  const shapeOf = new Map(
    elements.filter(isBoxed).map((b) => [b.id, (b as { shape?: string }).shape]),
  );
  const fromDecision = (a: ArrowElement) => {
    const id = pinned(a.from);
    return id !== null && shapeOf.get(id) === 'diamond';
  };
  // Into one node in one line: how many arrows, and how many of them labelled. The one labelled among unlabelled
  // ones names the bus (an agent saying "publish" once), so it merges too.
  const into = new Map<string, { all: number; labelled: number }>();
  for (const a of arrows) {
    const key = `${at('to', a)}|${line(a)}`;
    const n = into.get(key) ?? { all: 0, labelled: 0 };
    n.all += 1;
    if (a.label?.trim()) n.labelled += 1;
    into.set(key, n);
  }
  const namesBus = (side: 'from' | 'to', a: ArrowElement) => {
    const n = into.get(`${at('to', a)}|${line(a)}`)!;
    return side === 'to' && n.labelled === 1 && n.all > 1;
  };
  const mergeable = (side: 'from' | 'to', a: ArrowElement) =>
    !a.label?.trim() ||
    (!fromDecision(a) && ((said.get(sayingAt(side, a)) ?? 0) > 1 || namesBus(side, a)));
  for (const a of arrows)
    for (const side of ['from', 'to'] as const) {
      if (!mergeable(side, a)) continue;
      const m = styles.get(at(side, a)) ?? styles.set(at(side, a), new Map()).get(at(side, a))!;
      m.set(line(a), (m.get(line(a)) ?? 0) + 1);
    }
  const dominant = (key: string) =>
    [...styles.get(key)!].sort(
      ([p, n], [q, k]) => k - n || (p === 'solid' ? -1 : q === 'solid' ? 1 : p < q ? -1 : 1),
    )[0]![0];
  const exact = (side: 'from' | 'to', a: ArrowElement) =>
    mergeable(side, a) && line(a) === dominant(at(side, a));
  const merged = elements.map((el) => {
    if (el.type !== 'arrow') return el;
    const [start, end] = [exact('from', el), exact('to', el)];
    if (!start && !end) return el;
    return { ...el, ...(start ? { exactStart: true } : {}), ...(end ? { exactEnd: true } : {}) };
  });
  return besideTrunks(merged);
}

// A side's quarters, the one before its middle and the one after (left to right, top to bottom).
const QUARTERS: Partial<Record<Anchor, readonly [Anchor, Anchor]>> = {
  n: ['nnw', 'nne'],
  s: ['ssw', 'sse'],
  e: ['ene', 'ese'],
  w: ['wnw', 'wsw'],
};

// An end that keeps its own place where a trunk or bus sits exactly on the same middle anchor would leave from the
// trunk's very point (it fans only among the ends that fan) and ride it: it moves to that side's quarter toward its
// other end, beside the trunk, unless that other end lies straight ahead.
function besideTrunks(elements: Element[]): Element[] {
  const boxes = new Map(elements.filter(isBoxed).map((b) => [b.id, b] as const));
  const trunks = new Set<string>();
  for (const el of elements)
    if (el.type === 'arrow')
      for (const [side, isExact] of [
        ['from', el.exactStart],
        ['to', el.exactEnd],
      ] as const) {
        const end = el[side];
        if (isExact && end.kind === 'pinned') trunks.add(`${end.elementId}:${end.anchor}`);
      }
  if (trunks.size === 0) return elements;
  const centre = (id: string | null) => {
    const b = id ? boxes.get(id) : undefined;
    return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
  };
  return elements.map((el) => {
    if (el.type !== 'arrow') return el;
    let next = el;
    for (const [side, isExact] of [
      ['from', el.exactStart],
      ['to', el.exactEnd],
    ] as const) {
      const end = el[side];
      if (isExact || end.kind !== 'pinned' || !trunks.has(`${end.elementId}:${end.anchor}`))
        continue;
      const quarters = QUARTERS[end.anchor];
      const here = centre(end.elementId);
      const there = centre(pinned(el[side === 'from' ? 'to' : 'from']));
      if (!quarters || !here || !there) continue;
      const level = end.anchor === 'n' || end.anchor === 's';
      const along = level ? there.x - here.x : there.y - here.y;
      // Its other end straight ahead: it runs straight, left where it is.
      if (Math.abs(along) < 1) continue;
      next = { ...next, [side]: { ...end, anchor: quarters[along < 0 ? 0 : 1] } };
    }
    return next;
  });
}

// How far beyond a step's own edge its next step must lie for an exit to leave that side: nearer, the line would turn
// back on itself.
export const BRANCH_CLEAR = 24;

type BranchOptions = {
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
  const boxes = new Map(elements.filter(isBoxed).map((b) => [b.id, b] as const));
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
    // Two exits whose next steps lie clearly either side, neither ahead, both leave by their sides: kept, one left by
    // the point and the other by a corner, lopsided (a decision's accept up, decline straight on).
    const clearly = (a: ArrowElement) => Math.abs(off(a)) > half + BRANCH_CLEAR;
    const split =
      exits.length === 2 &&
      exits.every(clearly) &&
      Math.sign(off(exits[0]!)) !== Math.sign(off(exits[1]!));
    let onPoint = exits.length;
    for (const a of [...exits].sort((p, q) => Math.abs(off(q)) - Math.abs(off(p)))) {
      if (onPoint < 2 && !split) break;
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
