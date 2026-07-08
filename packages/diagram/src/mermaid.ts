// Mermaid flowchart <-> livediagram (spec/73). Pure + reusable: parse a
// Mermaid `flowchart`/`graph` into the node/edge graph `graphToElements`
// consumes (spec/62 §4.7), and serialise a tab back to Mermaid text. Only the
// flowchart diagram type is supported — it maps exactly onto our node/edge
// model; other Mermaid types (sequence, class, gantt, …) report a clear error.
//
// The parser is line-oriented and forgiving: lines it doesn't understand
// (subgraph, classDef, style, click, %% comments) are skipped so a real-world
// paste imports its graph and drops the decoration.

import type { DiagramGraph, GraphNode } from './graph-authoring';
import type { Element } from './index';
import { visibleLayerElements, type Layer } from './layers';

export type MermaidDirection = 'TB' | 'LR';

export type ParseMermaidResult =
  | { ok: true; graph: DiagramGraph; direction: MermaidDirection }
  | { ok: false; error: string };

// --- Shape mapping -------------------------------------------------------
// Mermaid node bracket -> our shape kind. Order matters: the more specific
// (longer) delimiters are tried first so `((x))` isn't read as `(x)`.
type BracketSpec = { open: string; close: string; shape: GraphNode['shape'] };
const BRACKETS: BracketSpec[] = [
  { open: '([', close: '])', shape: 'stadium' },
  { open: '[(', close: ')]', shape: 'cylinder' },
  { open: '((', close: '))', shape: 'circle' },
  { open: '{{', close: '}}', shape: 'hexagon' },
  { open: '[/', close: '/]', shape: 'parallelogram' },
  { open: '[\\', close: '\\]', shape: 'parallelogram' },
  { open: '[', close: ']', shape: 'square' },
  { open: '(', close: ')', shape: 'stadium' },
  { open: '{', close: '}', shape: 'diamond' },
];

// Our shape kind -> the Mermaid bracket to emit on export. Kinds without a
// natural flowchart shape fall back to the square box.
const SHAPE_TO_BRACKET: Record<string, [string, string]> = {
  square: ['["', '"]'],
  stadium: ['(["', '"])'],
  circle: ['(("', '"))'],
  diamond: ['{"', '"}'],
  cylinder: ['[("', '")]'],
  hexagon: ['{{"', '"}}'],
  parallelogram: ['[/"', '"/]'],
};

// --- Parse ---------------------------------------------------------------

const HEADER_RE = /^\s*(?:flowchart|graph)\s+([A-Za-z]{2})\b/i;

function directionOf(token: string | undefined): MermaidDirection {
  const t = (token ?? '').toUpperCase();
  return t === 'LR' || t === 'RL' ? 'LR' : 'TB';
}

// Pull a bracketed node definition off the front of `s` starting at `id`.
// Returns the label + shape and the rest of the string, or null when `id`
// isn't immediately followed by a known opening bracket.
function readNodeDef(s: string): { label: string; shape: GraphNode['shape']; rest: string } | null {
  for (const b of BRACKETS) {
    if (s.startsWith(b.open)) {
      const end = s.indexOf(b.close, b.open.length);
      if (end === -1) continue;
      const raw = s.slice(b.open.length, end);
      return { label: unquote(raw), shape: b.shape, rest: s.slice(end + b.close.length) };
    }
  }
  return null;
}

function unquote(s: string): string {
  const t = s.trim();
  return t.startsWith('"') && t.endsWith('"') && t.length >= 2 ? t.slice(1, -1) : t;
}

// A flowchart connection operator: an optional dash/dot/equals run, an
// optional |label|, an arrowhead or not. We only need to split a segment into
// (operator, label) and keep going; the exact stroke style is coarse.
const EDGE_RE = /^\s*(-{2,3}>|-{2,3}|-\.->|-\.-|={2,3}>|={2,3})\s*(?:\|([^|]*)\|)?\s*/;

// Read the id token at the front (letters, digits, _, made of the chars
// Mermaid allows in a bare id). Returns null if none.
function readId(s: string): { id: string; rest: string } | null {
  const m = /^\s*([A-Za-z0-9_]+)/.exec(s);
  return m ? { id: m[1]!, rest: s.slice(m[0].length) } : null;
}

const SKIP_RE = /^\s*(?:subgraph|end|classDef|class|style|click|linkStyle|%%|direction)\b/i;

export function parseMermaid(text: string): ParseMermaidResult {
  const lines = text.split('\n');
  let direction: MermaidDirection = 'TB';
  let sawFlow = false;
  let sawSequenceEtc = false;

  const nodes = new Map<string, GraphNode>();
  const edges: DiagramGraph['edges'] = [];

  const touch = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, { id, label: id, shape: 'square' });
    return nodes.get(id)!;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/%%.*$/, '').trim(); // strip trailing comments
    if (!line) continue;

    const header = HEADER_RE.exec(line);
    if (header) {
      sawFlow = true;
      direction = directionOf(header[1]);
      continue;
    }
    // A non-flowchart diagram header (sequenceDiagram, classDiagram, …) means
    // this isn't a flowchart at all.
    if (
      /^\s*(sequenceDiagram|classDiagram|stateDiagram|gantt|pie|erDiagram|journey|mindmap|timeline|quadrantChart)\b/i.test(
        line,
      )
    ) {
      sawSequenceEtc = true;
      break;
    }
    if (SKIP_RE.test(line)) continue;

    // Parse a node chain: id [def]? ( edgeOp [label]? id [def]? )*
    let s = line;
    const head = readId(s);
    if (!head) continue;
    let prevId = head.id;
    const def0 = readNodeDef(head.rest.replace(/^\s+/, ''));
    if (def0) {
      const n = touch(prevId);
      n.label = def0.label;
      n.shape = def0.shape;
      s = def0.rest;
    } else {
      touch(prevId);
      s = head.rest;
    }

    // Walk any number of chained edges on this line.
    while (true) {
      const e = EDGE_RE.exec(s);
      if (!e) break;
      const label = e[2]?.trim();
      s = s.slice(e[0].length);
      const next = readId(s);
      if (!next) break;
      const targetId = next.id;
      const def = readNodeDef(next.rest.replace(/^\s+/, ''));
      if (def) {
        const n = touch(targetId);
        n.label = def.label;
        n.shape = def.shape;
        s = def.rest;
      } else {
        touch(targetId);
        s = next.rest;
      }
      edges.push({ from: prevId, to: targetId, ...(label ? { label } : {}) });
      prevId = targetId;
    }
  }

  if (sawSequenceEtc) {
    return {
      ok: false,
      error:
        'Only Mermaid flowcharts (graph / flowchart) are supported, not sequence / class / gantt / etc.',
    };
  }
  // A flowchart needs either the header or at least one connection — a bare
  // word (or a stray line of prose) is not a diagram.
  if (nodes.size === 0 || (!sawFlow && edges.length === 0)) {
    return {
      ok: false,
      error: sawFlow
        ? 'No nodes found in the flowchart.'
        : 'This doesn’t look like a Mermaid flowchart (expected a `graph` or `flowchart` header).',
    };
  }
  return { ok: true, graph: { nodes: [...nodes.values()], edges }, direction };
}

// --- Serialise -----------------------------------------------------------

// Mermaid ids must be plain tokens; map our arbitrary element ids to n1, n2…
// deterministically by first appearance.
function mermaidNodeText(id: string, label: string, shape: string): string {
  const [open, close] = SHAPE_TO_BRACKET[shape] ?? SHAPE_TO_BRACKET.square!;
  // Escape double-quotes in the label; Mermaid quoted strings don't need more.
  return `${id}${open}${label.replace(/"/g, '&quot;')}${close}`;
}

export function mermaidFromTab(tab: { elements: Element[]; layers?: Layer[] }): string {
  // Hidden layers drop out of the export (spec/74): what you see on the
  // canvas is what the flowchart describes. Arrows on hidden layers (or
  // touching hidden nodes) vanish with them, since a hidden node never
  // enters the id map below.
  const elements = visibleLayerElements(tab.elements, tab.layers);
  const boxed = elements.filter(
    (e): e is Element & { x: number; label?: string; shape?: string } =>
      e.type === 'shape' && 'x' in e,
  );
  const idMap = new Map<string, string>();
  boxed.forEach((el, i) => idMap.set(el.id, `n${i + 1}`));

  const lines: string[] = ['flowchart TD'];
  for (const el of boxed) {
    const mid = idMap.get(el.id)!;
    const label = (el.label ?? '').trim() || mid;
    lines.push(`  ${mermaidNodeText(mid, label, el.shape ?? 'square')}`);
  }
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    const from = el.from.kind === 'pinned' ? idMap.get(el.from.elementId) : undefined;
    const to = el.to.kind === 'pinned' ? idMap.get(el.to.elementId) : undefined;
    if (!from || !to) continue; // free / on-arrow endpoints have no node to name
    const label =
      typeof (el as { label?: string }).label === 'string'
        ? (el as { label?: string }).label!.trim()
        : '';
    lines.push(`  ${from} -->${label ? `|${label}|` : ''} ${to}`);
  }
  return lines.join('\n') + '\n';
}
