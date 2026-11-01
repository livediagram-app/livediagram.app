// The writing's table commands (docs/specs/007-editor/article-pages.md "Tables"): putting a table in,
// its rows and columns from the page toolbar's Table menu, the header row, and the keys inside a cell.
// prosemirror-tables does the cell work; these keep a table inside its limits, keep its columns' ids
// and shares (`cols`) in step with the cells it adds or removes, and keep cells from running together.
import { Fragment, type Node as PMNode } from 'prosemirror-model';
import {
  Selection,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import { GapCursor } from 'prosemirror-gapcursor';
import {
  CellSelection,
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteCellSelection,
  deleteColumn,
  deleteRow,
  deleteTable,
  goToNextCell,
  isInTable,
  selectedRect,
  TableMap,
  toggleHeader,
} from 'prosemirror-tables';
import {
  MAX_ARTICLE_TABLE_COLS,
  MAX_ARTICLE_TABLE_ROWS,
  newArticleTable,
  nextTablePartId,
  normaliseShares,
  type ArticleTableColumn,
} from '@livedocuments/document';
import { articleSchema } from './article-schema';
import { blocksToDoc } from './article-convert';
import { insertBlocksAfterCaret } from './article-commands';

const S = articleSchema;

export type TableCommandName =
  | 'rowAbove'
  | 'rowBelow'
  | 'colLeft'
  | 'colRight'
  | 'deleteRow'
  | 'deleteCol'
  | 'header'
  | 'deleteTable';

/** Whether the selection is in a table cell (a caret, a text selection or a cell selection). */
export const inTableCell = (state: EditorState): boolean => isInTable(state);

/** The table around the selection: its node, its position and its columns. */
function tableAt(state: EditorState): { node: PMNode; pos: number } | null {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type === S.nodes.table) return { node, pos: $from.before(d) };
  }
  return null;
}

const colsOf = (node: PMNode): ArticleTableColumn[] =>
  Array.isArray(node.attrs.cols) ? (node.attrs.cols as ArticleTableColumn[]) : [];

const hasHeader = (table: PMNode): boolean => {
  const first = table.firstChild;
  if (!first || first.childCount === 0) return false;
  let all = true;
  first.forEach((cell) => {
    if (cell.type !== S.nodes.table_header) all = false;
  });
  return all;
};

/** Columns with one added at `at`, taking an equal share (the others giving it room in proportion). */
export function colsWithAdded(
  cols: readonly ArticleTableColumn[],
  at: number,
): ArticleTableColumn[] {
  const n = cols.length + 1;
  const taken = new Set(cols.map((c) => c.id));
  const next = [...cols];
  next.splice(at, 0, { id: nextTablePartId('c', taken), w: 1 / n });
  const shares = normaliseShares(next.map((c, i) => (i === at ? 1 / n : c.w * (1 - 1 / n))));
  return next.map((c, i) => ({ id: c.id, w: shares[i]! }));
}

/** Columns with `[from, to)` removed, the rest sharing the room in proportion. */
export function colsWithRemoved(
  cols: readonly ArticleTableColumn[],
  from: number,
  to: number,
): ArticleTableColumn[] {
  const kept = cols.filter((_, i) => i < from || i >= to);
  const shares = normaliseShares(kept.map((c) => c.w));
  return kept.map((c, i) => ({ id: c.id, w: shares[i]! }));
}

// A prosemirror-tables command run on a transaction we keep, so the columns can follow in the same step.
function capture(command: Command, state: EditorState): Transaction | null {
  let out: Transaction | null = null;
  command(state, (tr) => {
    out = tr;
  });
  return out;
}

// The table's `cols` set in `tr`, at the table now standing where it stood.
function setCols(tr: Transaction, pos: number, cols: ArticleTableColumn[]): void {
  const at = tr.mapping.map(pos);
  if (tr.doc.nodeAt(at)?.type === S.nodes.table) tr.setNodeAttribute(at, 'cols', cols);
}

/** Why a table command is unavailable (its tooltip), or null when it may run. */
export function tableCommandBlock(state: EditorState, name: TableCommandName): string | null {
  const table = tableAt(state);
  if (!table || !isInTable(state)) return 'Put the caret in a table first';
  const rect = selectedRect(state);
  if (
    (name === 'rowAbove' || name === 'rowBelow') &&
    table.node.childCount >= MAX_ARTICLE_TABLE_ROWS
  )
    return `A table holds at most ${MAX_ARTICLE_TABLE_ROWS} rows`;
  if ((name === 'colLeft' || name === 'colRight') && rect.map.width >= MAX_ARTICLE_TABLE_COLS)
    return `A table holds at most ${MAX_ARTICLE_TABLE_COLS} columns`;
  if (name === 'rowAbove' && rect.top === 0 && hasHeader(table.node))
    return 'The header row stays first';
  return null;
}

/** One of the Table menu's commands, one transaction. Deleting a table's last row or column deletes
 *  the table. */
export function tableCommand(name: TableCommandName): Command {
  return (state, dispatch) => {
    if (tableCommandBlock(state, name) !== null) return false;
    const table = tableAt(state)!;
    const rect = selectedRect(state);
    const cols = colsOf(table.node);
    const run = (command: Command, after?: (tr: Transaction) => void): boolean => {
      const tr = capture(command, state);
      if (!tr) return false;
      after?.(tr);
      dispatch?.(tr.scrollIntoView());
      return true;
    };
    switch (name) {
      case 'rowAbove':
        return run(addRowBefore);
      case 'rowBelow':
        return run(addRowAfter);
      case 'colLeft':
        return run(addColumnBefore, (tr) => setCols(tr, table.pos, colsWithAdded(cols, rect.left)));
      case 'colRight':
        return run(addColumnAfter, (tr) => setCols(tr, table.pos, colsWithAdded(cols, rect.right)));
      case 'deleteRow':
        return rect.top === 0 && rect.bottom === rect.map.height
          ? run(deleteTable)
          : run(deleteRow);
      case 'deleteCol':
        return rect.left === 0 && rect.right === rect.map.width
          ? run(deleteTable)
          : run(deleteColumn, (tr) =>
              setCols(tr, table.pos, colsWithRemoved(cols, rect.left, rect.right)),
            );
      case 'header':
        return run(toggleHeader('row'));
      case 'deleteTable':
        return run(deleteTable);
    }
  };
}

/** A new table at the caret (the slash menu's and Insert's Table): three by three, the header row on,
 *  the caret in its first cell. */
export const insertTable: Command = (state, dispatch) => {
  if (isInTable(state)) return false;
  const node = blocksToDoc([newArticleTable('', 3, 3, true)]).firstChild!;
  return insertBlocksAfterCaret([node, S.nodes.paragraph.create()])(state, (tr) => {
    // The caret lands in the paragraph after the table: into the table's first cell instead.
    const tablePos = tr.selection.$from.before(1) - node.nodeSize;
    if (tr.doc.nodeAt(tablePos)?.type === S.nodes.table)
      tr.setSelection(TextSelection.create(tr.doc, tablePos + 3));
    dispatch?.(tr);
  });
};

const cellDepth = (state: EditorState): number | null => {
  const { $from } = state.selection;
  const t = $from.parent.type;
  return t === S.nodes.table_cell || t === S.nodes.table_header ? $from.depth : null;
};

/** Tab in a cell: the next cell; in the last cell, a new row (`reshape`) or nothing. Shift+Tab: the cell
 *  before. False outside a table. */
export function tableTab(dir: 1 | -1, reshape: () => boolean): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) return false;
    if (goToNextCell(dir)(state, dispatch)) return true;
    if (dir === -1 || !reshape() || tableCommandBlock(state, 'rowBelow') !== null) return true;
    // The last cell: a row after it, the caret into its first cell.
    const table = tableAt(state)!;
    const rect = selectedRect(state);
    const tr = capture(addRowAfter, state);
    const grown = tr?.doc.nodeAt(table.pos);
    if (!tr || !grown) return true;
    let row = table.pos + 1;
    for (let i = 0; i < rect.bottom; i++) row += grown.child(i).nodeSize;
    tr.setSelection(TextSelection.create(tr.doc, row + 2));
    dispatch?.(tr.scrollIntoView());
    return true;
  };
}

// Below a table: the first place to write after it, or, with nothing after it (a table ending the
// writing, whose top level takes a gap cursor), the gap after it, where typing starts a paragraph as
// Right does. Selection.near found nothing below and fell back into the table's last cell, so Down
// never left it.
function outBelow(state: EditorState, after: number): Selection {
  const $after = state.doc.resolve(after);
  return Selection.findFrom($after, 1) ?? new GapCursor($after);
}

/** Up and Down from a cell's first or last line: the cell above or below in the same column, or out of the
 *  table before or after it. (prosemirror-tables' own arrows expect blocks in a cell; a cell here is one
 *  stretch of text.) */
export function cellArrow(dir: 1 | -1): Command {
  return (state, dispatch, view) => {
    const sel = state.selection;
    if (!view || !(sel instanceof TextSelection) || !sel.empty) return false;
    const depth = cellDepth(state);
    if (depth === null || !view.endOfTextblock(dir > 0 ? 'down' : 'up')) return false;
    const $h = sel.$head;
    const table = $h.node(depth - 2);
    const tableStart = $h.start(depth - 2);
    const next = TableMap.get(table).nextCell($h.before(depth) - tableStart, 'vert', dir);
    const target =
      next !== null
        ? TextSelection.create(state.doc, tableStart + next + 1)
        : dir > 0
          ? outBelow(state, $h.after(depth - 2))
          : Selection.near(state.doc.resolve($h.before(depth - 2)), -1);
    dispatch?.(state.tr.setSelection(target).scrollIntoView());
    return true;
  };
}

/** Enter in a cell: a line break (a cell is one stretch of text). */
export const cellEnter: Command = (state, dispatch) => {
  if (cellDepth(state) === null) return false;
  dispatch?.(state.tr.replaceSelectionWith(S.nodes.hard_break.create()).scrollIntoView());
  return true;
};

/** Backspace at a cell's start (or Delete at its end): nothing, so cells never run together. A cell
 *  selection is emptied instead. */
export function cellEdge(edge: 'start' | 'end'): Command {
  return (state, dispatch) => {
    if (state.selection instanceof CellSelection) return deleteCellSelection(state, dispatch);
    if (cellDepth(state) === null) return false;
    const { $from, empty } = state.selection;
    if (!empty) return false;
    const at = edge === 'start' ? 0 : $from.parent.content.size;
    return $from.parentOffset === at;
  };
}

/** Pasted content in a cell flattened to its text: each block's inline content, a line break between
 *  two blocks (a cell holds no blocks). */
export function inlineForCell(content: Fragment): Fragment {
  const out: PMNode[] = [];
  const walk = (frag: Fragment) =>
    frag.forEach((node) => {
      if (node.isInline) {
        out.push(node);
        return;
      }
      if (node.isTextblock) {
        // An empty block adds no line.
        if (node.content.size === 0) return;
        if (out.length > 0) out.push(S.nodes.hard_break.create());
        node.forEach((child) => out.push(child));
        return;
      }
      walk(node.content);
    });
  walk(content);
  return Fragment.fromArray(out);
}
