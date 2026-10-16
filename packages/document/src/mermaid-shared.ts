// Line + label plumbing shared by the Mermaid dialect parsers (docs/specs/020-import-export/mermaid.md):
// the flowchart parser (mermaid.ts), the state-diagram parser
// (mermaid-state.ts), and the ER parser (mermaid-er.ts) all clean lines,
// read id tokens, and decode labels the same way. Internal module, not
// re-exported from the package index — the public surface is parseMermaid.

import type { DiagramGraph, GraphCluster } from './graph-authoring';

export type MermaidDirection = 'TB' | 'LR';

export type ParseMermaidResult =
  // `folded`: subgraphs nested in another, folded into their outer one.
  | { ok: true; graph: DiagramGraph; direction: MermaidDirection; folded?: number }
  | { ok: false; error: string };

// TD/TB (and BT, folded) → TB; LR/RL → LR. Anything else → TB.
export function directionOf(token: string | undefined): MermaidDirection {
  const t = (token ?? '').toUpperCase();
  return t === 'LR' || t === 'RL' ? 'LR' : 'TB';
}

// Strip trailing %% comments and statement-terminating semicolons, then trim.
// A `%%` inside a double-quoted label is text, not a comment (Mermaid lexes a
// quoted string as one token), so `A["50%% done"]` keeps its label.
//
// Deliberately scans instead of using /%%.*$/ and /;+\s*$/. Both of those are
// unanchored, so on a line the tail doesn't match the engine retries from every
// offset, which is quadratic in the line length: a pasted diagram of a few
// thousand '%%' or ';' characters would lock the importing tab. Indexing and a
// reverse scan do the same job in one pass.
export function cleanLine(rawLine: string): string {
  const commentAt = commentStart(rawLine);
  const body = commentAt === -1 ? rawLine : rawLine.slice(0, commentAt);

  const trimmed = body.trim();
  let end = trimmed.length;
  while (end > 0 && trimmed.charCodeAt(end - 1) === SEMICOLON) end -= 1;
  return trimmed.slice(0, end).trim();
}

const SEMICOLON = ';'.charCodeAt(0);
const QUOTE = '"'.charCodeAt(0);
const PERCENT = '%'.charCodeAt(0);

// Index of the first `%%` outside a double-quoted run, or -1. One pass.
function commentStart(line: string): number {
  let quoted = false;
  for (let i = 0; i < line.length - 1; i += 1) {
    const c = line.charCodeAt(i);
    if (c === QUOTE) quoted = !quoted;
    else if (!quoted && c === PERCENT && line.charCodeAt(i + 1) === PERCENT) return i;
  }
  return -1;
}

// Mermaid's numeric entity code (`#124;` is `|`, `#37;` is `%`), as Mermaid
// itself decodes it; a number past Unicode stays as written.
function decodeEntityCode(code: string, digits: string): string {
  const n = Number(digits);
  return n <= 0x10ffff ? String.fromCodePoint(n) : code;
}

// Label text -> element label: strip surrounding quotes, turn <br> line
// breaks into real newlines, decode the entities the export emits.
export function decodeLabel(s: string): string {
  let t = s.trim();
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) t = t.slice(1, -1);
  return t
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&quot;/g, '"')
    .replace(/#(\d+);/g, decodeEntityCode)
    .replace(/&amp;/g, '&');
}

// Read the id token at the front (letters, digits, _, made of the chars
// Mermaid allows in a bare id). Returns null if none.
export function readId(s: string): { id: string; rest: string } | null {
  const m = /^\s*([A-Za-z0-9_]+)/.exec(s);
  return m ? { id: m[1]!, rest: s.slice(m[0].length) } : null;
}

// The clusters that become frames. An arrow may reference a cluster's id (it pins to the frame), and that mention
// auto-created a node with the id: drop it (unless a real node claimed it) so the id resolves to the frame. Only
// for a cluster that BECOMES a frame: an empty one (`subgraph X … end`, `state X { }`) is dropped, so deleting its
// node too would silently erase every arrow touching X. Its auto node stays and the arrows keep a target.
export function framedClusters(
  clusters: GraphCluster[],
  implicit: ReadonlySet<string>,
  nodes: Map<string, unknown>,
): GraphCluster[] {
  const surviving = new Set(clusters.filter((c) => c.members.length > 0).map((c) => c.id));
  for (const c of clusters) {
    if (surviving.has(c.id) && implicit.has(c.id) && nodes.has(c.id)) {
      nodes.delete(c.id);
      for (const other of clusters) other.members = other.members.filter((m) => m !== c.id);
    }
  }
  return clusters.filter((c) => c.members.length > 0);
}
