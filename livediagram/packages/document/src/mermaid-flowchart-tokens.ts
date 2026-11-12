// The flowchart's tokens (docs/specs/020-import-export/mermaid.md): a node's bracket or `id@{ shape: … }` definition
// read off the front of a statement as a label and shape kind, and an edge operator read as its line, ends, head and
// label. mermaid.ts parses statements from them.

import type { GraphEdge, GraphNode } from './graph-authoring';
import { readInlineLabel } from './mermaid-scan';
import { decodeLabel } from './mermaid-shared';

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

// --- Parse ---------------------------------------------------------------

// Pull a bracketed node definition off the front of `s`. Returns the label +
// shape and the rest of the string, or null when `s` doesn't open with a
// known bracket. The `[/` / `[\` opens have two possible closers (trapezoid
// vs parallelogram): the earlier closer in the string wins, so a
// parallelogram on a line that also contains a trapezoid doesn't swallow it.
export function readNodeDef(
  s: string,
): { label: string; shape: GraphNode['shape']; rest: string } | null {
  // Quoted matches are kept apart from unquoted ones and always win. A quoted
  // label delimits itself, so any candidate that read one is right; the
  // earliest-closer tie-break below is a positional guess that only makes
  // sense between unquoted readings. Mixing them let the guess win: on
  // `([\"Retry (3)\"])` the stadium `([` correctly read the quoted label
  // ending at 13, while the plain `(` candidate stopped at the `)` INSIDE the
  // label at 11, and 11 < 13, so a stadium came back as a rounded box
  // labelled `["Retry (3`.
  let quoted: { label: string; shape: GraphNode['shape']; rest: string; at: number } | null = null;
  let plain: { label: string; shape: GraphNode['shape']; rest: string; at: number } | null = null;
  for (const b of BRACKETS) {
    if (!s.startsWith(b.open)) continue;
    const inner = b.open.length;
    let end: number;
    const isQuoted = s[inner] === '"';
    if (isQuoted) {
      // QUOTED label: the whole reason a bracket inside a label survives.
      // Quoting is Mermaid's own answer to a label containing bracket
      // characters, and our exporter always quotes (mermaid-serialise's
      // SHAPE_TO_BRACKET emits `["` … `"]`), escaping only &, " and newlines.
      // Scanning for the close bracket with a bare indexOf therefore stopped
      // at the FIRST `]`, which for a label like `Array[0]` is the one inside
      // it. That yielded the label `"Array[0` (quotes unbalanced, so
      // decodeLabel couldn't strip them) and left `"]` as the remainder, which
      // then failed to parse as an edge and was dropped. Our own export did
      // not survive its own import, and neither did valid third-party
      // Mermaid.
      //
      // A raw `"` can't appear inside a quoted label: ours becomes `&quot;`,
      // and Mermaid's own escape is an entity too, so the next one closes it.
      const closeQuote = s.indexOf('"', inner + 1);
      if (closeQuote === -1) continue;
      // The bracket must follow immediately, which is also what disambiguates
      // the two `[/` shapes: only one of trapezoid / parallelogram has its
      // closer there.
      if (!s.startsWith(b.close, closeQuote + 1)) continue;
      end = closeQuote + 1;
    } else {
      end = s.indexOf(b.close, inner);
      if (end === -1) continue;
    }
    const found = {
      label: decodeLabel(s.slice(inner, end)),
      shape: b.shape,
      rest: s.slice(end + b.close.length),
      at: end,
    };
    if (isQuoted) {
      if (quoted === null || end < quoted.at) quoted = found;
    } else if (plain === null || end < plain.at) {
      plain = found;
    }
  }
  return quoted ?? plain;
}

// The v11.3 attribute form: `@{ shape: cyl, label: "Store" }`. Only the
// shape + label keys are read; anything else is ignored.
export function readAtDef(
  s: string,
): { label?: string; shape?: GraphNode['shape']; rest: string } | null {
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

// --- Edge operators ------------------------------------------------------

export type EdgeOp = {
  line: NonNullable<GraphEdge['line']>;
  ends: NonNullable<GraphEdge['ends']>;
  head?: GraphEdge['head'];
  invisible: boolean;
  label?: string;
};

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
export function readEdgeOp(s: string): { op: EdgeOp; rest: string } | null {
  {
    const m = readInlineLabel(s);
    if (m) {
      const label = decodeLabel(m.label);
      // The inline forms draw the stroke their opener implies; the markers either side decide the
      // heads, as on a plain operator.
      const body = m.line === 'thick' ? '==' : m.line === 'dashed' ? '-.-' : '--';
      return {
        op: {
          ...opAttrs(m.lead, body, m.trail),
          ...(label ? { label } : {}),
        },
        rest: s.slice(m.length),
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
