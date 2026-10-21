// The formula syntax tree (blueprint sheets-engine.md "Grammar"). A typed formula's references are positional
// (`ref`); a stored template's are indexes into its StoredRef list (`stored`).
import type { ErrorCode } from './values';

// A reference as typed: zero-based positions; absent rows mean whole columns, absent columns whole rows.
export type A1Ref = {
  sheet?: string;
  r1?: number;
  c1?: number;
  r2?: number;
  c2?: number;
  // Absolute bits as StoredRef.a: 1 r1, 2 c1, 4 r2, 8 c2.
  a: number;
  open?: 'r' | 'c';
  spill?: true;
  // Where the reference (with its sheet prefix and spill suffix) was in the source.
  start: number;
  end: number;
};

export type BinaryOp = '+' | '-' | '*' | '/' | '^' | '&' | '=' | '<>' | '<' | '>' | '<=' | '>=';

export type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'err'; v: ErrorCode }
  | { k: 'ref'; ref: A1Ref }
  | { k: 'stored'; i: number }
  | { k: 'name'; v: string }
  | { k: 'neg'; a: Node }
  | { k: 'pos'; a: Node }
  | { k: 'pct'; a: Node }
  | { k: 'bin'; op: BinaryOp; a: Node; b: Node }
  | { k: 'call'; name: string; args: (Node | null)[]; start: number; end: number }
  | { k: 'arr'; rows: Node[][] };

// Every reference in a tree, in source order.
export function refsOf(node: Node): A1Ref[] {
  return collectRefs(node, []).sort((x, y) => x.start - y.start);
}

function collectRefs(node: Node, out: A1Ref[]): A1Ref[] {
  switch (node.k) {
    case 'ref':
      out.push(node.ref);
      break;
    case 'neg':
    case 'pos':
    case 'pct':
      collectRefs(node.a, out);
      break;
    case 'bin':
      collectRefs(node.a, out);
      collectRefs(node.b, out);
      break;
    case 'call':
      for (const a of node.args) if (a) collectRefs(a, out);
      break;
    case 'arr':
      for (const row of node.rows) for (const x of row) collectRefs(x, out);
      break;
  }
  return out;
}

// Every function name called in a tree (upper case), for telemetry and card-function detection.
export function callsOf(node: Node, out: Set<string> = new Set()): Set<string> {
  switch (node.k) {
    case 'call':
      out.add(node.name);
      for (const a of node.args) if (a) callsOf(a, out);
      break;
    case 'neg':
    case 'pos':
    case 'pct':
      callsOf(node.a, out);
      break;
    case 'bin':
      callsOf(node.a, out);
      callsOf(node.b, out);
      break;
    case 'arr':
      for (const row of node.rows) for (const x of row) callsOf(x, out);
      break;
  }
  return out;
}
