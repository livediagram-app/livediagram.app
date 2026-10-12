// The Sankey diagram's data model (docs/specs/009-elements/sankey.md): flows between named nodes, the
// options that change how they draw, the bounds a stored diagram is held to, and the reading of flows from
// a document (`sankeyGraph`), which is where a loop, a self-flow or an unusable value is set aside with a
// reason rather than silently dropped.
//
// A LEAF module (it imports only types), like data-shapes.ts, so factories.ts can seed a new diagram from
// SANKEY_DEFAULT_FLOWS at module-init time without walking into the index <-> factories cycle.

import type { ShapeKind } from './shape-kind';

/** One flow: `value` of something moving from the node named `from` to the node named `to`. */
export type SankeyFlow = { from: string; to: string; value: number };

/** A node's stored look. Only a node somebody recoloured has one; the rest take the palette by order. */
/**
 * A node's own settings, by name: its colour, and `leftover: false` when its leftover is switched off (only
 * `false` is ever stored; absent means it draws one while the diagram shows leftovers).
 */
export type SankeyNodeStyle = { name: string; color?: string; leftover?: boolean };

// A node row worth keeping: one that sets something.
const setsSomething = (n: SankeyNodeStyle) => Boolean(n.color) || n.leftover === false;

/** How a flow's band is coloured: its source node, its target node, a blend of both, or one quiet grey. */
export type SankeyLinkColor = 'source' | 'target' | 'gradient' | 'neutral';
export const SANKEY_LINK_COLORS: readonly SankeyLinkColor[] = [
  'gradient',
  'source',
  'target',
  'neutral',
];
export const SANKEY_LINK_COLOR_LABELS: Record<SankeyLinkColor, string> = {
  gradient: 'Blend',
  source: 'From',
  target: 'To',
  neutral: 'Grey',
};

/** Where the end nodes sit: every end node in the last column, or each node at its own step from the start. */
export type SankeyAlign = 'justify' | 'left';
export const SANKEY_ALIGNS: readonly SankeyAlign[] = ['justify', 'left'];
export const SANKEY_ALIGN_LABELS: Record<SankeyAlign, string> = {
  justify: 'Ends Right',
  left: 'By Step',
};

/** What a node's label says under its name. */
export type SankeyValueLabel = 'value' | 'percent' | 'none';
export const SANKEY_VALUE_LABELS: readonly SankeyValueLabel[] = ['value', 'percent', 'none'];
export const SANKEY_VALUE_LABEL_LABELS: Record<SankeyValueLabel, string> = {
  value: 'Amount',
  percent: 'Percent',
  none: 'Names Only',
};

/** The entrance and ambient motion: bands sweep in once, or a soft current runs along them. */
/** Whether a node that sends on less than it receives draws the difference as a band to a Leftover node. */
export type SankeyLeftover = 'show' | 'hide';
export const SANKEY_LEFTOVERS: readonly SankeyLeftover[] = ['show', 'hide'];
export const SANKEY_LEFTOVER_LABELS: Record<SankeyLeftover, string> = {
  show: 'Show',
  hide: 'Hide',
};
/** The end node leftovers run to, unless the diagram names it otherwise. */
export const SANKEY_LEFTOVER_NAME = 'Leftover';

/**
 * Grow sweeps the diagram in from the left; Flow runs a current along every band; Cascade brings the columns in
 * one after another; Pulse sends a slow wave of light across the bands; Rise grows each column's nodes, then
 * fades their bands in. Flow and Pulse loop; the rest play once.
 */
export type SankeyAnim = 'grow' | 'flow' | 'cascade' | 'pulse' | 'rise';
export const SANKEY_ANIMS: readonly SankeyAnim[] = ['grow', 'flow', 'cascade', 'pulse', 'rise'];
export const SANKEY_LOOPING_ANIMS: readonly SankeyAnim[] = ['flow', 'pulse'];

// Bounds a stored diagram is held to (validate.ts) and the editor clamps to. 200 flows is far past the
// point a Sankey stops being readable (published ones rarely pass 60); it exists so a pasted spreadsheet
// cannot make every render lay out ten thousand bands.
export const SANKEY_MAX_FLOWS = 200;
export const SANKEY_MAX_NODES = 120;
export const SANKEY_NAME_MAX = 60;
export const SANKEY_UNIT_MAX = 8;
// Values above this are refused: past it, a sum of 200 of them loses whole units in a double.
export const SANKEY_VALUE_MAX = 1e12;
/** In and out closer than this balance: amounts are typed to at most a few decimals. */
export const SANKEY_BALANCE_EPSILON = 1e-9;

// A household budget: the example everyone reads without being told how. Two incomes pool into the
// budget, which splits into needs, wants and savings, and needs splits again. It shows the three things
// a Sankey does (merge, split, and a second step) with nothing a reader has to decode.
export const SANKEY_DEFAULT_FLOWS: readonly SankeyFlow[] = [
  { from: 'Salary', to: 'Budget', value: 3200 },
  { from: 'Side Work', to: 'Budget', value: 800 },
  { from: 'Budget', to: 'Needs', value: 2000 },
  { from: 'Budget', to: 'Wants', value: 1200 },
  { from: 'Budget', to: 'Savings', value: 800 },
  { from: 'Needs', to: 'Rent', value: 1400 },
  { from: 'Needs', to: 'Groceries', value: 600 },
];

export function isSankeyShape(kind: ShapeKind): boolean {
  return kind === 'sankey';
}

/** A node name as it is matched and stored: trimmed, inner whitespace collapsed, capped. */
export function cleanSankeyName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, SANKEY_NAME_MAX);
}

/** Why a flow is not drawn (the editor names it beside the row). */
export type SankeySkipReason = 'empty-name' | 'self' | 'value' | 'loop' | 'too-many';

export type SankeyGraphNode = {
  name: string;
  /** First-appearance order across the flows; the colour index and the tie-break everywhere. */
  index: number;
  inflow: number;
  outflow: number;
};

export type SankeyGraphLink = {
  /** The flow's position in the stored `sankeyFlows`, so a hover or a skip can name the row. */
  flow: number;
  source: number;
  target: number;
  value: number;
};

export type SankeyGraph = {
  nodes: SankeyGraphNode[];
  links: SankeyGraphLink[];
  skipped: { flow: number; reason: SankeySkipReason }[];
};

/**
 * Reads stored flows into a graph that can be drawn.
 *
 * Nodes are matched by cleaned name and numbered by first appearance. A flow is set aside, with its
 * reason, when a name is empty, it flows into itself, its value is not a positive finite number, or it
 * closes a loop. A Sankey's columns run one way; a flow back to an earlier node has no column to go to,
 * so the one that CLOSES the loop is set aside, found by a depth-first walk from the nodes in order. That
 * keeps every flow before it, which is the one the author most likely meant.
 */
export function sankeyGraph(flows: readonly SankeyFlow[] | undefined): SankeyGraph {
  const nodes: SankeyGraphNode[] = [];
  const byName = new Map<string, number>();
  const skipped: SankeyGraph['skipped'] = [];
  const candidates: SankeyGraphLink[] = [];
  const nodeOf = (name: string): number => {
    const known = byName.get(name);
    if (known !== undefined) return known;
    const index = nodes.length;
    nodes.push({ name, index, inflow: 0, outflow: 0 });
    byName.set(name, index);
    return index;
  };
  // Reads one flow into the candidates, or says why it cannot be drawn.
  const readFlow = (f: SankeyFlow, i: number): SankeySkipReason | null => {
    if (i >= SANKEY_MAX_FLOWS) return 'too-many';
    const from = cleanSankeyName(f.from ?? '');
    const to = cleanSankeyName(f.to ?? '');
    if (!from || !to) return 'empty-name';
    if (from === to) return 'self';
    const value = f.value;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'value';
    // Past the node cap a flow naming a new node is set aside rather than drawn into an unreadable column.
    const added = (byName.has(from) ? 0 : 1) + (byName.has(to) ? 0 : 1);
    if (nodes.length + added > SANKEY_MAX_NODES) return 'too-many';
    candidates.push({ flow: i, source: nodeOf(from), target: nodeOf(to), value });
    return null;
  };
  (flows ?? []).forEach((f, i) => {
    const reason = readFlow(f, i);
    if (reason) skipped.push({ flow: i, reason });
  });

  // Loop breaking. Outgoing candidates per node in flow order; an edge into a node still on the walk's
  // stack closes a loop. Iterative, so a long chain cannot overflow the call stack.
  const out: SankeyGraphLink[][] = nodes.map(() => []);
  for (const l of candidates) out[l.source]!.push(l);
  const state = new Uint8Array(nodes.length); // 0 unvisited, 1 on the stack, 2 done
  const back = new Set<SankeyGraphLink>();
  for (let root = 0; root < nodes.length; root++) {
    if (state[root]) continue;
    const stack: { node: number; next: number }[] = [{ node: root, next: 0 }];
    state[root] = 1;
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const edges = out[top.node]!;
      if (top.next >= edges.length) {
        state[top.node] = 2;
        stack.pop();
        continue;
      }
      const edge = edges[top.next++]!;
      if (state[edge.target] === 1) back.add(edge);
      else if (state[edge.target] === 0) {
        state[edge.target] = 1;
        stack.push({ node: edge.target, next: 0 });
      }
    }
  }

  const links: SankeyGraphLink[] = [];
  for (const l of candidates) {
    if (back.has(l)) {
      skipped.push({ flow: l.flow, reason: 'loop' });
      continue;
    }
    links.push(l);
    nodes[l.source]!.outflow += l.value;
    nodes[l.target]!.inflow += l.value;
  }
  skipped.sort((a, b) => a.flow - b.flow);
  // A node whose only flows were set aside has nothing to draw; drop it and renumber, keeping order.
  const used = nodes.filter((n) => n.inflow > 0 || n.outflow > 0);
  if (used.length !== nodes.length) {
    const remap = new Map(used.map((n, i) => [n.index, i]));
    used.forEach((n, i) => (n.index = i));
    for (const l of links) {
      l.source = remap.get(l.source)!;
      l.target = remap.get(l.target)!;
    }
  }
  return { nodes: used, links, skipped };
}

/** The distinct cleaned node names across the flows, in first-appearance order (drawn or not). */
export function sankeyNodeNames(flows: readonly SankeyFlow[] | undefined): string[] {
  const seen = new Set<string>();
  for (const f of flows ?? []) {
    for (const raw of [f.from, f.to]) {
      const name = cleanSankeyName(raw ?? '');
      if (name) seen.add(name);
    }
  }
  return [...seen];
}

// Currency marks read before the number ("£1,200"); any other unit reads after it ("1,200 kWh").
const PREFIX_UNITS = new Set(['$', '£', '€', '¥', '₹', '₩', '₽', '₺', '₪', '฿', 'R$', 'A$', 'C$']);

/**
 * A value as a label shows it: thousands grouped, at most two decimals (trailing zeros dropped), with the
 * diagram's unit. Hand-rolled rather than Intl so the canvas, the export and a headless script print the
 * same characters whatever their locale.
 */
export function formatSankeyValue(value: number, unit?: string): string {
  const neg = value < 0;
  const fixed = Math.abs(value)
    .toFixed(2)
    .replace(/\.?0+$/, '');
  const [whole = '0', frac] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const num = `${neg ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
  const u = unit?.trim();
  if (!u) return num;
  return PREFIX_UNITS.has(u) ? `${neg ? '-' : ''}${u}${num.replace(/^-/, '')}` : `${num} ${u}`;
}

/** A share as a label shows it: whole percent, or one decimal under 10%, never "0%" for a real flow. */
export function formatSankeyPercent(part: number, whole: number): string {
  if (!(whole > 0)) return '0%';
  const pct = (part / whole) * 100;
  if (pct > 0 && pct < 0.1) return '<0.1%';
  return `${pct < 10 ? Math.round(pct * 10) / 10 : Math.round(pct)}%`;
}

/** The stored colour for a node, if somebody picked one. */
export function sankeyNodeColor(
  styles: readonly SankeyNodeStyle[] | undefined,
  name: string,
): string | undefined {
  return styles?.find((s) => s.name === name)?.color;
}

/**
 * Flows ready to store: names cleaned, at most SANKEY_MAX_FLOWS, values finite and in range. An empty or
 * zero row is kept (the Flows dialog shows a row being written, and names why it is not drawn yet).
 */
export function cleanSankeyFlows(flows: readonly SankeyFlow[]): SankeyFlow[] {
  return flows.slice(0, SANKEY_MAX_FLOWS).map((f) => ({
    from: cleanSankeyName(f.from),
    to: cleanSankeyName(f.to),
    value: Number.isFinite(f.value)
      ? Math.max(-SANKEY_VALUE_MAX, Math.min(SANKEY_VALUE_MAX, f.value))
      : 0,
  }));
}

/** Node styles that still name a node of these flows, so recolouring cannot grow the list forever. */
export function pruneSankeyNodes(
  nodes: readonly SankeyNodeStyle[] | undefined,
  flows: readonly SankeyFlow[],
): SankeyNodeStyle[] | undefined {
  if (!nodes || nodes.length === 0) return undefined;
  const live = new Set(sankeyNodeNames(flows));
  const kept = nodes.filter((n) => setsSomething(n) && live.has(n.name)).slice(0, SANKEY_MAX_NODES);
  return kept.length > 0 ? kept : undefined;
}

// One node's row changed by `patch`, keeping what else it sets; a row left setting nothing is dropped.
function withSankeyNode(
  nodes: readonly SankeyNodeStyle[] | undefined,
  name: string,
  patch: Partial<SankeyNodeStyle>,
): SankeyNodeStyle[] | undefined {
  const own = nodes?.find((n) => n.name === name);
  const rest = (nodes ?? []).filter((n) => n.name !== name);
  const row: SankeyNodeStyle = { ...own, ...patch, name };
  if (!row.color) delete row.color;
  if (row.leftover !== false) delete row.leftover;
  const next = setsSomething(row) ? [...rest, row] : rest;
  return next.length > 0 ? next.slice(0, SANKEY_MAX_NODES) : undefined;
}

/** Sets (or, with no colour, clears) one node's colour, keeping every other node's and its own other settings. */
export function withSankeyNodeColor(
  nodes: readonly SankeyNodeStyle[] | undefined,
  name: string,
  color: string | undefined,
): SankeyNodeStyle[] | undefined {
  return withSankeyNode(nodes, name, { color });
}

/** Switches one node's leftover on (the default, so nothing is stored) or off. */
export function withSankeyNodeLeftover(
  nodes: readonly SankeyNodeStyle[] | undefined,
  name: string,
  on: boolean,
): SankeyNodeStyle[] | undefined {
  return withSankeyNode(nodes, name, { leftover: on ? undefined : false });
}

/** Whether a node draws its leftover while the diagram shows leftovers. */
export function sankeyNodeLeftover(
  nodes: readonly SankeyNodeStyle[] | undefined,
  name: string,
): boolean {
  return nodes?.find((n) => n.name === name)?.leftover !== false;
}

/**
 * Renames a node everywhere: every flow from or to it, and its colour. Renaming onto a name that already
 * exists merges the two nodes, which is what typing an existing name means.
 */
export function renameSankeyNode(
  flows: readonly SankeyFlow[],
  nodes: readonly SankeyNodeStyle[] | undefined,
  from: string,
  to: string,
): { flows: SankeyFlow[]; nodes: SankeyNodeStyle[] | undefined } {
  const was = cleanSankeyName(from);
  const now = cleanSankeyName(to);
  if (!was || !now || was === now) return { flows: [...flows], nodes: nodes ? [...nodes] : nodes };
  const swap = (name: string) => (cleanSankeyName(name) === was ? now : name);
  const moved = (nodes ?? []).map((n) => (n.name === was ? { ...n, name: now } : n));
  // A merge keeps the colour the surviving name already had.
  const seen = new Set<string>();
  const deduped = moved.filter((n) => !seen.has(n.name) && (seen.add(n.name), true));
  return {
    flows: flows.map((f) => ({ ...f, from: swap(f.from), to: swap(f.to) })),
    nodes: nodes ? deduped : nodes,
  };
}

/**
 * The flows a diagram draws: the stored ones, then, unless leftovers are hidden, one flow per middle node that
 * sends on less than it receives, carrying the difference to the leftover node (docs/specs/009-elements/sankey.md
 * "Leftovers"). `stored` is how many of them are stored, so a band at or past it is a leftover. A leftover is
 * never stored: it follows the amounts as they change. A start or an end node has none, and a node that sends on
 * more than it receives has none either, nor does a node whose leftover is switched off.
 */
export function sankeyDrawnFlows(
  flows: readonly SankeyFlow[] | undefined,
  leftover: SankeyLeftover | undefined,
  leftoverName: string | undefined,
  nodes?: readonly SankeyNodeStyle[],
): { flows: SankeyFlow[]; stored: number } {
  const stored = flows ?? [];
  if (leftover === 'hide') return { flows: [...stored], stored: stored.length };
  const to = cleanSankeyName(leftoverName ?? '') || SANKEY_LEFTOVER_NAME;
  const extra: SankeyFlow[] = [];
  for (const n of sankeyGraph(stored).nodes) {
    const diff = n.inflow - n.outflow;
    if (
      n.inflow > 0 &&
      n.outflow > 0 &&
      diff > SANKEY_BALANCE_EPSILON &&
      n.name !== to &&
      sankeyNodeLeftover(nodes, n.name)
    )
      extra.push({ from: n.name, to, value: diff });
  }
  return { flows: [...stored, ...extra], stored: stored.length };
}
