// The picker's preview (liveworkspace/docs/specs/004-index/send-to-diagram.md "The preview"): the drafted graph laid out
// roughly, so the person sees what the AI read before anything is written. livediagram lays the real diagram out; this
// only places boxes. Layered for a flow or a tree (each box one layer past its furthest parent), rings for a mind map,
// lifelines for a sequence. Pure, and linear in boxes and arrows (a graph holds at most 60 and 120).
import type { DiagramSendGraph, DiagramSendShape } from '@liveworkspace/index-client';

export const SKETCH_BOX_W = 132;
export const SKETCH_BOX_H = 40;
const GAP_ALONG = 56;
const GAP_ALONG_ACROSS = 96;
const GAP_ACROSS = 24;
const PAD = 16;
const RING = 170;
const MESSAGE_ROW = 40;

export type SketchBox = {
  id: string;
  label: string;
  x: number;
  y: number;
  shape?: DiagramSendShape;
};
export type SketchLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed: boolean;
  label?: string;
};
export type SketchFrame = { label: string; x: number; y: number; w: number; h: number };
export type Sketch = {
  width: number;
  height: number;
  boxes: SketchBox[];
  lines: SketchLine[];
  frames: SketchFrame[];
  // A sequence's lifelines, from under each box to the foot.
  lifelines: SketchLine[];
};

const centre = (b: SketchBox) => ({ x: b.x + SKETCH_BOX_W / 2, y: b.y + SKETCH_BOX_H / 2 });

// Where the line from `a`'s centre towards `b`'s leaves `a`'s box.
function edgePoint(a: SketchBox, b: SketchBox): { x: number; y: number } {
  const ca = centre(a);
  const cb = centre(b);
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  if (dx === 0 && dy === 0) return ca;
  const sx = dx === 0 ? Infinity : SKETCH_BOX_W / 2 / Math.abs(dx);
  const sy = dy === 0 ? Infinity : SKETCH_BOX_H / 2 / Math.abs(dy);
  const s = Math.min(sx, sy);
  return { x: ca.x + dx * s, y: ca.y + dy * s };
}

// Each node's layer: one past its furthest parent, cycles broken where a depth-first walk meets them.
function layers(graph: DiagramSendGraph): Map<string, number> {
  const out = new Map<string, string[]>();
  for (const n of graph.nodes) out.set(n.id, []);
  for (const e of graph.edges) out.get(e.from)?.push(e.to);
  // A topological order over the edges a depth-first walk keeps (back edges dropped), iteratively.
  const state = new Map<string, 1 | 2>();
  const order: string[] = [];
  const kept = new Map<string, string[]>();
  for (const root of graph.nodes) {
    if (state.has(root.id)) continue;
    const stack: { id: string; i: number }[] = [{ id: root.id, i: 0 }];
    state.set(root.id, 1);
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const next = out.get(top.id)![top.i++];
      if (next === undefined) {
        state.set(top.id, 2);
        order.push(top.id);
        stack.pop();
        continue;
      }
      if (state.get(next) === 1) continue;
      const list = kept.get(top.id);
      if (list) list.push(next);
      else kept.set(top.id, [next]);
      if (!state.has(next)) {
        state.set(next, 1);
        stack.push({ id: next, i: 0 });
      }
    }
  }
  const layer = new Map<string, number>();
  for (const n of graph.nodes) layer.set(n.id, 0);
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]!;
    const at = layer.get(id)!;
    for (const to of kept.get(id) ?? []) if (layer.get(to)! < at + 1) layer.set(to, at + 1);
  }
  return layer;
}

function layered(graph: DiagramSendGraph, across: boolean): SketchBox[] {
  const layer = layers(graph);
  const slot = new Map<number, number>();
  return graph.nodes.map((n) => {
    const l = layer.get(n.id) ?? 0;
    const i = slot.get(l) ?? 0;
    slot.set(l, i + 1);
    // Across, an arrow's label sits in the gap between layers: room for it there.
    const along = l * (across ? SKETCH_BOX_W + GAP_ALONG_ACROSS : SKETCH_BOX_H + GAP_ALONG);
    const side = i * ((across ? SKETCH_BOX_H : SKETCH_BOX_W) + GAP_ACROSS);
    return {
      id: n.id,
      label: n.label,
      x: across ? along : side,
      y: across ? side : along,
      ...(n.shape ? { shape: n.shape } : {}),
    };
  });
}

// The root (the box with the most arrows), its tree breadth first, each ring a level out, each box in the middle of
// the angle its leaves take.
function rings(graph: DiagramSendGraph): SketchBox[] {
  const degree = new Map<string, number>();
  const near = new Map<string, string[]>();
  for (const n of graph.nodes) near.set(n.id, []);
  for (const e of graph.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
    near.get(e.from)?.push(e.to);
    near.get(e.to)?.push(e.from);
  }
  let root = graph.nodes[0]!.id;
  for (const n of graph.nodes) if ((degree.get(n.id) ?? 0) > (degree.get(root) ?? 0)) root = n.id;
  const children = new Map<string, string[]>();
  const depth = new Map<string, number>([[root, 0]]);
  const queue = [root];
  for (let q = 0; q < queue.length; q++) {
    const id = queue[q]!;
    for (const to of near.get(id) ?? []) {
      if (depth.has(to)) continue;
      depth.set(to, depth.get(id)! + 1);
      children.set(id, [...(children.get(id) ?? []), to]);
      queue.push(to);
    }
  }
  // Boxes no arrow reaches hang off the root.
  for (const n of graph.nodes)
    if (!depth.has(n.id)) {
      depth.set(n.id, 1);
      children.set(root, [...(children.get(root) ?? []), n.id]);
      queue.push(n.id);
    }
  const leaves = new Map<string, number>();
  for (let q = queue.length - 1; q >= 0; q--) {
    const id = queue[q]!;
    const kids = children.get(id) ?? [];
    leaves.set(id, kids.length === 0 ? 1 : kids.reduce((s, k) => s + leaves.get(k)!, 0));
  }
  const angle = new Map<string, number>();
  const place = (id: string, from: number, span: number) => {
    angle.set(id, from + span / 2);
    let at = from;
    for (const k of children.get(id) ?? []) {
      const share = (span * leaves.get(k)!) / leaves.get(id)!;
      place(k, at, share);
      at += share;
    }
  };
  place(root, 0, Math.PI * 2);
  const label = new Map(graph.nodes.map((n) => [n.id, n] as const));
  return queue.map((id) => {
    const r = depth.get(id)! * RING;
    const a = angle.get(id)!;
    const n = label.get(id)!;
    return {
      id,
      label: n.label,
      x: Math.cos(a) * r * 1.3 - SKETCH_BOX_W / 2,
      y: Math.sin(a) * r * 0.8 - SKETCH_BOX_H / 2,
      ...(n.shape ? { shape: n.shape } : {}),
    };
  });
}

// Moves every box so the drawing starts at PAD, and answers its size.
function framed(boxes: SketchBox[]): { width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + SKETCH_BOX_W);
    maxY = Math.max(maxY, b.y + SKETCH_BOX_H);
  }
  for (const b of boxes) {
    b.x += PAD - minX;
    b.y += PAD - minY;
  }
  return { width: maxX - minX + PAD * 2, height: maxY - minY + PAD * 2 };
}

function sequence(graph: DiagramSendGraph): Sketch {
  const boxes: SketchBox[] = graph.nodes.map((n, i) => ({
    id: n.id,
    label: n.label,
    x: PAD + i * (SKETCH_BOX_W + GAP_ACROSS),
    y: PAD,
  }));
  const at = new Map(boxes.map((b) => [b.id, b] as const));
  const top = PAD + SKETCH_BOX_H;
  const lines = graph.edges.flatMap((e, k) => {
    const a = at.get(e.from);
    const b = at.get(e.to);
    if (!a || !b) return [];
    const y = top + MESSAGE_ROW * (k + 1);
    return [
      {
        x1: centre(a).x,
        y1: y,
        x2: centre(b).x,
        y2: y,
        dashed: e.line === 'dashed',
        ...(e.label ? { label: e.label } : {}),
      },
    ];
  });
  const height = top + MESSAGE_ROW * (graph.edges.length + 1) + PAD;
  const lifelines = boxes.map((b) => ({
    x1: centre(b).x,
    y1: top,
    x2: centre(b).x,
    y2: height - PAD,
    dashed: true,
  }));
  return {
    width: PAD * 2 + boxes.length * (SKETCH_BOX_W + GAP_ACROSS) - GAP_ACROSS,
    height,
    boxes,
    lines,
    frames: [],
    lifelines,
  };
}

// How much of a frame of this width-to-height ratio a sketch of width by height fills, scaled to fit it.
const fill = (w: number, h: number, ratio: number) => Math.min(ratio / (w / h), w / h / ratio);

/** The graph's sketch, in its own units (the SVG scales it to fit). With `fit` (the preview's width over its height),
 *  a layered graph is laid down or across, whichever fills that frame more, so a long flow stays readable; livediagram
 *  still draws it in the graph's own direction. */
export function sketchGraph(graph: DiagramSendGraph, fit?: number): Sketch {
  if (graph.style === 'sequence') return sequence(graph);
  let boxes: SketchBox[];
  if (graph.style === 'mindmap') boxes = rings(graph);
  else {
    boxes = layered(graph, graph.direction === 'right');
    if (fit) {
      const other = layered(graph, graph.direction !== 'right');
      const a = framed(boxes);
      const b = framed(other);
      if (fill(b.width, b.height, fit) > fill(a.width, a.height, fit)) boxes = other;
    }
  }
  const { width, height } = framed(boxes);
  const at = new Map(boxes.map((b) => [b.id, b] as const));
  const lines = graph.edges.flatMap((e) => {
    const a = at.get(e.from);
    const b = at.get(e.to);
    if (!a || !b) return [];
    const p = edgePoint(a, b);
    const q = edgePoint(b, a);
    return [
      {
        x1: p.x,
        y1: p.y,
        x2: q.x,
        y2: q.y,
        dashed: e.line === 'dashed',
        ...(e.label ? { label: e.label } : {}),
      },
    ];
  });
  const frames: SketchFrame[] = [];
  for (const g of graph.groups ?? []) {
    const members = graph.nodes.filter((n) => n.group === g.id).map((n) => at.get(n.id)!);
    if (members.length === 0) continue;
    const x = Math.min(...members.map((b) => b.x)) - 8;
    const y = Math.min(...members.map((b) => b.y)) - 8;
    const w = Math.max(...members.map((b) => b.x + SKETCH_BOX_W)) + 8 - x;
    const h = Math.max(...members.map((b) => b.y + SKETCH_BOX_H)) + 8 - y;
    frames.push({ label: g.label, x, y, w, h });
  }
  return { width, height, boxes, lines, frames, lifelines: [] };
}
