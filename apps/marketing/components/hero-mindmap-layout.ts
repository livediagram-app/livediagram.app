// Where the hero's Mind map scene puts everything (components/hero-mindmap-board.tsx): the launch
// plan's four branches and their ideas, laid out wide for the landscape window and tall for a
// phone's portrait one, and the curves that join them. Pure geometry, so it is tested on its own.

import type { Point } from '@/lib/hero-motion';

export type Side = 'left' | 'right';

// A branch's colours, as the editor's mind map paints a branch: its stroke, its node's tint and its
// label's ink, each with the shade the dark canvas takes.
export type BranchTone = {
  stroke: string;
  strokeDark: string;
  tint: string;
  tintDark: string;
  ink: string;
  inkDark: string;
};

export type Leaf = { text: string; d: number };

export type Branch = {
  key: 'marketing' | 'product' | 'support' | 'events';
  label: string;
  tone: BranchTone;
  // When the branch's node lands; its trunk starts drawing just before.
  d: number;
  leaves: Leaf[];
};

export type Box = { x: number; y: number; w: number; h: number };

export type PlacedLeaf = Leaf & { box: Box; link: string; linkLen: number };

export type PlacedBranch = Omit<Branch, 'leaves'> & {
  side: Side;
  node: Box;
  trunk: { centre: string; fill: string; len: number };
  leaves: PlacedLeaf[];
};

export type MindMapLayout = {
  centre: { x: number; y: number; r: number };
  branches: PlacedBranch[];
  hint: { x: number; y: number };
  // The teammate's cursor: in from the edge, onto the Events node, then each idea as it is added.
  teammate: Point[];
};

const PINK: BranchTone = {
  stroke: '#ec4899',
  strokeDark: '#f472b6',
  tint: '#fdf2f8',
  tintDark: '#2a1523',
  ink: '#9d174d',
  inkDark: '#fbcfe8',
};
const VIOLET: BranchTone = {
  stroke: '#8b5cf6',
  strokeDark: '#a78bfa',
  tint: '#f5f3ff',
  tintDark: '#1e1a33',
  ink: '#5b21b6',
  inkDark: '#ddd6fe',
};
const EMERALD: BranchTone = {
  stroke: '#10b981',
  strokeDark: '#34d399',
  tint: '#ecfdf5',
  tintDark: '#0f2620',
  ink: '#065f46',
  inkDark: '#a7f3d0',
};
const AMBER: BranchTone = {
  stroke: '#f59e0b',
  strokeDark: '#fbbf24',
  tint: '#fffbeb',
  tintDark: '#2a2110',
  ink: '#92400e',
  inkDark: '#fde68a',
};

// In the order their nodes land. You fill Marketing (Tab, then Enter, Enter), then Product and
// Support; the teammate fills Events at the same time.
export const BRANCHES: Branch[] = [
  {
    key: 'marketing',
    label: 'Marketing',
    tone: PINK,
    d: 1.0,
    leaves: [
      { text: 'Teaser video', d: 3.2 },
      { text: 'Press kit', d: 3.8 },
      { text: 'Launch email', d: 4.4 },
    ],
  },
  {
    key: 'product',
    label: 'Product',
    tone: VIOLET,
    d: 1.4,
    leaves: [
      { text: 'Beta invites', d: 5.4 },
      { text: 'Pricing page', d: 6.0 },
      { text: 'Changelog', d: 6.6 },
    ],
  },
  {
    key: 'support',
    label: 'Support',
    tone: EMERALD,
    d: 1.8,
    leaves: [
      { text: 'Help articles', d: 7.3 },
      { text: 'Live chat', d: 7.9 },
    ],
  },
  {
    key: 'events',
    label: 'Events',
    tone: AMBER,
    d: 2.2,
    leaves: [
      { text: 'Launch party', d: 5.0 },
      { text: 'Webinar', d: 6.3 },
    ],
  },
];

// Type metrics at the scene's sizes: about how wide a character sets, so boxes hug their words.
const LEAF_CHAR = 5.45;
const NODE_CHAR = 7.1;
export const LEAF_H = 22;
export const NODE_H = 34;
// A node's glyph and the gap after it.
export const NODE_GLYPH = 13;
const NODE_GAP = 5;
const NODE_PAD = 15;
const LEAF_PAD = 10;

export const leafWidth = (text: string) => Math.round(text.length * LEAF_CHAR + LEAF_PAD * 2);
export const nodeWidth = (label: string) =>
  Math.round(NODE_GLYPH + NODE_GAP + label.length * NODE_CHAR + NODE_PAD * 2);

// A curve between two points that leaves and arrives level, as a mind map draws its links.
function levelCurve(a: Point, b: Point): string {
  const mx = (a[0] + b[0]) / 2;
  return `M${a[0]} ${a[1]} C${mx} ${a[1]}, ${mx} ${b[1]}, ${b[0]} ${b[1]}`;
}

// A curve that leaves and arrives upright (a phone's tall map).
function uprightCurve(a: Point, b: Point): string {
  const my = (a[1] + b[1]) / 2;
  return `M${a[0]} ${a[1]} C${a[0]} ${my}, ${b[0]} ${my}, ${b[0]} ${b[1]}`;
}

// A trunk tapering from `w0` wide at the centre to `w1` at the branch: two level curves offset
// either side of the centre line, closed into a shape. Both ends are level, so offsetting along y
// is offsetting along the normal there.
function taperedLevel(a: Point, b: Point, w0: number, w1: number): string {
  const mx = (a[0] + b[0]) / 2;
  const h0 = w0 / 2;
  const h1 = w1 / 2;
  const hm = (h0 + h1) / 2;
  return (
    `M${a[0]} ${a[1] - h0} C${mx} ${a[1] - hm}, ${mx} ${b[1] - hm}, ${b[0]} ${b[1] - h1}` +
    ` L${b[0]} ${b[1] + h1} C${mx} ${b[1] + hm}, ${mx} ${a[1] + hm}, ${a[0]} ${a[1] + h0} Z`
  );
}

// The same taper for an upright trunk, offset along x.
function taperedUpright(a: Point, b: Point, w0: number, w1: number): string {
  const my = (a[1] + b[1]) / 2;
  const h0 = w0 / 2;
  const h1 = w1 / 2;
  const hm = (h0 + h1) / 2;
  return (
    `M${a[0] - h0} ${a[1]} C${a[0] - hm} ${my}, ${b[0] - hm} ${my}, ${b[0] - h1} ${b[1]}` +
    ` L${b[0] + h1} ${b[1]} C${b[0] + hm} ${my}, ${a[0] + hm} ${my}, ${a[0] + h0} ${a[1]} Z`
  );
}

const len = (a: Point, b: Point) => Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.25);

const TRUNK_ROOT = 7;
const TRUNK_TIP = 2.5;

// The wide window: the centre in the middle, Marketing and Events to its left, Product and Support
// to its right, each branch's ideas stacked on its outer side.
const WIDE_CENTRE = { x: 300, y: 128, r: 56 };
const WIDE_NODE: Record<Branch['key'], { x: number; y: number; side: Side }> = {
  marketing: { x: 176, y: 8, side: 'left' },
  product: { x: 424, y: 8, side: 'right' },
  support: { x: 424, y: 248, side: 'right' },
  events: { x: 176, y: 248, side: 'left' },
};
// The ideas' inner edge: right of the left-hand column, left of the right-hand one.
const WIDE_LEAF_EDGE = { left: 98, right: 502 };
const WIDE_LEAF_STEP = 34;

function wide(): MindMapLayout {
  const c = WIDE_CENTRE;
  const branches = BRANCHES.map((b): PlacedBranch => {
    const at = WIDE_NODE[b.key];
    const w = nodeWidth(b.label);
    const node = { x: at.x - w / 2, y: at.y - NODE_H / 2, w, h: NODE_H };
    // The trunk leaves the centre's rim towards the node and lands on the node's inner side.
    const angle = Math.atan2(at.y - c.y, at.x - c.x);
    const from: Point = [c.x + Math.cos(angle) * (c.r - 2), c.y + Math.sin(angle) * (c.r - 2)];
    const to: Point = [at.side === 'left' ? node.x + node.w : node.x, at.y];
    const outer = at.side === 'left' ? node.x : node.x + node.w;
    const leaves = b.leaves.map((leaf, i): PlacedLeaf => {
      const lw = leafWidth(leaf.text);
      const ly = at.y + (i - (b.leaves.length - 1) / 2) * WIDE_LEAF_STEP;
      const edge = WIDE_LEAF_EDGE[at.side];
      const box = {
        x: at.side === 'left' ? edge - lw : edge,
        y: ly - LEAF_H / 2,
        w: lw,
        h: LEAF_H,
      };
      const a: Point = [outer, at.y];
      const z: Point = [edge, ly];
      return { ...leaf, box, link: levelCurve(a, z), linkLen: len(a, z) + 10 };
    });
    return {
      ...b,
      side: at.side,
      node,
      trunk: {
        centre: levelCurve(from, to),
        fill: taperedLevel(from, to, TRUNK_ROOT, TRUNK_TIP),
        len: len(from, to) + 20,
      },
      leaves,
    };
  });
  const events = branches.find((b) => b.key === 'events')!;
  return {
    centre: c,
    branches,
    hint: { x: 300, y: 320 },
    teammate: [
      [-10, 340],
      [events.node.x + events.node.w / 2, events.node.y + NODE_H - 4],
      ...events.leaves.map((l): Point => [l.box.x + l.box.w / 2, l.box.y + LEAF_H - 3]),
    ],
  };
}

// A phone: the centre in the middle, two branches above it and two below, each branch's ideas
// stacked away from the centre and joined from the node's outer side, so no link crosses a word.
const TALL_CENTRE = { x: 180, y: 226, r: 44 };
const TALL_NODE: Record<Branch['key'], { x: number; y: number; side: Side }> = {
  marketing: { x: 92, y: 118, side: 'left' },
  product: { x: 268, y: 118, side: 'right' },
  support: { x: 268, y: 336, side: 'right' },
  events: { x: 92, y: 336, side: 'left' },
};
const TALL_LEAF_STEP = 31;

function tall(): MindMapLayout {
  const c = TALL_CENTRE;
  const branches = BRANCHES.map((b): PlacedBranch => {
    const at = TALL_NODE[b.key];
    const w = nodeWidth(b.label);
    const node = { x: at.x - w / 2, y: at.y - NODE_H / 2, w, h: NODE_H };
    const up = at.y < c.y;
    const from: Point = [c.x + (at.x < c.x ? -22 : 22), c.y + (up ? -c.r + 6 : c.r - 6)];
    const to: Point = [at.x, up ? node.y + node.h : node.y];
    // Each idea's link leaves the node's outer side and runs down (or up) a spine beside the stack.
    const outerX = at.side === 'left' ? node.x : node.x + node.w;
    const spine = outerX + (at.side === 'left' ? -10 : 10);
    const leaves = b.leaves.map((leaf, i): PlacedLeaf => {
      const lw = leafWidth(leaf.text);
      const ly = up ? node.y - 22 - i * TALL_LEAF_STEP : node.y + node.h + 22 + i * TALL_LEAF_STEP;
      const box = {
        x: at.side === 'left' ? spine + 8 : spine - 8 - lw,
        y: ly - LEAF_H / 2,
        w: lw,
        h: LEAF_H,
      };
      const end = at.side === 'left' ? box.x : box.x + box.w;
      const link = `M${outerX} ${at.y} C${spine} ${at.y}, ${spine} ${at.y}, ${spine} ${
        at.y + (ly - at.y) / 2
      } S${spine} ${ly}, ${end} ${ly}`;
      return { ...leaf, box, link, linkLen: Math.round(Math.abs(ly - at.y) + 40) };
    });
    return {
      ...b,
      side: at.side,
      node,
      trunk: {
        centre: uprightCurve(from, to),
        fill: taperedUpright(from, to, TRUNK_ROOT, TRUNK_TIP),
        len: len(from, to) + 20,
      },
      leaves,
    };
  });
  const events = branches.find((b) => b.key === 'events')!;
  return {
    centre: c,
    branches,
    hint: { x: 180, y: 468 },
    teammate: [
      [340, 480],
      [events.node.x + events.node.w / 2, events.node.y + NODE_H - 4],
      ...events.leaves.map((l): Point => [l.box.x + l.box.w / 2, l.box.y + LEAF_H - 3]),
    ],
  };
}

export const WIDE_LAYOUT = wide();
export const TALL_LAYOUT = tall();
