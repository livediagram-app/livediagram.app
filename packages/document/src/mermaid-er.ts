// Mermaid ER diagram -> DiagramGraph (docs/specs/020-import-export/mermaid.md). Import-only: entities are
// Entity elements (the name is the title, each attribute a field row with its
// type and any PK / FK / UK marker as the row's type text), relationships are edges whose cardinality is an ER end
// at each table (one, zero or one, one or many, zero or many), and non-identifying (dotted) relationships render
// dashed. Export always emits flowchart text.

import type { EntityField } from './data-shapes';
import type { ErShape } from './er-heads';
import { hubFirst } from './er-hub-first';
import type { GraphEdge, GraphNode } from './graph-authoring';
import {
  cleanLine,
  decodeLabel,
  directionOf,
  type MermaidDirection,
  type ParseMermaidResult,
} from './mermaid-shared';

const HEADER_RE = /^erDiagram$/i;
// A name: letters, digits, `_` and `-`, or anything in double quotes (`"Order line"`, Mermaid's way of naming an
// entity with spaces). Then an optional alias in square brackets (`BOOK_AUTHOR[Book author]`, the title shown) and an
// optional `:::class`, which is styling and skipped. Three groups: the bare name, the quoted name, the alias.
const NAME = String.raw`(?:([A-Za-z0-9_-]+)|"([^"]+)")(?:\[([^\]]*)\])?(?::::[A-Za-z0-9_-]+)?`;
// `CUSTOMER ||--o{ ORDER : places` — left tokens |o || }o }| , right tokens
// o| || o{ |{ , line -- (identifying) or .. (non-identifying), with or without spaces round it (`id1||--||id2`).
// The label is `(\S.*)` rather than `(.+)`: after `\s*` the two both match a
// space, and that overlap is what makes a failed match backtrack quadratically.
const REL_RE = new RegExp(
  String.raw`^${NAME}\s*(\|o|\|\||\}o|\}\|)(--|\.\.)(o\||\|\||o\{|\|\{)\s*${NAME}\s*(?::\s*(\S.*))?$`,
);
// The words Mermaid allows for a cardinality, each read as its symbol.
const CARD_WORDS = String.raw`only one|1|zero or one|one or zero|zero or more|zero or many|many\(0\)|0\+|one or more|one or many|many\(1\)|1\+`;
// `CAR 1 to zero or more NAMED-DRIVER : allows`: the word form, `to` identifying, `optionally to` not.
const REL_WORDS_RE = new RegExp(
  String.raw`^${NAME}\s+(${CARD_WORDS})\s+(to|optionally to)\s+(${CARD_WORDS})\s+${NAME}\s*(?::\s*(\S.*))?$`,
  'i',
);
// `CUSTOMER {` opens an attribute block; `CUSTOMER {}` is an empty one.
const BLOCK_OPEN_RE = new RegExp(String.raw`^${NAME}\s*\{\s*(\})?$`);
// A bare entity name declares it.
const BARE_RE = new RegExp(String.raw`^${NAME}$`);
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
      const id = nameOf(open, 1);
      touch(id, open[3]);
      block = { id, attrs: [] };
      if (open[4]) closeBlock(); // `NAME {}` on one line
      continue;
    }

    const rel = REL_RE.exec(line);
    const words = rel ? null : REL_WORDS_RE.exec(line);
    if (rel || words) {
      // The two forms put the same parts in the same order: left name, left end, line, right end, right name, label.
      const m = (rel ?? words)!;
      const from = touch(nameOf(m, 1), m[3]).id;
      const to = touch(nameOf(m, 7), m[9]).id;
      // Each table's cardinality as an ER end where the line meets it: the left token at the start, the right at
      // the end.
      const dashed = rel ? m[5] === '..' : m[5]!.toLowerCase() !== 'to';
      const endOf = rel ? erEndOf : erEndOfWords;
      // The verb alone: the ER ends say the multiplicity ("1 : 0..*" in words was there while the heads could only
      // say "many").
      const said = m[10] ? decodeLabel(m[10]).trim() : '';
      edges.push({
        from,
        to,
        ...(said ? { label: said } : {}),
        ...(dashed ? { line: 'dashed' as const } : {}),
        ends: 'both',
        er: { from: endOf(m[4]!), to: endOf(m[6]!) },
      });
      continue;
    }

    // A bare entity name declares it; anything else is decoration.
    const bare = BARE_RE.exec(line);
    if (bare) touch(nameOf(bare, 1), bare[3]);
  }
  closeBlock();

  if (nodes.size === 0) {
    return { ok: false, error: 'No entities found in the ER diagram.' };
  }
  return {
    ok: true,
    graph: { nodes: [...nodes.values()], edges: hubFirst([...nodes.keys()], edges) },
    direction,
  };
}

// A cardinality token as an ER end: `||` one, `|o` / `o|` zero or one, `}|` / `|{` one or many, `}o` / `o{` zero or
// many.
function erEndOf(token: string): ErShape {
  const many = token.includes('{') || token.includes('}');
  const optional = token.includes('o');
  return many ? (optional ? 'zero-or-many' : 'one-or-many') : optional ? 'zero-or-one' : 'one';
}

// The entity a NAME's groups (bare at `at`, quoted at `at + 1`) name.
function nameOf(m: RegExpExecArray, at: number): string {
  return m[at] ?? m[at + 1]!.trim();
}

// A cardinality in Mermaid's words as an ER end, as its symbol reads (`1` / `only one` one, `zero or one` zero or
// one, `zero or more` zero or many, `one or more` one or many, and their spellings).
function erEndOfWords(words: string): ErShape {
  const w = words.toLowerCase().replace(/\s+/g, ' ');
  if (w === '1' || w === 'only one') return 'one';
  if (w === 'zero or one' || w === 'one or zero') return 'zero-or-one';
  if (w === 'one or more' || w === 'one or many' || w === 'many(1)' || w === '1+')
    return 'one-or-many';
  return 'zero-or-many';
}
