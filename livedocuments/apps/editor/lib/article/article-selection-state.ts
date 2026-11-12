// The selection's state for the page toolbar (docs/specs/007-editor/article-pages.md "The page toolbar"):
// which formats and block style it has, and whether its table has a header row. Re-exported from
// article-commands.ts.
import type { Mark } from 'prosemirror-model';
import { NodeSelection, type EditorState } from 'prosemirror-state';
import { isInTable } from 'prosemirror-tables';
import type { ArticleAlign, ArticleListKind, ArticleParagraphStyle } from '@livedocuments/document';
import { CODE, LIST, PARAGRAPH, S, isTextBlock, selectedBlocks } from './article-block-commands';

/** Which formats and block style the selection has, for the toolbar's pressed states. */
export type ArticleSelectionState = {
  style: ArticleParagraphStyle | 'code' | 'list' | null;
  list: ArticleListKind | null;
  align: ArticleAlign | null;
  marks: Set<string>;
  link: string | null;
  color: string | null;
  highlight: string | null;
  inText: boolean;
  // The zone selected as a whole in the writing, if one is.
  zoneId: string | null;
  // Text is selected (what a margin note goes on).
  hasText: boolean;
  // The selection is in a table's cells (the Table menu shows), and that table has its header row on.
  inTable: boolean;
  tableHeader: boolean;
};

/** Whether two selection states show the same toolbar. */
export function sameSelectionState(a: ArticleSelectionState, b: ArticleSelectionState): boolean {
  return (
    a.style === b.style &&
    a.list === b.list &&
    a.align === b.align &&
    a.link === b.link &&
    a.color === b.color &&
    a.highlight === b.highlight &&
    a.inText === b.inText &&
    a.zoneId === b.zoneId &&
    a.hasText === b.hasText &&
    a.inTable === b.inTable &&
    a.tableHeader === b.tableHeader &&
    a.marks.size === b.marks.size &&
    [...a.marks].every((m) => b.marks.has(m))
  );
}

/** Whether the table around the selection has its header row on (every cell of its first row a header
 *  cell): the Table menu's Header Row. False outside a table. */
export function tableHasHeader(state: EditorState): boolean {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type !== S.nodes.table) continue;
    const first = node.firstChild;
    let all = !!first && first.childCount > 0;
    first?.forEach((cell) => {
      if (cell.type !== S.nodes.table_header) all = false;
    });
    return all;
  }
  return false;
}

export function selectionStateOf(state: EditorState): ArticleSelectionState {
  const blocks = selectedBlocks(state);
  const first = blocks[0]?.node;
  const marks = new Set<string>();
  const { from, to, empty, $from } = state.selection;
  const active = empty ? (state.storedMarks ?? $from.marks()) : [];
  let link: string | null = null;
  let color: string | null = null;
  let highlight: string | null = null;
  const take = (m: Mark) => {
    marks.add(m.type.name);
    if (m.type.name === 'link') link = m.attrs.href as string;
    if (m.type.name === 'color') color = m.attrs.color as string;
    if (m.type.name === 'highlight') highlight = m.attrs.color as string;
  };
  if (empty) active.forEach(take);
  else {
    // A mark counts as on when every text in the selection has it.
    const counts = new Map<string, number>();
    let texts = 0;
    state.doc.nodesBetween(from, to, (node) => {
      if (!node.isText) return;
      texts++;
      for (const m of node.marks) {
        counts.set(m.type.name, (counts.get(m.type.name) ?? 0) + 1);
        if (m.type.name === 'link') link = m.attrs.href as string;
        if (m.type.name === 'color') color = m.attrs.color as string;
        if (m.type.name === 'highlight') highlight = m.attrs.color as string;
      }
    });
    for (const [name, n] of counts) if (n === texts) marks.add(name);
  }
  return {
    style: !first
      ? null
      : first.type === LIST
        ? 'list'
        : first.type === CODE
          ? 'code'
          : first.type === PARAGRAPH
            ? (first.attrs.style as ArticleParagraphStyle)
            : null,
    hasText:
      !state.selection.empty &&
      state.doc.textBetween(state.selection.from, state.selection.to).trim() !== '',
    list: first?.type === LIST ? (first.attrs.list as ArticleListKind) : null,
    align: first && isTextBlock(first) ? (first.attrs.align as ArticleAlign) : null,
    marks,
    link,
    color,
    highlight,
    inText: !!first && (isTextBlock(first) || first.type === CODE),
    inTable: isInTable(state),
    tableHeader: tableHasHeader(state),
    zoneId:
      state.selection instanceof NodeSelection && state.selection.node.type === S.nodes.zone
        ? (state.selection.node.attrs.id as string)
        : null,
  };
}
