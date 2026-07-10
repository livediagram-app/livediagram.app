// Mermaid ER diagram -> DiagramGraph (spec/73). Import-only: entities are
// square boxes (attribute blocks fold into the label, one `type name` per
// line), relationships are edges whose cardinality maps onto arrow ends —
// a "many" side (crow's foot) gets the open-V head on that end, one-to-one
// renders headless, and non-identifying (dotted) relationships render
// dashed. Export always emits flowchart text.

import type { GraphEdge, GraphNode } from './graph-authoring';
import { cleanLine, decodeLabel, type ParseMermaidResult } from './mermaid-shared';

const HEADER_RE = /^erDiagram$/i;
// `CUSTOMER ||--o{ ORDER : places` — left tokens |o || }o }| , right tokens
// o| || o{ |{ , line -- (identifying) or .. (non-identifying).
const REL_RE =
  /^([A-Za-z0-9_-]+)\s+(\|o|\|\||\}o|\}\|)(--|\.\.)(o\||\|\||o\{|\|\{)\s+([A-Za-z0-9_-]+)\s*(?::\s*(.+))?$/;
// `CUSTOMER {` opens an attribute block; `CUSTOMER {}` is an empty one.
const BLOCK_OPEN_RE = /^([A-Za-z0-9_-]+)\s*\{\s*(\})?$/;
// `string name PK "comment"` — keep `type name`, drop keys + comments.
const ATTR_RE = /^([A-Za-z0-9_()[\]]+)\s+([A-Za-z0-9_-]+)/;

export function parseErDiagram(rawLines: string[]): ParseMermaidResult {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  let block: { id: string; attrs: string[] } | null = null;

  const touch = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, { id, label: id, shape: 'square' });
    return nodes.get(id)!;
  };

  const closeBlock = () => {
    if (!block) return;
    const n = touch(block.id);
    n.label = block.attrs.length ? [block.id, ...block.attrs].join('\n') : block.id;
    block = null;
  };

  for (const rawLine of rawLines) {
    const line = cleanLine(rawLine);
    if (!line) continue;
    if (HEADER_RE.test(line)) continue;

    if (block) {
      if (line === '}') {
        closeBlock();
        continue;
      }
      const attr = ATTR_RE.exec(line);
      if (attr) block.attrs.push(`${attr[1]} ${attr[2]}`);
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
      // Crow's foot = the "many" side: `}` on the left token, `{` on the
      // right. The open-V arrowhead points at each many side.
      const fromMany = rel[2]!.includes('}');
      const toMany = rel[4]!.includes('{');
      const ends: GraphEdge['ends'] =
        fromMany && toMany ? 'both' : toMany ? 'to' : fromMany ? 'from' : 'none';
      const dashed = rel[3] === '..';
      const label = rel[6] ? decodeLabel(rel[6]) : undefined;
      edges.push({
        from,
        to,
        ...(label ? { label } : {}),
        ...(dashed ? { line: 'dashed' as const } : {}),
        ends,
        ...(fromMany || toMany ? { head: 'cross' as const } : {}),
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
  // ER has no direction syntax; the layered TB flow reads best.
  return { ok: true, graph: { nodes: [...nodes.values()], edges }, direction: 'TB' };
}
