// The Sankey diagram's layout (docs/specs/009-elements/sankey.md "Layout"): columns, node heights, band
// stacking and band paths, for both the canvas view and the exporter, so the two never draw a different
// diagram. Pure and deterministic: the same flows in the same box always lay out to the same numbers.
//
// The method is the one every Sankey tool since d3-sankey has used, written out here rather than imported
// so the headless renderer and another program's script need nothing more than this package:
//   1. columns by step (longest path from a start node), end nodes pushed right when justified;
//   2. one scale for the whole diagram, the largest that fits the fullest column;
//   3. nodes start stacked by size, then relax toward the weighted middle of what they connect to, a few
//      sweeps each way, resolving overlaps after every sweep;
//   4. each node's bands stack in the order of the node at their other end, so bands cross as little as
//      the columns allow.

import type { ChartRect } from './chart-frame';
import {
  sankeyGraph,
  type SankeyAlign,
  type SankeyFlow,
  type SankeyGraph,
  type SankeySkipReason,
} from './sankey-model';

// Geometry constants (docs/specs/009-elements/blueprints/sankey.md "Constants").
const SANKEY_NODE_WIDTH_PX = 12; // a node's bar, wide enough to hover, narrow enough to read as a post
const SANKEY_NODE_MIN_WIDTH_PX = 6;
const SANKEY_NODE_PAD_MAX_PX = 18; // vertical gap between nodes in a column, at most
const SANKEY_NODE_PAD_MIN_PX = 4;
const SANKEY_RELAX_SWEEPS = 6; // d3-sankey's default; more moves nothing visible
const SANKEY_MIN_BAND_PX = 1; // a real flow never vanishes, however small next to the rest

export type SankeyNodeBox = {
  index: number;
  name: string;
  column: number;
  value: number;
  inflow: number;
  outflow: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

export type SankeyLinkBand = {
  /** The flow's position in `sankeyFlows`. */
  flow: number;
  source: number;
  target: number;
  value: number;
  /** Band thickness. */
  width: number;
  /** Middle of the band where it leaves the source and where it reaches the target. */
  y0: number;
  y1: number;
  x0: number;
  x1: number;
  /** The closed band outline: two cubic curves joined by the node edges. */
  path: string;
  /** The band's middle line, source to target: what the Flow animation runs along. */
  centre: string;
};

export type SankeyLayout = {
  nodes: SankeyNodeBox[];
  links: SankeyLinkBand[];
  skipped: { flow: number; reason: SankeySkipReason }[];
  columns: number;
  /** Total leaving the start nodes: the "whole" a percentage label is a share of. */
  total: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The closed outline of a band from (x0, y0) to (x1, y1), `w` thick, curving at the horizontal middle. */
export function sankeyBandPath(x0: number, y0: number, x1: number, y1: number, w: number): string {
  const xm = (x0 + x1) / 2;
  const h = w / 2;
  return (
    `M${r2(x0)},${r2(y0 - h)}` +
    `C${r2(xm)},${r2(y0 - h)} ${r2(xm)},${r2(y1 - h)} ${r2(x1)},${r2(y1 - h)}` +
    `L${r2(x1)},${r2(y1 + h)}` +
    `C${r2(xm)},${r2(y1 + h)} ${r2(xm)},${r2(y0 + h)} ${r2(x0)},${r2(y0 + h)}Z`
  );
}

/** The middle line of a band from (x0, y0) to (x1, y1), with the same curve as its outline. */
function sankeyCentrePath(x0: number, y0: number, x1: number, y1: number): string {
  const xm = (x0 + x1) / 2;
  return `M${r2(x0)},${r2(y0)}C${r2(xm)},${r2(y0)} ${r2(xm)},${r2(y1)} ${r2(x1)},${r2(y1)}`;
}

/**
 * Each node's column, by graph node index: its step from a start node (longest path), end nodes pushed right
 * when justified. The Flows dialog groups its rows by the `'left'` steps, so they read as the diagram does.
 */
export function sankeyColumns(graph: SankeyGraph, align: SankeyAlign): number[] {
  const n = graph.nodes.length;
  const depth = new Array<number>(n).fill(0);
  const indeg = new Array<number>(n).fill(0);
  const out: number[][] = graph.nodes.map(() => []);
  for (const l of graph.links) {
    indeg[l.target]!++;
    out[l.source]!.push(l.target);
  }
  // Kahn's order: the graph is acyclic (sankeyGraph set loops aside), so every node is reached.
  const queue: number[] = [];
  for (let i = 0; i < n; i++) if (indeg[i] === 0) queue.push(i);
  for (let q = 0; q < queue.length; q++) {
    const u = queue[q]!;
    for (const v of out[u]!) {
      depth[v] = Math.max(depth[v]!, depth[u]! + 1);
      if (--indeg[v]! === 0) queue.push(v);
    }
  }
  if (align === 'left') return depth;
  const last = Math.max(0, ...depth);
  return depth.map((d, i) => (out[i]!.length === 0 ? last : d));
}

/**
 * Lays flows out in `area`. Labels need no room kept outside it: every label faces inward (sankeyLabelSide),
 * over the bands, so the columns can spread edge to edge.
 */
export function sankeyLayout(
  flows: readonly SankeyFlow[] | undefined,
  area: ChartRect,
  align: SankeyAlign = 'justify',
): SankeyLayout {
  const graph = sankeyGraph(flows);
  const { nodes: gnodes, links: glinks } = graph;
  if (gnodes.length === 0)
    return { nodes: [], links: [], skipped: graph.skipped, columns: 0, total: 0 };

  const col = sankeyColumns(graph, align);
  const columns = Math.max(...col) + 1;
  const nodeW = Math.max(
    SANKEY_NODE_MIN_WIDTH_PX,
    Math.min(SANKEY_NODE_WIDTH_PX, area.w / Math.max(4, columns * 6)),
  );
  const step = columns > 1 ? (area.w - nodeW) / (columns - 1) : 0;
  const xOf = (c: number) => (columns > 1 ? area.x + c * step : area.x + (area.w - nodeW) / 2);

  const byCol: number[][] = Array.from({ length: columns }, () => []);
  gnodes.forEach((_, i) => byCol[col[i]!]!.push(i));
  const value = gnodes.map((g) => Math.max(g.inflow, g.outflow));

  // Padding shrinks for a crowded column so the nodes keep most of the height.
  const fullest = Math.max(...byCol.map((c) => c.length));
  const pad =
    fullest > 1
      ? Math.max(
          SANKEY_NODE_PAD_MIN_PX,
          Math.min(SANKEY_NODE_PAD_MAX_PX, (area.h * 0.3) / (fullest - 1)),
        )
      : 0;
  // One scale for every column: the largest at which the fullest column (by value plus its gaps) fits.
  let ky = Infinity;
  for (const c of byCol) {
    const sum = c.reduce((s, i) => s + value[i]!, 0);
    if (sum > 0) ky = Math.min(ky, (area.h - (c.length - 1) * pad) / sum);
  }
  if (!Number.isFinite(ky) || ky <= 0) ky = 0;

  const y0 = new Array<number>(gnodes.length).fill(0);
  const hOf = (i: number) => Math.max(SANKEY_MIN_BAND_PX, value[i]! * ky);

  // Start: each column stacked in the order its nodes were first written, centred. The author's order is
  // the best first guess at theirs, and the sweeps below move it from there.
  for (const c of byCol) {
    c.sort((a, b) => a - b);
    const used = c.reduce((s, i) => s + hOf(i), 0) + (c.length - 1) * pad;
    let y = area.y + (area.h - used) / 2;
    for (const i of c) {
      y0[i] = y;
      y += hOf(i) + pad;
    }
  }

  const incoming: number[][] = gnodes.map(() => []);
  const outgoing: number[][] = gnodes.map(() => []);
  glinks.forEach((l, li) => {
    outgoing[l.source]!.push(li);
    incoming[l.target]!.push(li);
  });
  const bandW = glinks.map((l) => Math.max(SANKEY_MIN_BAND_PX, l.value * ky));
  // Keep each node's bands in the order of the nodes at their other end, as they will be drawn.
  const sortBands = (i: number) => {
    outgoing[i]!.sort((a, b) => y0[glinks[a]!.target]! - y0[glinks[b]!.target]! || a - b);
    incoming[i]!.sort((a, b) => y0[glinks[a]!.source]! - y0[glinks[b]!.source]! || a - b);
  };
  // How far down its node's side a band starts: the widths of the bands stacked above it.
  const offsetIn = (list: number[], li: number) => {
    let off = 0;
    for (const other of list) {
      if (other === li) break;
      off += bandW[other]!;
    }
    return off;
  };

  // Push overlapping nodes apart: down from the top, then back up from the bottom edge.
  const resolve = (c: number[]) => {
    c.sort((a, b) => y0[a]! - y0[b]! || a - b);
    let y = area.y;
    for (const i of c) {
      if (y0[i]! < y) y0[i] = y;
      y = y0[i]! + hOf(i) + pad;
    }
    let bottom = area.y + area.h;
    for (let k = c.length - 1; k >= 0; k--) {
      const i = c[k]!;
      if (y0[i]! + hOf(i) > bottom) y0[i] = bottom - hOf(i);
      bottom = y0[i]! - pad;
    }
  };

  // Relaxation, link-aware (as d3-sankey's): a node is pulled to the top at which each of its bands would
  // run level, from where that band actually leaves (or reaches) the neighbour, not to the neighbour's
  // middle. Siblings leaving the same node then pull to different heights, so they keep their order and
  // stop crossing the bands between them. A band spanning more columns pulls harder, being longer to bend.
  for (let sweep = 0; sweep < SANKEY_RELAX_SWEEPS; sweep++) {
    const alpha = Math.pow(0.99, sweep);
    gnodes.forEach((_, i) => sortBands(i));
    for (let c = 1; c < columns; c++) {
      for (const i of byCol[c]!) {
        let sum = 0;
        let weight = 0;
        for (const li of incoming[i]!) {
          const s = glinks[li]!.source;
          const level = y0[s]! + offsetIn(outgoing[s]!, li) - offsetIn(incoming[i]!, li);
          const w = glinks[li]!.value * (col[i]! - col[s]!);
          sum += level * w;
          weight += w;
        }
        if (weight > 0) y0[i]! += (sum / weight - y0[i]!) * alpha;
      }
      resolve(byCol[c]!);
      for (const i of byCol[c]!) sortBands(i);
      for (const i of byCol[c - 1]!) sortBands(i);
    }
    for (let c = columns - 2; c >= 0; c--) {
      for (const i of byCol[c]!) {
        let sum = 0;
        let weight = 0;
        for (const li of outgoing[i]!) {
          const t = glinks[li]!.target;
          const level = y0[t]! + offsetIn(incoming[t]!, li) - offsetIn(outgoing[i]!, li);
          const w = glinks[li]!.value * (col[t]! - col[i]!);
          sum += level * w;
          weight += w;
        }
        if (weight > 0) y0[i]! += (sum / weight - y0[i]!) * alpha;
      }
      resolve(byCol[c]!);
      for (const i of byCol[c]!) sortBands(i);
      if (c + 1 < columns) for (const i of byCol[c + 1]!) sortBands(i);
    }
  }

  const nodes: SankeyNodeBox[] = gnodes.map((g, i) => ({
    index: i,
    name: g.name,
    column: col[i]!,
    value: value[i]!,
    inflow: g.inflow,
    outflow: g.outflow,
    x0: r2(xOf(col[i]!)),
    x1: r2(xOf(col[i]!) + nodeW),
    y0: r2(y0[i]!),
    y1: r2(y0[i]! + hOf(i)),
  }));

  // Band stacking: a node's outgoing bands in the order of their targets top to bottom, its incoming bands
  // in the order of their sources, so neighbouring bands leave and arrive side by side.
  const sy = new Array<number>(glinks.length).fill(0);
  const ty = new Array<number>(glinks.length).fill(0);
  gnodes.forEach((_, i) => {
    const outs = [...outgoing[i]!].sort(
      (a, b) => y0[glinks[a]!.target]! - y0[glinks[b]!.target]! || a - b,
    );
    // A node is as tall as its larger side; the smaller side's bands sit centred against it.
    const outTotal = outs.reduce((s, li) => s + bandW[li]!, 0);
    let y = y0[i]! + Math.max(0, (hOf(i) - outTotal) / 2);
    for (const li of outs) {
      sy[li] = y + bandW[li]! / 2;
      y += bandW[li]!;
    }
    const ins = [...incoming[i]!].sort(
      (a, b) => y0[glinks[a]!.source]! - y0[glinks[b]!.source]! || a - b,
    );
    const inTotal = ins.reduce((s, li) => s + bandW[li]!, 0);
    y = y0[i]! + Math.max(0, (hOf(i) - inTotal) / 2);
    for (const li of ins) {
      ty[li] = y + bandW[li]! / 2;
      y += bandW[li]!;
    }
  });

  const links: SankeyLinkBand[] = glinks.map((l, li) => {
    const x0 = nodes[l.source]!.x1;
    const x1 = nodes[l.target]!.x0;
    return {
      flow: l.flow,
      source: l.source,
      target: l.target,
      value: l.value,
      width: r2(bandW[li]!),
      y0: r2(sy[li]!),
      y1: r2(ty[li]!),
      x0,
      x1,
      path: sankeyBandPath(x0, sy[li]!, x1, ty[li]!, bandW[li]!),
      centre: sankeyCentrePath(x0, sy[li]!, x1, ty[li]!),
    };
  });

  const total = gnodes.reduce((s, g) => s + (g.inflow === 0 ? g.outflow : 0), 0);
  return { nodes, links, skipped: graph.skipped, columns, total };
}
