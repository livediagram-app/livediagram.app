// Mermaid flowchart <-> livediagram (spec/73). Pure + reusable: parse a
// Mermaid `flowchart`/`graph` into the node/edge graph the cluster-aware
// layout consumes (layoutClusteredGraph, spec/73), and serialise a tab back
// to Mermaid text. Only the flowchart diagram type is supported — it maps
// exactly onto our node/edge model; other Mermaid types (sequence, class,
// gantt, …) report a clear error.
//
// The parser is line-oriented and forgiving: lines it doesn't understand
// (classDef, style, click, %% comments) are skipped so a real-world paste
// imports its graph and drops the decoration. Within a line it covers the
// full edge-operator surface (solid / dashed / thick strokes, headless /
// two-headed / o / x terminals, inline `-- text -->` labels, `&` fans,
// invisible `~~~` links — parsed and dropped) and the node-shape brackets
// including trapezoids, subroutines, flags, double circles, and the v11.3
// `id@{ shape: …, label: … }` attribute form. Top-level `subgraph` blocks
// become clusters (frames); nested subgraphs fold into their ancestor.

import { ARROW_THICKNESS_PX } from './arrow-style';
import type { DiagramGraph, GraphCluster, GraphEdge, GraphNode } from './graph-authoring';
import type { ArrowElement, Element } from './index';
import { visibleLayerElements, type Layer } from './layers';

export type MermaidDirection = 'TB' | 'LR';

export type ParseMermaidResult =
  | { ok: true; graph: DiagramGraph; direction: MermaidDirection }
  | { ok: false; error: string };

// --- Shape mapping -------------------------------------------------------
// Mermaid node bracket -> our shape kind. Order matters: the more specific
// (longer) delimiters are tried first so `((x))` isn't read as `(x)`, and
// the mixed-slash trapezoids before the same-slash parallelograms.
type BracketSpec = { open: string; close: string; shape: GraphNode['shape'] };
const BRACKETS: BracketSpec[] = [
  { open: '(((', close: ')))', shape: 'circle' }, // double circle
  { open: '([', close: '])', shape: 'stadium' },
  { open: '[[', close: ']]', shape: 'square' }, // subroutine
  { open: '[(', close: ')]', shape: 'cylinder' },
  { open: '((', close: '))', shape: 'circle' },
  { open: '{{', close: '}}', shape: 'hexagon' },
  { open: '[/', close: '\\]', shape: 'trapezoid' },
  { open: '[\\', close: '/]', shape: 'trapezoid' },
  { open: '[/', close: '/]', shape: 'parallelogram' },
  { open: '[\\', close: '\\]', shape: 'parallelogram' },
  { open: '>', close: ']', shape: 'square' }, // asymmetric flag
  { open: '[', close: ']', shape: 'square' },
  { open: '(', close: ')', shape: 'stadium' },
  { open: '{', close: '}', shape: 'diamond' },
];

// The v11.3 `id@{ shape: <name> }` vocabulary, folded onto our shape kinds.
// Unknown names fall back to the square box.
const AT_SHAPE_NAMES: Record<string, GraphNode['shape']> = {
  rect: 'square',
  rectangle: 'square',
  square: 'square',
  proc: 'square',
  process: 'square',
  subroutine: 'square',
  subproc: 'square',
  rounded: 'stadium',
  event: 'stadium',
  stadium: 'stadium',
  pill: 'stadium',
  terminal: 'stadium',
  circle: 'circle',
  circ: 'circle',
  'dbl-circ': 'circle',
  'double-circle': 'circle',
  diam: 'diamond',
  diamond: 'diamond',
  decision: 'diamond',
  question: 'diamond',
  hex: 'hexagon',
  hexagon: 'hexagon',
  prepare: 'hexagon',
  cyl: 'cylinder',
  cylinder: 'cylinder',
  database: 'cylinder',
  db: 'cylinder',
  'lean-r': 'parallelogram',
  'lean-l': 'parallelogram',
  parallelogram: 'parallelogram',
  'trap-b': 'trapezoid',
  'trap-t': 'trapezoid',
  trapezoid: 'trapezoid',
  doc: 'document',
  document: 'document',
  docs: 'document',
  documents: 'document',
  tri: 'triangle',
  triangle: 'triangle',
};

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
  trapezoid: ['[/"', '"\\]'],
};

// --- Parse ---------------------------------------------------------------

const HEADER_RE = /^\s*(?:flowchart|graph)\b\s*([A-Za-z]{2})?\s*$/i;

function directionOf(token: string | undefined): MermaidDirection {
  const t = (token ?? '').toUpperCase();
  return t === 'LR' || t === 'RL' ? 'LR' : 'TB';
}

// Label text -> element label: strip surrounding quotes, turn <br> line
// breaks into real newlines, decode the entities the export emits.
function decodeLabel(s: string): string {
  let t = s.trim();
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) t = t.slice(1, -1);
  return t
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

// Pull a bracketed node definition off the front of `s`. Returns the label +
// shape and the rest of the string, or null when `s` doesn't open with a
// known bracket. The `[/` / `[\` opens have two possible closers (trapezoid
// vs parallelogram) — the earlier closer in the string wins, so a
// parallelogram on a line that also contains a trapezoid doesn't swallow it.
function readNodeDef(s: string): { label: string; shape: GraphNode['shape']; rest: string } | null {
  let best: { label: string; shape: GraphNode['shape']; rest: string; at: number } | null = null;
  for (const b of BRACKETS) {
    if (!s.startsWith(b.open)) continue;
    const end = s.indexOf(b.close, b.open.length);
    if (end === -1) continue;
    if (best === null || end < best.at) {
      best = {
        label: decodeLabel(s.slice(b.open.length, end)),
        shape: b.shape,
        rest: s.slice(end + b.close.length),
        at: end,
      };
    }
  }
  return best;
}

// The v11.3 attribute form: `@{ shape: cyl, label: "Store" }`. Only the
// shape + label keys are read; anything else is ignored.
function readAtDef(s: string): { label?: string; shape?: GraphNode['shape']; rest: string } | null {
  const m = /^@\{([^}]*)\}/.exec(s);
  if (!m) return null;
  const body = m[1]!;
  const shapeM = /(?:^|,)\s*shape\s*:\s*([A-Za-z0-9-]+)/.exec(body);
  const labelM = /(?:^|,)\s*label\s*:\s*("(?:[^"]*)"|[^,}]+)/.exec(body);
  return {
    ...(shapeM ? { shape: AT_SHAPE_NAMES[shapeM[1]!.toLowerCase()] ?? 'square' } : {}),
    ...(labelM ? { label: decodeLabel(labelM[1]!) } : {}),
    rest: s.slice(m[0].length),
  };
}

// Read the id token at the front (letters, digits, _, made of the chars
// Mermaid allows in a bare id). Returns null if none.
function readId(s: string): { id: string; rest: string } | null {
  const m = /^\s*([A-Za-z0-9_]+)/.exec(s);
  return m ? { id: m[1]!, rest: s.slice(m[0].length) } : null;
}

// --- Edge operators ------------------------------------------------------

type EdgeOp = {
  line: NonNullable<GraphEdge['line']>;
  ends: NonNullable<GraphEdge['ends']>;
  head?: GraphEdge['head'];
  invisible: boolean;
  label?: string;
};

const INLINE_LABEL_RES: { re: RegExp; line: EdgeOp['line'] }[] = [
  // `-- text -->` / `-- text ---` / `-- text --o` …
  { re: /^\s*--\s+(.+?)\s+(-{2,})([>ox])?/, line: 'solid' },
  // `-. text .->` / `-. text .-`
  { re: /^\s*-\.\s+(.+?)\s+\.+(-)([>ox])?/, line: 'dashed' },
  // `== text ==>` / `== text ===`
  { re: /^\s*==\s+(.+?)\s+(={2,})([>ox])?/, line: 'thick' },
];

const PLAIN_OP_RE = /^\s*(?:(<|o|x)(?=[-=.]))?(-\.+-|-{2,}|={2,}|~{3,})(>|o|x)?/;

function opAttrs(
  lead: string | undefined,
  body: string,
  trail: string | undefined,
): Pick<EdgeOp, 'line' | 'ends' | 'head' | 'invisible'> {
  const line: EdgeOp['line'] = body.startsWith('=')
    ? 'thick'
    : body.includes('.')
      ? 'dashed'
      : 'solid';
  const ends: EdgeOp['ends'] = lead && trail ? 'both' : trail ? 'to' : lead ? 'from' : 'none';
  const marker =
    trail === 'o' || trail === 'x' ? trail : lead === 'o' || lead === 'x' ? lead : null;
  return {
    line,
    ends,
    ...(marker ? { head: marker === 'o' ? ('circle' as const) : ('cross' as const) } : {}),
    invisible: body.startsWith('~'),
  };
}

// Read one connection operator (with its label, inline or `|piped|`) off the
// front of `s`, or null when the segment isn't an edge.
function readEdgeOp(s: string): { op: EdgeOp; rest: string } | null {
  for (const { re, line } of INLINE_LABEL_RES) {
    const m = re.exec(s);
    if (m) {
      const label = decodeLabel(m[1]!);
      const trail = m[3];
      // The inline forms draw the stroke their opener implies; the closing
      // run only decides the head.
      const marker = trail === 'o' || trail === 'x' ? trail : null;
      return {
        op: {
          line,
          ends: trail ? 'to' : 'none',
          ...(marker ? { head: marker === 'o' ? ('circle' as const) : ('cross' as const) } : {}),
          invisible: false,
          ...(label ? { label } : {}),
        },
        rest: s.slice(m[0].length),
      };
    }
  }
  const m = PLAIN_OP_RE.exec(s);
  if (!m) return null;
  let rest = s.slice(m[0].length);
  const attrs = opAttrs(m[1], m[2]!, m[3]);
  const piped = /^\s*\|([^|]*)\|/.exec(rest);
  let label: string | undefined;
  if (piped) {
    label = decodeLabel(piped[1]!);
    rest = rest.slice(piped[0].length);
  }
  return { op: { ...attrs, ...(label ? { label } : {}) }, rest };
}

// --- Statement parsing ---------------------------------------------------

const SKIP_RE = /^\s*(?:classDef|class|style|click|linkStyle|%%|direction)\b/i;
const NON_FLOWCHART_RE =
  /^\s*(sequenceDiagram|classDiagram|stateDiagram|gantt|pie|erDiagram|journey|mindmap|timeline|quadrantChart)\b/i;

export function parseMermaid(text: string): ParseMermaidResult {
  const lines = text.split('\n');
  let direction: MermaidDirection = 'TB';
  let sawFlow = false;
  let sawSequenceEtc = false;

  const nodes = new Map<string, GraphNode>();
  // Ids only ever seen as an edge endpoint (no def) — a cluster id in an
  // edge lands here, and the matching auto-created node is removed at the
  // end so the arrow pins to the frame instead.
  const implicit = new Set<string>();
  const edges: GraphEdge[] = [];
  const clusters: GraphCluster[] = [];
  let currentCluster: GraphCluster | null = null;
  let subgraphDepth = 0;

  const touch = (id: string) => {
    if (!nodes.has(id)) {
      nodes.set(id, { id, label: id, shape: 'square' });
      implicit.add(id);
      // Mermaid semantics: a node belongs to the subgraph it was first
      // mentioned in.
      if (currentCluster) currentCluster.members.push(id);
    }
    return nodes.get(id)!;
  };

  // One node reference: id, optionally followed by a bracket def or the
  // `@{ … }` attribute form (either marks the node as explicitly defined).
  const readNodeRef = (s: string): { id: string; rest: string } | null => {
    const head = readId(s);
    if (!head) return null;
    const n = touch(head.id);
    const trimmed = head.rest.replace(/^\s+/, '');
    const def = readNodeDef(trimmed);
    if (def) {
      n.label = def.label;
      n.shape = def.shape;
      implicit.delete(head.id);
      return { id: head.id, rest: def.rest };
    }
    const at = readAtDef(trimmed);
    if (at) {
      if (at.label !== undefined) n.label = at.label;
      if (at.shape !== undefined) n.shape = at.shape;
      implicit.delete(head.id);
      return { id: head.id, rest: at.rest };
    }
    return { id: head.id, rest: head.rest };
  };

  // A `&`-fanned group of node references: `A & B & C`.
  const readNodeGroup = (s: string): { ids: string[]; rest: string } | null => {
    const first = readNodeRef(s);
    if (!first) return null;
    const ids = [first.id];
    let rest = first.rest;
    for (;;) {
      const amp = /^\s*&\s*/.exec(rest);
      if (!amp) break;
      const next = readNodeRef(rest.slice(amp[0].length));
      if (!next) break;
      ids.push(next.id);
      rest = next.rest;
    }
    return { ids, rest };
  };

  for (const rawLine of lines) {
    const line = rawLine
      .replace(/%%.*$/, '') // strip trailing comments
      .replace(/;+\s*$/, '') // statement-terminating semicolons
      .trim();
    if (!line) continue;

    const header = HEADER_RE.exec(line);
    if (header) {
      sawFlow = true;
      direction = directionOf(header[1]);
      continue;
    }
    // A non-flowchart diagram header (sequenceDiagram, classDiagram, …) means
    // this isn't a flowchart at all.
    if (NON_FLOWCHART_RE.test(line)) {
      sawSequenceEtc = true;
      break;
    }

    const sub = /^subgraph\s+(.+)$/i.exec(line);
    if (sub) {
      subgraphDepth += 1;
      // Only top-level subgraphs become frames; nested ones fold into
      // their ancestor (frames import one level deep).
      if (subgraphDepth === 1) {
        const spec = sub[1]!.trim();
        const idTitle = /^([A-Za-z0-9_-]+)\s*\[(.*)\]$/.exec(spec);
        const cluster: GraphCluster = idTitle
          ? { id: idTitle[1]!, label: decodeLabel(idTitle[2]!), members: [] }
          : { id: spec, label: decodeLabel(spec), members: [] };
        clusters.push(cluster);
        currentCluster = cluster;
      }
      continue;
    }
    if (/^end$/i.test(line)) {
      subgraphDepth = Math.max(0, subgraphDepth - 1);
      if (subgraphDepth === 0) currentCluster = null;
      continue;
    }

    if (SKIP_RE.test(line)) continue;

    // Parse a chain of fanned groups: group ( edgeOp group )*
    let group = readNodeGroup(line);
    if (!group) continue;
    let s = group.rest;
    for (;;) {
      const e = readEdgeOp(s);
      if (!e) break;
      const next = readNodeGroup(e.rest);
      if (!next) break;
      s = next.rest;
      // Invisible links exist for Mermaid layout spacing only — an
      // invisible arrow on a real canvas is a trap, so the edge is dropped
      // (the nodes still import).
      if (!e.op.invisible) {
        for (const from of group.ids) {
          for (const to of next.ids) {
            edges.push({
              from,
              to,
              ...(e.op.label ? { label: e.op.label } : {}),
              ...(e.op.line !== 'solid' ? { line: e.op.line } : {}),
              ...(e.op.ends !== 'to' ? { ends: e.op.ends } : {}),
              ...(e.op.head ? { head: e.op.head } : {}),
            });
          }
        }
      }
      group = next;
    }
  }

  if (sawSequenceEtc) {
    return {
      ok: false,
      error:
        'Only Mermaid flowcharts (graph / flowchart) are supported, not sequence / class / gantt / etc.',
    };
  }

  // An edge may reference a subgraph id (the arrow pins to the frame). The
  // mention auto-created a node with that id — remove it so the id resolves
  // to the cluster, unless a real node def claimed it.
  for (const c of clusters) {
    if (implicit.has(c.id) && nodes.has(c.id)) {
      nodes.delete(c.id);
      for (const other of clusters) {
        other.members = other.members.filter((m) => m !== c.id);
      }
    }
  }
  const realClusters = clusters.filter((c) => c.members.length > 0);

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
  return {
    ok: true,
    graph: {
      nodes: [...nodes.values()],
      edges,
      ...(realClusters.length ? { clusters: realClusters } : {}),
    },
    direction,
  };
}

// --- Serialise -----------------------------------------------------------

// Element label -> Mermaid quoted-label text. `&` first so the entities it
// introduces aren't double-escaped; newlines become <br/>.
function escapeLabel(label: string): string {
  return label.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/\n/g, '<br/>');
}

// Mermaid ids must be plain tokens; map our arbitrary element ids to n1, n2…
// deterministically by first appearance.
function mermaidNodeText(id: string, label: string, shape: string): string {
  const [open, close] = SHAPE_TO_BRACKET[shape] ?? SHAPE_TO_BRACKET.square!;
  return `${id}${open}${escapeLabel(label)}${close}`;
}

// The connection operator an arrow's real stroke/ends/head fields spell.
// Dashed wins over thick (Mermaid has no dashed-thick stroke); a circle head
// swaps the terminal for `o`. Head-at-from arrows are emitted with their
// endpoints swapped instead (the caller handles the swap).
function edgeOperator(a: ArrowElement, ends: 'to' | 'none' | 'both'): string {
  const dashed = a.strokeStyle !== undefined && a.strokeStyle !== 'solid';
  const thick = !dashed && (a.strokeWidth ?? 0) >= ARROW_THICKNESS_PX.thick;
  const circle = a.arrowheadShape === 'circle' || a.arrowheadShape === 'circle-hollow';
  const body = dashed ? '-.-' : thick ? '==' : '--';
  if (ends === 'none') return dashed ? '-.-' : thick ? '===' : '---';
  const headChar = circle ? 'o' : '>';
  const lead = ends === 'both' ? (circle ? 'o' : '<') : '';
  return `${lead}${body}${headChar}`;
}

type BoxedShape = Element & {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  shape?: string;
};

export function mermaidFromTab(tab: { elements: Element[]; layers?: Layer[] }): string {
  // Hidden layers drop out of the export (spec/74): what you see on the
  // canvas is what the flowchart describes. Arrows on hidden layers (or
  // touching hidden nodes) vanish with them, since a hidden node never
  // enters the id map below.
  const elements = visibleLayerElements(tab.elements, tab.layers);
  const boxed = elements.filter((e): e is BoxedShape => e.type === 'shape' && 'x' in e);
  const frames = boxed.filter((e) => e.shape === 'frame');
  const nodes = boxed.filter((e) => e.shape !== 'frame');

  const idMap = new Map<string, string>();
  nodes.forEach((el, i) => idMap.set(el.id, `n${i + 1}`));
  frames.forEach((el, i) => idMap.set(el.id, `s${i + 1}`));

  // A node belongs to the smallest frame containing its centre — one level,
  // matching what the import produces.
  const frameOf = new Map<string, string>();
  for (const n of nodes) {
    const cx = n.x + n.width / 2;
    const cy = n.y + n.height / 2;
    let best: BoxedShape | null = null;
    for (const f of frames) {
      const inside = cx >= f.x && cx <= f.x + f.width && cy >= f.y && cy <= f.y + f.height;
      if (inside && (best === null || f.width * f.height < best.width * best.height)) best = f;
    }
    if (best) frameOf.set(n.id, best.id);
  }

  const nodeLine = (el: BoxedShape, indent: string) => {
    const mid = idMap.get(el.id)!;
    const label = (el.label ?? '').trim() || mid;
    return `${indent}${mermaidNodeText(mid, label, el.shape ?? 'square')}`;
  };

  const lines: string[] = ['flowchart TD'];
  for (const f of frames) {
    const sid = idMap.get(f.id)!;
    const title = (f.label ?? '').trim() || sid;
    lines.push(`  subgraph ${sid}["${escapeLabel(title)}"]`);
    for (const n of nodes) if (frameOf.get(n.id) === f.id) lines.push(nodeLine(n, '    '));
    lines.push('  end');
  }
  for (const n of nodes) if (!frameOf.has(n.id)) lines.push(nodeLine(n, '  '));

  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    let from = el.from.kind === 'pinned' ? idMap.get(el.from.elementId) : undefined;
    let to = el.to.kind === 'pinned' ? idMap.get(el.to.elementId) : undefined;
    if (!from || !to) continue; // free / on-arrow endpoints have no node to name
    let ends: 'to' | 'none' | 'both';
    const rawEnds = el.arrowEnds ?? 'to';
    if (rawEnds === 'from') {
      // Head at the from end: Mermaid has no lone back-arrow, so swap the
      // endpoints — same picture, same graph.
      [from, to] = [to, from];
      ends = 'to';
    } else {
      ends = rawEnds;
    }
    const op = edgeOperator(el, ends);
    const label = typeof el.label === 'string' ? el.label.trim() : '';
    lines.push(`  ${from} ${op}${label ? `|${escapeLabel(label)}|` : ''} ${to}`);
  }
  return lines.join('\n') + '\n';
}
