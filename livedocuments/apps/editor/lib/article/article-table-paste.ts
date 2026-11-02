// Tables pasted into the writing (docs/specs/007-editor/article-pages.md "Tables", Paste): a table copied
// from a spreadsheet, a web page, Word or Google Docs, and tab-separated text, become a table block; and
// what is pasted into a cell. Composed with the writing's own paste (article-paste.ts) by
// articleTablePasteProps, so neither knows the other.
import { Fragment, Slice } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { __pastedCells, isInTable } from 'prosemirror-tables';
import { parseInert } from '@livedocuments/ui/trusted-types';
import {
  MAX_ARTICLE_TABLE_COLS,
  MAX_ARTICLE_TABLE_ROWS,
  tableFromGrid,
  type ArticleRun,
} from '@livedocuments/document';
import { track } from '@/lib/telemetry';
import { blocksToDoc } from './article-convert';
import { inlineForCell } from './article-table-commands';

// The elements whose content a cell keeps as lines (a cell holds one stretch of text).
const CELL_BLOCKS =
  'p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, ul, ol, dl, dt, dd, section';

/** Rows of cells from tab-separated text (a spreadsheet's plain text): at least two lines and two columns,
 *  every line holding a tab; else null. A quoted cell (Excel's, for a cell holding a line break or a
 *  tab) is read whole. */
export function tsvGrid(text: string): string[][] | null {
  if (!text.includes('\t') || !/\r?\n./.test(text.trimEnd())) return null;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = 0;
  const src = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  while (i < src.length) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (c === '"') quoted = false;
      else cell += c;
      i++;
      continue;
    }
    if (c === '"' && cell === '') quoted = true;
    else if (c === '\t') {
      row.push(cell);
      cell = '';
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
    i++;
  }
  row.push(cell);
  rows.push(row);
  if (rows.length < 2 || rows.some((r) => r.length < 2)) return null;
  return rows;
}

/** Tab-separated text as a slice holding one table block (no header row), or null when it is not a grid. */
export function tsvSlice(text: string): Slice | null {
  const grid = tsvGrid(text);
  if (!grid) return null;
  const runs = grid.map((r) =>
    r.map((t): ArticleRun[] => (t ? [{ text: t.replace(/\t/g, ' ') }] : [])),
  );
  const table = tableFromGrid('', runs, false);
  if (!table) return null;
  return new Slice(Fragment.from(blocksToDoc([table]).firstChild), 0, 0);
}

// A cell's content as one stretch of text: a table inside it read as its text, each block in it a line.
function flattenCell(cell: Element): void {
  const doc = cell.ownerDocument;
  cell.querySelectorAll('table').forEach((t) => {
    if (!cell.contains(t)) return;
    const words = Array.from(t.querySelectorAll('td, th'), (c) => (c.textContent ?? '').trim());
    t.replaceWith(doc.createTextNode(words.filter(Boolean).join(' ').replace(/\s+/g, ' ')));
  });
  // Innermost first, so a list's items are lines before the list goes.
  Array.from(cell.querySelectorAll(CELL_BLOCKS))
    .reverse()
    .forEach((b) => {
      const frag = doc.createDocumentFragment();
      const before = b.previousSibling;
      if (
        before &&
        (before.nodeType !== 3 || before.textContent?.trim()) &&
        before.nodeName !== 'BR'
      )
        frag.append(doc.createElement('br'));
      frag.append(...Array.from(b.childNodes));
      b.replaceWith(frag);
    });
  while (cell.firstChild?.nodeName === 'BR') cell.firstChild.remove();
  while (cell.lastChild?.nodeName === 'BR') cell.lastChild.remove();
}

// A table's rows as a grid: merged cells read as one (the cells they covered left empty), every row as wide
// as the widest, within the table limits. Whether its first row is a header row.
function gridOf(table: HTMLTableElement): { grid: (Element | null)[][]; header: boolean } {
  const grid: (Element | null)[][] = [];
  const rows = Array.from(table.rows).slice(0, MAX_ARTICLE_TABLE_ROWS);
  rows.forEach((row, r) => {
    grid[r] ??= [];
    let c = 0;
    for (const cell of Array.from(row.cells)) {
      while (grid[r][c] !== undefined) c++;
      const span = Math.max(
        1,
        Math.min(MAX_ARTICLE_TABLE_COLS, Number(cell.getAttribute('colspan')) || 1),
      );
      const down = Math.max(
        1,
        Math.min(rows.length - r, Number(cell.getAttribute('rowspan')) || 1),
      );
      for (let dr = 0; dr < down; dr++)
        for (let dc = 0; dc < span; dc++) {
          grid[r + dr] ??= [];
          grid[r + dr]![c + dc] = dr === 0 && dc === 0 ? cell : null;
        }
      c += span;
    }
  });
  const width = Math.min(
    MAX_ARTICLE_TABLE_COLS,
    grid.reduce((n, r) => Math.max(n, r.length), 0),
  );
  const first = rows[0];
  const header =
    !!first &&
    (first.parentElement?.tagName === 'THEAD' ||
      (first.cells.length > 0 && Array.from(first.cells).every((c) => c.tagName === 'TH')));
  return {
    grid: grid.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? null)),
    header,
  };
}

// A table rebuilt plain: its own element kept (with what a copy marked on it), its rows a grid of single
// cells, a header row of `th` when it had one.
function rebuildTable(table: HTMLTableElement): void {
  const doc = table.ownerDocument;
  const { grid, header } = gridOf(table);
  const body = doc.createElement('tbody');
  grid.forEach((cells, r) => {
    const tr = doc.createElement('tr');
    for (const cell of cells) {
      const out = doc.createElement(header && r === 0 ? 'th' : 'td');
      if (cell) {
        flattenCell(cell);
        out.append(...Array.from(cell.childNodes));
      }
      tr.appendChild(out);
    }
    body.appendChild(tr);
  });
  table.replaceChildren(body);
}

/** Pasted HTML with every table in it made one the writing reads as a table block: merged cells split into
 *  single cells, cells' paragraphs and lists made lines, a table in a cell read as text, rows and columns
 *  past the limits left out. HTML with no table comes back as it is. A copy from a ProseMirror editor
 *  (its own table cells) keeps its rows and only has its cells' blocks made lines. */
export function normalisePastedTables(html: string): string {
  if (!/<table[\s>]/i.test(html)) return html;
  const doc = parseInert(html, 'text/html');
  const fromEditor = doc.querySelector('[data-pm-slice]') !== null;
  const tables = Array.from(doc.querySelectorAll('table')).filter(
    (t) => !t.parentElement?.closest('table'),
  );
  for (const t of tables) {
    if (fromEditor) t.querySelectorAll('td, th').forEach(flattenCell);
    else rebuildTable(t);
  }
  return doc.body.innerHTML;
}

const hasTable = (slice: Slice): boolean => {
  let found = false;
  slice.content.descendants((n) => {
    if (n.type.spec.tableRole === 'table') found = true;
    return !found;
  });
  return found;
};

/** Paste into a cell: cells (copied from a table, or a pasted grid) are prosemirror-tables' to fill from the
 *  caret's cell; anything else is flattened to the cell's text. False outside a table. */
export function pasteIntoCell(view: EditorView, slice: Slice): boolean {
  if (!isInTable(view.state)) return false;
  if (__pastedCells(slice)) return false;
  const inline = inlineForCell(slice.content);
  const tr = view.state.tr.replaceSelection(new Slice(inline, 0, 0));
  view.dispatch(tr.scrollIntoView().setMeta('uiEvent', 'paste'));
  return true;
}

/** Whether a paste makes a table block (counted once it goes in). */
export function trackTablePaste(slice: Slice, inTable: boolean): void {
  if (!inTable && hasTable(slice)) track('Element', 'Changed', 'ArticleTablePaste');
}
