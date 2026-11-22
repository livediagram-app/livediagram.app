// The writing's table and contents nodes (docs/specs/007-editor/article-pages.md "Tables", "Table of
// contents"), in their own module beside the writing's schema (article-schema.ts). A table is a block
// of rows of cells, each cell a stretch of text (inline content), with the table roles prosemirror-tables
// reads; a contents block is one atom whose lines are drawn from the writing (article-toc-view.ts).
import type { DOMOutputSpec, NodeSpec } from 'prosemirror-model';

const idOf = (v: unknown): string => (typeof v === 'string' ? v : '');

// A pasted cell's attributes: a merged cell is read as one cell (the paste rewrites the grid so every
// row is as wide as the widest, article-table-paste.ts), so spans are never kept.
const cellAttrs = { colspan: { default: 1 }, rowspan: { default: 1 }, colwidth: { default: null } };
const cellParse = () => ({ colspan: 1, rowspan: 1, colwidth: null });

// Every rule outranks the generic paragraph rule for `td, th` (a cell pasted outside a table).
const PRIORITY = 60;

export const articleTableNodes = {
  table: {
    group: 'block',
    content: 'table_row+',
    tableRole: 'table',
    isolating: true,
    // A cell is a textblock, so the gap cursor would stop between cells and rows: never inside a table.
    allowGapCursor: false,
    // `cols`: each column's id and share of the text width (ArticleTableColumn), kept in step with the
    // cells by the table plugin (article-table-plugins.ts).
    attrs: { id: { default: '' }, cols: { default: [] } },
    parseDOM: [{ tag: 'table', priority: PRIORITY }],
    toDOM(node): DOMOutputSpec {
      return [
        'table',
        { class: 'article-block article-table', 'data-block-id': idOf(node.attrs.id) },
        ['tbody', 0],
      ];
    },
  },
  table_row: {
    content: '(table_cell | table_header)+',
    tableRole: 'row',
    allowGapCursor: false,
    attrs: { id: { default: '' } },
    parseDOM: [{ tag: 'tr', priority: PRIORITY }],
    toDOM(node): DOMOutputSpec {
      return ['tr', { 'data-row-id': idOf(node.attrs.id) }, 0];
    },
  },
  table_cell: {
    content: 'inline*',
    tableRole: 'cell',
    isolating: true,
    attrs: cellAttrs,
    parseDOM: [{ tag: 'td', priority: PRIORITY, getAttrs: cellParse }],
    toDOM: (): DOMOutputSpec => ['td', 0],
  },
  table_header: {
    content: 'inline*',
    tableRole: 'header_cell',
    isolating: true,
    attrs: cellAttrs,
    parseDOM: [{ tag: 'th', priority: PRIORITY, getAttrs: cellParse }],
    toDOM: (): DOMOutputSpec => ['th', { scope: 'col' }, 0],
  },
  toc: {
    group: 'block',
    atom: true,
    selectable: true,
    draggable: false,
    // `depth`: how many heading levels it lists (1 to 3).
    attrs: { id: { default: '' }, depth: { default: 3 } },
    parseDOM: [
      {
        tag: 'nav[data-article-toc]',
        getAttrs: (el) => {
          const depth = Number(el.getAttribute('data-depth'));
          return { depth: depth === 1 || depth === 2 ? depth : 3 };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      return [
        'nav',
        {
          class: 'article-block article-toc',
          'data-article-toc': '',
          'data-block-id': idOf(node.attrs.id),
          'data-depth': String(node.attrs.depth),
          'aria-label': 'Contents',
          contenteditable: 'false',
        },
      ];
    },
  },
} satisfies Record<string, NodeSpec>;
