// The writing's table plugins (docs/specs/007-editor/article-pages.md "Tables"): every table keeps its
// columns' ids and shares in step with its cells and every row an id of its own (whatever a paste or a
// prosemirror-tables command left), a header row stays the first row only; and the keys inside a cell.
import { keymap } from 'prosemirror-keymap';
import { Plugin, PluginKey, type Transaction } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { TableMap } from 'prosemirror-tables';
import { nextTablePartId, normaliseShares, type ArticleTableColumn } from '@livedocuments/document';
import { articleSchema } from './article-schema';
import { cellArrow, cellEdge, cellEnter, tableTab } from './article-table-commands';

const S = articleSchema;

/** A table's columns made to match its width: ids kept in order, a missing one added with the mean share,
 *  extra ones dropped from the end, shares normalised. The same array back when nothing changes. */
export function fittedCols(cols: unknown, width: number): ArticleTableColumn[] | null {
  const given = Array.isArray(cols) ? (cols as ArticleTableColumn[]) : [];
  const valid = given.filter(
    (c) => c && typeof c.id === 'string' && typeof c.w === 'number' && Number.isFinite(c.w),
  );
  const unique = valid.filter((c, i) => valid.findIndex((d) => d.id === c.id) === i);
  if (unique.length === width && unique.length === given.length) {
    const shares = normaliseShares(unique.map((c) => c.w));
    if (shares.every((w, i) => Math.abs(w - unique[i]!.w) < 1e-4)) return null;
  }
  const kept = unique.slice(0, width);
  const mean = kept.length ? kept.reduce((n, c) => n + c.w, 0) / kept.length : 1;
  const taken = new Set(kept.map((c) => c.id));
  while (kept.length < width) {
    const id = nextTablePartId('c', taken);
    taken.add(id);
    kept.push({ id, w: mean });
  }
  const shares = normaliseShares(kept.map((c) => c.w));
  return kept.map((c, i) => ({ id: c.id, w: shares[i]! }));
}

function fixTable(tr: Transaction, table: PMNode, pos: number): void {
  const map = TableMap.get(table);
  const cols = fittedCols(table.attrs.cols, map.width);
  if (cols) tr.setNodeAttribute(pos, 'cols', cols);
  // Rows: an id each, unique in the table. The header row: the first row's cells all header cells or
  // none; a header cell in any later row reads as an ordinary cell.
  const seen = new Set<string>();
  let rowPos = pos + 1;
  table.forEach((row, _o, r) => {
    const id = row.attrs.id as string;
    if (!id || seen.has(id)) {
      const fresh = nextTablePartId('r', seen);
      seen.add(fresh);
      tr.setNodeAttribute(rowPos, 'id', fresh);
    } else seen.add(id);
    let headers = 0;
    row.forEach((cell) => {
      if (cell.type === S.nodes.table_header) headers++;
    });
    const mixed = r === 0 ? headers > 0 && headers < row.childCount : headers > 0;
    if (mixed) {
      let cellPos = rowPos + 1;
      row.forEach((cell) => {
        if (cell.type === S.nodes.table_header)
          tr.setNodeMarkup(cellPos, S.nodes.table_cell, cell.attrs);
        cellPos += cell.nodeSize;
      });
    }
    rowPos += row.nodeSize;
  });
}

/** Keeps every table's columns, row ids and header row in order after any change. */
export const tableColsPlugin = new Plugin({
  key: new PluginKey('article-table-cols'),
  appendTransaction(trs, _old, state) {
    if (!trs.some((tr) => tr.docChanged)) return null;
    let tr: Transaction | null = null;
    state.doc.forEach((node, pos) => {
      if (node.type !== S.nodes.table) return;
      const next = tr ?? state.tr;
      const before = next.steps.length;
      fixTable(next, node, pos);
      if (next.steps.length > before) tr = next;
    });
    if (tr) (tr as Transaction).setMeta('addToHistory', false);
    return tr;
  },
});

/** The keys inside a table cell, before the writing's own: Tab and Shift+Tab move between cells (Tab in
 *  the last adds a row for someone who may reshape), Enter is a line break, Backspace and Delete stop at
 *  the cell's edges, Up and Down go to the cell above or below. */
export function tableKeymap(reshape: () => boolean): Plugin {
  return keymap({
    Tab: tableTab(1, reshape),
    'Shift-Tab': tableTab(-1, reshape),
    Enter: cellEnter,
    'Shift-Enter': cellEnter,
    Backspace: cellEdge('start'),
    Delete: cellEdge('end'),
    ArrowDown: cellArrow(1),
    ArrowUp: cellArrow(-1),
  });
}
