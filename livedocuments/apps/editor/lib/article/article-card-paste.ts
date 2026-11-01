// A paste onto a flashcard, cut to what a card holds (docs/specs/007-editor/flashcards.md "Text only"):
// a pasted table becomes a list, a row a bulleted item with its cells joined by " · " and the header
// row's text bold (as an agent's table on a card is written, flashcardCut), and a page break, a zone
// or a contents block is left out. Only those at the paste's top level are touched; anything else
// comes back as it was. Pasted nodes have no block ids yet (the editor gives them theirs), so the
// table is read here as editor nodes, never through the stored blocks.
import { Fragment, Slice, type Node as PMNode } from 'prosemirror-model';
import { articleSchema } from './article-schema';

const NOT_ON_A_CARD = new Set(['table', 'toc', 'page_break', 'zone']);
const JOIN = ' · ';

function tableAsItems(table: PMNode): PMNode[] {
  const bold = articleSchema.marks.bold;
  const items: PMNode[] = [];
  table.forEach((row, _o, r) => {
    const header =
      r === 0 && row.childCount > 0 && row.firstChild!.type === articleSchema.nodes.table_header;
    const inline: PMNode[] = [];
    row.forEach((cell, _c, c) => {
      if (c > 0) inline.push(articleSchema.text(JOIN));
      cell.forEach((n) =>
        inline.push(header && n.isText ? n.mark(bold.create().addToSet(n.marks)) : n),
      );
    });
    items.push(articleSchema.nodes.list_item.create({ list: 'bullet' }, inline));
  });
  return items;
}

/** `slice` as a card takes it, with whether anything was cut (`cut`), to say so once. */
export function cardPasteSlice(slice: Slice): { slice: Slice; cut: boolean } {
  let touched = false;
  slice.content.forEach((n) => {
    if (NOT_ON_A_CARD.has(n.type.name)) touched = true;
  });
  if (!touched) return { slice, cut: false };
  const nodes: PMNode[] = [];
  slice.content.forEach((n) => {
    if (!NOT_ON_A_CARD.has(n.type.name)) nodes.push(n);
    else if (n.type.name === 'table') nodes.push(...tableAsItems(n));
  });
  // The ends stay open only where the node there is the one the paste opened with (a table pasted
  // whole opens three deep, into its first cell): its items come closed, whole blocks of their own.
  const first = slice.content.firstChild;
  const last = slice.content.lastChild;
  const openStart = nodes[0] === first ? slice.openStart : 0;
  const openEnd = nodes.at(-1) === last ? slice.openEnd : 0;
  return { slice: new Slice(Fragment.from(nodes), openStart, openEnd), cut: true };
}
