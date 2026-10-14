// Mermaid ER diagram -> DiagramGraph (docs/specs/020-import-export/mermaid.md). Import-only: entities are
// Entity elements (the name is the title, each attribute a field row with its
// type and any PK / FK / UK marker as the row's type text), relationships are edges whose cardinality is an ER end
// at each table (one, zero or one, one or many, zero or many), and non-identifying (dotted) relationships render
// dashed. Export always emits flowchart text.

import type { EntityField } from './data-shapes';
import type { ErShape } from './er-heads';
import type { GraphEdge, GraphNode } from './graph-authoring';
import {
  cleanLine,
  decodeLabel,
  directionOf,
  type MermaidDirection,
  type ParseMermaidResult,
} from './mermaid-shared';

const HEADER_RE = /^erDiagram$/i;
// `CUSTOMER ||--o{ ORDER : places` — left tokens |o || }o }| , right tokens
// o| || o{ |{ , line -- (identifying) or .. (non-identifying).
// The label is `(\S.*)` rather than `(.+)`: after `\s*` the two both match a
// space, and that overlap is what makes a failed match backtrack quadratically.
// Each name may carry an alias in square brackets (`BOOK_AUTHOR[Book author]`), the title shown.
const REL_RE =
  /^([A-Za-z0-9_-]+)(?:\[([^\]]*)\])?\s+(\|o|\|\||\}o|\}\|)(--|\.\.)(o\||\|\||o\{|\|\{)\s+([A-Za-z0-9_-]+)(?:\[([^\]]*)\])?\s*(?::\s*(\S.*))?$/;
// `CUSTOMER {` opens an attribute block; `CUSTOMER {}` is an empty one.
const BLOCK_OPEN_RE = /^([A-Za-z0-9_-]+)(?:\[([^\]]*)\])?\s*\{\s*(\})?$/;
// A bare entity line, with an optional alias.
const BARE_RE = /^([A-Za-z0-9_-]+)(?:\[([^\]]*)\])?$/;
// `string name PK, FK "comment"` — keep the type, name and key markers, drop
// the comment.
const ATTR_RE =
  /^([A-Za-z0-9_()[\]]+)\s+([A-Za-z0-9_-]+)(?:\s+((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*))?/;

export function parseErDiagram(rawLines: string[]): ParseMermaidResult {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  let block: { id: string; attrs: EntityField[] } | null = null;
  // Mermaid's `direction` line (TB by default, the layered flow that reads best).
  let direction: MermaidDirection = 'TB';

  // An alias, quoted or not, is the title; the first one given wins.
  const aliased = new Set<string>();
  const touch = (id: string, alias?: string) => {
    if (!nodes.has(id)) nodes.set(id, { id, label: id, fields: [] });
    const node = nodes.get(id)!;
    const title = alias
      ?.trim()
      .replace(/^"(.*)"$/, '$1')
      .trim();
    if (title && !aliased.has(id)) {
      node.label = decodeLabel(title);
      aliased.add(id);
    }
    return node;
  };

  const closeBlock = () => {
    if (!block) return;
    touch(block.id).fields = block.attrs;
    block = null;
  };

  for (const rawLine of rawLines) {
    const line = cleanLine(rawLine);
    if (!line) continue;
    if (HEADER_RE.test(line)) continue;
    const dir = !block && /^direction\s+([A-Za-z]{2})$/i.exec(line);
    if (dir) {
      direction = directionOf(dir[1]);
      continue;
    }

    if (block) {
      if (line === '}') {
        closeBlock();
        continue;
      }
      const attr = ATTR_RE.exec(line);
      if (attr) {
        const keys = attr[3]?.replace(/\s+/g, '');
        block.attrs.push({ name: attr[2]!, type: keys ? `${attr[1]} ${keys}` : attr[1]! });
      }
      continue;
    }

    const open = BLOCK_OPEN_RE.exec(line);
    if (open) {
      touch(open[1]!, open[2]);
      block = { id: open[1]!, attrs: [] };
      if (open[3]) closeBlock(); // `NAME {}` on one line
      continue;
    }

    const rel = REL_RE.exec(line);
    if (rel) {
      const from = touch(rel[1]!, rel[2]).id;
      const to = touch(rel[6]!, rel[7]).id;
      // Each table's cardinality as an ER end where the line meets it: the left token at the start, the right at
      // the end.
      const dashed = rel[4] === '..';
      // The verb alone: the ER ends say the multiplicity ("1 : 0..*" in words was there while the heads could only
      // say "many").
      const said = rel[8] ? decodeLabel(rel[8]).trim() : '';
      edges.push({
        from,
        to,
        ...(said ? { label: said } : {}),
        ...(dashed ? { line: 'dashed' as const } : {}),
        ends: 'both',
        er: { from: erEndOf(rel[3]!), to: erEndOf(rel[5]!) },
      });
      continue;
    }

    // A bare entity name declares it; anything else is decoration.
    const bare = BARE_RE.exec(line);
    if (bare) touch(bare[1]!, bare[2]);
  }
  closeBlock();

  if (nodes.size === 0) {
    return { ok: false, error: 'No entities found in the ER diagram.' };
  }
  return {
    ok: true,
    graph: { nodes: [...nodes.values()], edges: hubFirst(nodes, edges) },
    direction,
  };
}

// Relationships oriented away from the best-connected entity, by distance from it, so the layered layout ranks the
// hub first and its neighbours round it, not the hub last with every line reaching back to it. A relationship has an
// end at each table, so flipping one (its ER ends swapped with it) draws the same thing.
function hubFirst(nodes: Map<string, GraphNode>, edges: GraphEdge[]): GraphEdge[] {
  const near = new Map<string, string[]>([...nodes.keys()].map((id) => [id, []]));
  for (const e of edges) {
    if (e.from === e.to) continue;
    near.get(e.from)!.push(e.to);
    near.get(e.to)!.push(e.from);
  }
  const rank = new Map<string, number>();
  const byDegree = [...nodes.keys()].sort((a, b) => near.get(b)!.length - near.get(a)!.length);
  for (const root of byDegree) {
    if (rank.has(root)) continue;
    rank.set(root, 0);
    const queue = [root];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i]!;
      for (const next of near.get(id)!)
        if (!rank.has(next)) {
          rank.set(next, rank.get(id)! + 1);
          queue.push(next);
        }
    }
  }
  return edges.map((e) =>
    rank.get(e.from)! > rank.get(e.to)!
      ? {
          ...e,
          from: e.to,
          to: e.from,
          ...(e.er ? { er: { from: e.er.to, to: e.er.from } } : {}),
        }
      : e,
  );
}

// A cardinality token as an ER end: `||` one, `|o` / `o|` zero or one, `}|` / `|{` one or many, `}o` / `o{` zero or
// many.
function erEndOf(token: string): ErShape {
  const many = token.includes('{') || token.includes('}');
  const optional = token.includes('o');
  return many ? (optional ? 'zero-or-many' : 'one-or-many') : optional ? 'zero-or-one' : 'one';
}
