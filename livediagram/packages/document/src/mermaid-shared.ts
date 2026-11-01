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

// The statements of a Mermaid text, one a line. Mermaid ends a statement at a newline or a `;`, so
// `graph TD; A-->B; B-->C;` (the form its own docs often use) is three lines here. A `;` inside a label (quoted, in a
// node's brackets or an edge's `|…|`) is label text and never splits: our own export writes `#35;124;` there.
export function mermaidStatements(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    let start = 0;
    let quoted = false;
    let piped = false;
    let depth = 0;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (c === '"') quoted = !quoted;
      if (quoted) continue;
      if (c === '|') piped = !piped;
      else if (c === '[' || c === '(' || c === '{') depth += 1;
      else if (c === ']' || c === ')' || c === '}') depth = Math.max(0, depth - 1);
      else if (c === ';' && !piped && depth === 0) {
        out.push(raw.slice(start, i));
        start = i + 1;
      }
    }
    out.push(raw.slice(start));
  }
  return out;
}

// Mermaid's markdown string, `"\`**bold** text\`"`: the backticks and the emphasis marks are Mermaid's formatting,
// not the label's words.
export function plainMarkdownString(label: string): string {
  if (label.length < 2 || !label.startsWith('`') || !label.endsWith('`')) return label;
  return label
    .slice(1, -1)
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^*_\w])([*_])(\S(?:.*?\S)?)\2(?![*_\w])/g, '$1$3');
}
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
  // A blank quoted label (`n1[" "]`, how the export writes an unlabelled node) is no label.
  if (!t.trim()) return '';
  return plainMarkdownString(t)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&quot;/g, '"')
    .replace(/#(\d+);/g, decodeEntityCode)
    .replace(/&amp;/g, '&');
}

// Read the id token at the front (letters, digits, _, made of the chars
// Mermaid allows in a bare id). Letters and digits in any script, as Mermaid's
// own ids take them (`Ä --> Ö`, `开始 --> 结束`): ASCII only cut `node_é` to `node_`
// and dropped its edge. Returns null if none.
export function readId(s: string): { id: string; rest: string } | null {
  const m = /^\s*([\p{L}\p{M}\p{N}_]+)/u.exec(s);
  return m ? { id: m[1]!, rest: s.slice(m[0].length) } : null;
}

// Nested subgraphs and composite states fold into their top-level one (`foldedInto`: each folded id by the cluster it
// folded into). An edge naming a folded id would mint a stray box for it, so the box goes and the id is answered with
// the frame it folded into. A node written out under the id stays a node; so does the box when the outer cluster
// holds nothing else (it draws no frame, and the edge needs a target). Call before framedClusters.
export function foldedEdgeEnds(
  foldedInto: ReadonlyMap<string, string>,
  implicit: ReadonlySet<string>,
  nodes: Map<string, unknown>,
  clusters: GraphCluster[],
): Map<string, string> {
  // Clusters by id, looked up rather than scanned: a scan per folded id was quadratic in the clusters.
  const byId = new Map(clusters.map((c) => [c.id, c]));
  const strays = new Set<string>();
  for (const id of foldedInto.keys())
    if (implicit.has(id) && nodes.has(id) && !byId.has(id)) strays.add(id);
  const toFrame = new Map<string, string>();
  for (const id of strays) {
    const parent = foldedInto.get(id)!;
    const outer = byId.get(parent);
    if (!outer?.members.some((m) => !strays.has(m))) continue;
    toFrame.set(id, parent);
    nodes.delete(id);
  }
  if (toFrame.size) for (const c of clusters) c.members = c.members.filter((m) => !toFrame.has(m));
  return toFrame;
}

// Points each edge end that names a folded id at its frame, by the frame's final id (`frameId`, for a frame renamed
// beside a node of its id).
export function pointEdgesAtFrames(
  edges: { from: string; to: string }[],
  toFrame: ReadonlyMap<string, string>,
  frameId: (clusterId: string) => string = (id) => id,
): void {
  if (!toFrame.size) return;
  const end = (id: string) => {
    const parent = toFrame.get(id);
    return parent === undefined ? id : frameId(parent);
  };
  for (const e of edges) {
    e.from = end(e.from);
    e.to = end(e.to);
  }
}

// The clusters that become frames. An arrow may reference a cluster's id (it pins to the frame), and that mention
// auto-created a node with the id: drop it (unless a real node claimed it) so the id resolves to the frame. Only
// for a cluster that BECOMES a frame: an empty one (`subgraph X … end`, `state X { }`) is dropped, so deleting its
// node too would silently erase every arrow touching X. Its auto node stays and the arrows keep a target, under the
// cluster's title: left as its id, an exported empty frame "Backend" came back as a box reading "s1".
export function framedClusters(
  clusters: GraphCluster[],
  implicit: ReadonlySet<string>,
  nodes: Map<string, { label?: string }>,
): GraphCluster[] {
  const surviving = new Set(clusters.filter((c) => c.members.length > 0).map((c) => c.id));
  // The auto nodes that give way to their frames, taken out of every cluster in one pass at the end: a pass over
  // every cluster for each one was quadratic, 20 s for 20,000 composite states each named by a transition.
  const framedIds = new Set<string>();
  for (const c of clusters) {
    const auto = !surviving.has(c.id) && implicit.has(c.id) ? nodes.get(c.id) : undefined;
    if (auto && c.label) auto.label = c.label;
    if (surviving.has(c.id) && implicit.has(c.id) && nodes.has(c.id)) {
      nodes.delete(c.id);
      framedIds.add(c.id);
    }
  }
  if (framedIds.size)
    for (const c of clusters) c.members = c.members.filter((m) => !framedIds.has(m));
  return clusters.filter((c) => c.members.length > 0);
}
