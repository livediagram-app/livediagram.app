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
const REL_RE =
  /^([A-Za-z0-9_-]+)\s+(\|o|\|\||\}o|\}\|)(--|\.\.)(o\||\|\||o\{|\|\{)\s+([A-Za-z0-9_-]+)\s*(?::\s*(\S.*))?$/;
// `CUSTOMER {` opens an attribute block; `CUSTOMER {}` is an empty one.
const BLOCK_OPEN_RE = /^([A-Za-z0-9_-]+)\s*\{\s*(\})?$/;
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

  const touch = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, { id, label: id, fields: [] });
    return nodes.get(id)!;
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
      block = { id: open[1]!, attrs: [] };
      if (open[2]) closeBlock(); // `NAME {}` on one line
      continue;
    }

    const rel = REL_RE.exec(line);
    if (rel) {
      const from = touch(rel[1]!).id;
      const to = touch(rel[5]!).id;
      // Each table's cardinality as an ER end where the line meets it: the left token at the start, the right at
      // the end.
      const dashed = rel[3] === '..';
      // The verb alone: the ER ends say the multiplicity ("1 : 0..*" in words was there while the heads could only
      // say "many").
      const said = rel[6] ? decodeLabel(rel[6]).trim() : '';
      edges.push({
        from,
        to,
        ...(said ? { label: said } : {}),
        ...(dashed ? { line: 'dashed' as const } : {}),
        ends: 'both',
        er: { from: erEndOf(rel[2]!), to: erEndOf(rel[4]!) },
      });
      continue;
    }

    // A bare entity name declares it; anything else is decoration.
    if (/^[A-Za-z0-9_-]+$/.test(line)) touch(line);
  }
  closeBlock();

  if (nodes.size === 0) {
    return { ok: false, error: 'No entities found in the ER diagram.' };
  }
  return { ok: true, graph: { nodes: [...nodes.values()], edges }, direction };
}

// A cardinality token as an ER end: `||` one, `|o` / `o|` zero or one, `}|` / `|{` one or many, `}o` / `o{` zero or
// many.
function erEndOf(token: string): ErShape {
  const many = token.includes('{') || token.includes('}');
  const optional = token.includes('o');
  return many ? (optional ? 'zero-or-many' : 'one-or-many') : optional ? 'zero-or-one' : 'one';
}
