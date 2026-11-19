// The writing's structure for a PDF's tags (liveworkspace/docs/specs/013-export/vector-pdf.md "Tags"): each block
// the words of the writing belong to, numbered in reading order, with its tag path. The writing is flat (a list item
// is a block with a level, docs/specs/007-editor/article-pages.md "Blocks"), so its lists are rebuilt here: a run of
// list items is one list (L), a deeper level a list inside its item's body (LBody), a change of kind at one level a
// new list. A table's cells sit in their rows (Table, TR, TH or TD), a quote is a BlockQuote, a heading H1 to H6
// (the title is H1, Heading 1 is H2, as on screen), any other block a paragraph.

// The blocks a word can belong to.
const BLOCKS = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, td, th';

export type BlockTag = { tag: string; block: number };

export type BlockTagger = {
  /** Numbers every block under `root` in document order, the reading order, after any numbered before (the
   *  writing, then its notes). */
  scan: (root: Element) => void;
  /** The block `el` is in, or null outside every block. A block no scan reached is numbered when first met. */
  of: (el: Element | null) => BlockTag | null;
  /** A list item's marker: the item's label (Lbl), beside its body. Any other block's tag is kept. */
  marker: (tag: BlockTag) => BlockTag;
};

type OpenList = { level: number; kind: string; key: string; item: number };

export function blockTagger(): BlockTagger {
  const tags = new Map<Element, BlockTag>();
  const ids = new Map<Element, number>();
  const idOf = (el: Element) => {
    let n = ids.get(el);
    if (n === undefined) ids.set(el, (n = ids.size));
    return n;
  };
  // The lists open at the last block, outermost first.
  let lists: OpenList[] = [];
  let listCount = 0;

  const listPath = (li: Element, n: number): string => {
    const level = Number(li.getAttribute('data-level')) || 0;
    const kind = li.getAttribute('data-article-list') ?? '';
    while (lists.length && lists[lists.length - 1]!.level > level) lists.pop();
    const same = lists[lists.length - 1];
    if (same && same.level === level && same.kind !== kind) lists.pop();
    const open = lists[lists.length - 1];
    if (!open || open.level < level) lists.push({ level, kind, key: `l${listCount++}`, item: n });
    lists[lists.length - 1]!.item = n;
    // Each outer list's current item holds the next list in its body, the key its block's own.
    return lists
      .map((l, i) =>
        i < lists.length - 1
          ? `L#${l.key}/LI#i${l.item}/LBody#${l.item}`
          : `L#${l.key}/LI#i${n}/LBody`,
      )
      .join('/');
  };

  const pathOf = (block: Element, n: number): string => {
    const name = block.tagName;
    if (name === 'LI') return listPath(block, n);
    lists = [];
    if (/^H[1-6]$/.test(name)) return name;
    if (name === 'BLOCKQUOTE') return 'BlockQuote';
    if (name === 'TD' || name === 'TH') {
      const table = block.closest('table');
      const row = block.closest('tr');
      return `${table ? `Table#t${idOf(table)}/` : ''}${row ? `TR#r${idOf(row)}/` : ''}${name}`;
    }
    return 'P';
  };

  const number = (block: Element): BlockTag => {
    const n = tags.size;
    const tag = { tag: pathOf(block, n), block: n };
    tags.set(block, tag);
    return tag;
  };

  return {
    scan(root) {
      lists = [];
      for (const block of root.querySelectorAll(BLOCKS)) if (!tags.has(block)) number(block);
    },
    of(el) {
      const block = el?.closest(BLOCKS);
      if (!block) return null;
      return tags.get(block) ?? number(block);
    },
    marker(tag) {
      return tag.tag.endsWith('/LBody')
        ? { tag: `${tag.tag.slice(0, -'LBody'.length)}Lbl#m${tag.block}`, block: tag.block }
        : tag;
    },
  };
}
