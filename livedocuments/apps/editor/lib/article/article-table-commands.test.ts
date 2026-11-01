import { describe, expect, it } from 'vitest';
import { EditorState, NodeSelection, TextSelection, type Command } from 'prosemirror-state';
import { CellSelection } from 'prosemirror-tables';
import {
  MAX_ARTICLE_TABLE_COLS,
  MAX_ARTICLE_TABLE_ROWS,
  newArticleTable,
  type ArticleBlock,
  type ArticleTableBlock,
} from '@livedocuments/document';
import { blocksToDoc, docToBlocks } from './article-convert';
import { articleSchema as S } from './article-schema';
import {
  cellEdge,
  cellEnter,
  colsWithAdded,
  colsWithRemoved,
  inlineForCell,
  insertTable,
  tableCommand,
  tableCommandBlock,
  tableTab,
  type TableCommandName,
} from './article-table-commands';
import { fittedCols, tableColsPlugin } from './article-table-plugins';
import { backspaceAtStart, deleteAtEnd, selectionStateOf } from './article-commands';
import { tablePlugins } from './article-table-editor';
import { slashKey, slashPlugin } from './article-slash';
import { blockIdsPlugin } from './article-plugins';

// docs/specs/007-editor/article-pages.md "Tables": the table block's commands, keys and upkeep.

const table = (rows: number, cols: number, header = true): ArticleTableBlock => ({
  ...newArticleTable('t', rows, cols, header),
  rows: newArticleTable('t', rows, cols, header).rows.map((r, i) => ({
    ...r,
    cells: r.cells.map((_, j) => (i === 0 && j === 0 ? [] : [{ text: `${i}${j}` }])),
  })),
});

const blocks = (t: ArticleTableBlock): ArticleBlock[] => [
  { id: 'a', type: 'paragraph', runs: [{ text: 'Before' }] },
  t,
  { id: 'b', type: 'paragraph', runs: [{ text: 'After' }] },
];

// The position inside cell (row, col) of the table in `doc`, at its start.
const cellPos = (state: EditorState, row: number, col: number): number => {
  let found = -1;
  state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.type === S.nodes.table) {
      let at = pos + 1;
      for (let r = 0; r < row; r++) at += node.child(r).nodeSize;
      at += 1;
      const rowNode = node.child(row);
      for (let c = 0; c < col; c++) at += rowNode.child(c).nodeSize;
      found = at + 1;
      return false;
    }
    return true;
  });
  return found;
};

const stateOf = (bs: ArticleBlock[], plugins = [blockIdsPlugin, ...tablePlugins()]) =>
  EditorState.create({ doc: blocksToDoc(bs), plugins });
const at = (state: EditorState, pos: number) =>
  state.apply(state.tr.setSelection(TextSelection.create(state.doc, pos)));
const run = (command: Command, state: EditorState) => {
  let next = state;
  const ok = command(state, (tr) => (next = state.apply(tr)));
  return { ok, state: next };
};
const tableOf = (state: EditorState) =>
  docToBlocks(state.doc, []).find((b) => b.type === 'table');

describe('a table block in the editor', () => {
  it('round-trips through the editor, its header row as header cells', () => {
    const t = table(3, 2);
    const doc = blocksToDoc(blocks(t));
    expect(doc.child(1).firstChild!.firstChild!.type).toBe(S.nodes.table_header);
    const back = docToBlocks(doc, []).find((b) => b.type === 'table') as ArticleTableBlock;
    expect(back.header).toBe(true);
    expect(back.cols).toEqual(t.cols);
    expect(back.rows.map((r) => r.id)).toEqual(t.rows.map((r) => r.id));
    expect(back.rows[1]!.cells[1]).toEqual([{ text: '11' }]);
    const plain = docToBlocks(blocksToDoc(blocks(table(2, 2, false))), []);
    expect((plain[1] as ArticleTableBlock).header).toBeUndefined();
  });

  it('puts a three by three table in with its header row, the caret in its first cell', () => {
    const state = at(stateOf([{ id: 'a', type: 'paragraph', runs: [{ text: 'Hi' }] }]), 2);
    const { ok, state: next } = run(insertTable, state);
    expect(ok).toBe(true);
    const t = tableOf(next)!;
    expect(t.rows).toHaveLength(3);
    expect(t.cols).toHaveLength(3);
    expect(t.header).toBe(true);
    expect(next.selection.$from.parent.type).toBe(S.nodes.table_header);
    // Never inside a table.
    expect(insertTable(at(next, cellPos(next, 1, 1)))).toBe(false);
  });

  it('adds and removes rows and columns, keeping the columns in step', () => {
    let state = at(stateOf(blocks(table(2, 2))), 0);
    state = at(state, cellPos(state, 1, 0));
    const add = (name: TableCommandName) => {
      const r = run(tableCommand(name), state);
      expect(r.ok).toBe(true);
      state = r.state;
      return tableOf(state)!;
    };
    expect(add('rowBelow').rows).toHaveLength(3);
    expect(add('rowAbove').rows).toHaveLength(4);
    const wider = add('colRight');
    expect(wider.cols).toHaveLength(3);
    expect(wider.cols.reduce((n, c) => n + c.w, 0)).toBeCloseTo(1);
    expect(new Set(wider.cols.map((c) => c.id)).size).toBe(3);
    expect(add('colLeft').cols).toHaveLength(4);
    expect(add('deleteCol').cols).toHaveLength(3);
    expect(add('deleteRow').rows).toHaveLength(3);
    expect(add('header').header).toBeUndefined();
    expect(add('header').header).toBe(true);
    add('deleteTable');
    expect(tableOf(state)).toBeUndefined();
  });

  it('deletes the table with its only row or its only column', () => {
    const oneRow = stateOf(blocks(table(1, 2, false)));
    expect(tableOf(run(tableCommand('deleteRow'), at(oneRow, cellPos(oneRow, 0, 0))).state)).toBe(
      undefined,
    );
    const oneCol = stateOf(blocks(table(2, 1, false)));
    expect(tableOf(run(tableCommand('deleteCol'), at(oneCol, cellPos(oneCol, 1, 0))).state)).toBe(
      undefined,
    );
  });

  it('says why a command cannot run', () => {
    const outside = at(stateOf(blocks(table(2, 2))), 2);
    expect(tableCommandBlock(outside, 'rowBelow')).toBe('Put the caret in a table first');
    expect(tableCommand('rowBelow')(outside)).toBe(false);
    const s = stateOf(blocks(table(2, 2)));
    expect(tableCommandBlock(at(s, cellPos(s, 0, 1)), 'rowAbove')).toBe(
      'The header row stays first',
    );
    expect(tableCommandBlock(at(s, cellPos(s, 1, 1)), 'rowAbove')).toBeNull();
    const tall = stateOf(blocks(table(MAX_ARTICLE_TABLE_ROWS, 1, false)));
    expect(tableCommandBlock(at(tall, cellPos(tall, 0, 0)), 'rowBelow')).toBe(
      `A table holds at most ${MAX_ARTICLE_TABLE_ROWS} rows`,
    );
    const wide = stateOf(blocks(table(1, MAX_ARTICLE_TABLE_COLS, false)));
    expect(tableCommandBlock(at(wide, cellPos(wide, 0, 0)), 'colRight')).toBe(
      `A table holds at most ${MAX_ARTICLE_TABLE_COLS} columns`,
    );
  });

  it('shares the width out as columns come and go', () => {
    const cols = [
      { id: 'c1', w: 0.5 },
      { id: 'c2', w: 0.5 },
    ];
    const added = colsWithAdded(cols, 1);
    expect(added.map((c) => c.w)).toEqual([
      expect.closeTo(1 / 3),
      expect.closeTo(1 / 3),
      expect.closeTo(1 / 3),
    ]);
    expect(added[1]!.id).not.toMatch(/^c[12]$/);
    expect(colsWithRemoved(added, 0, 1).map((c) => c.w)).toEqual([0.5, 0.5]);
  });

  it('moves with Tab and Shift+Tab, Tab in the last cell adding a row for someone who may reshape', () => {
    const s = stateOf(blocks(table(2, 2)));
    const first = at(s, cellPos(s, 0, 0));
    const next = run(
      tableTab(1, () => true),
      first,
    );
    expect(next.state.selection.from).toBe(cellPos(s, 0, 1));
    expect(
      run(
        tableTab(-1, () => true),
        next.state,
      ).state.selection.from,
    ).toBe(cellPos(s, 0, 0));
    const last = at(s, cellPos(s, 1, 1));
    const grown = run(
      tableTab(1, () => true),
      last,
    );
    expect(tableOf(grown.state)!.rows).toHaveLength(3);
    expect(grown.state.selection.from).toBe(cellPos(grown.state, 2, 0));
    // A writer who may not reshape stays put; Shift+Tab in the first cell stays too.
    const kept = run(
      tableTab(1, () => false),
      last,
    );
    expect(kept.ok).toBe(true);
    expect(tableOf(kept.state)!.rows).toHaveLength(2);
    expect(
      run(
        tableTab(-1, () => true),
        first,
      ).ok,
    ).toBe(true);
    // Outside a table it is the writing's Tab.
    expect(tableTab(1, () => true)(at(s, 2))).toBe(false);
  });

  it('makes Enter a line break, and stops Backspace and Delete at a cell edge', () => {
    const s = stateOf(blocks(table(2, 2)));
    const inCell = at(s, cellPos(s, 1, 0) + 1);
    const broke = run(cellEnter, inCell);
    expect(broke.state.selection.$from.parent.child(1).type).toBe(S.nodes.hard_break);
    expect(cellEnter(at(s, 2))).toBe(false);
    expect(cellEdge('start')(at(s, cellPos(s, 1, 0)))).toBe(true);
    expect(cellEdge('start')(inCell)).toBe(false);
    expect(cellEdge('end')(at(s, cellPos(s, 1, 0) + 2))).toBe(true);
    expect(cellEdge('end')(at(s, 2))).toBe(false);
    const ranged = s.apply(
      s.tr.setSelection(TextSelection.create(s.doc, cellPos(s, 1, 0), cellPos(s, 1, 0) + 2)),
    );
    expect(cellEdge('start')(ranged)).toBe(false);
    // A cell selection is emptied.
    const cells = s.apply(
      s.tr.setSelection(CellSelection.create(s.doc, cellPos(s, 1, 0) - 1, cellPos(s, 1, 1) - 1)),
    );
    const emptied = run(cellEdge('start'), cells);
    expect(emptied.ok).toBe(true);
    expect(tableOf(emptied.state)!.rows[1]!.cells).toEqual([[], []]);
  });

  it('flattens pasted blocks to a cell’s text, a line break between blocks', () => {
    const doc = blocksToDoc([
      { id: 'x', type: 'paragraph', runs: [{ text: 'One' }] },
      { id: 'y', type: 'list', list: 'bullet', runs: [{ text: 'Two', b: true }] },
      table(1, 2, false),
    ]);
    const inline = inlineForCell(doc.content);
    const types = [] as string[];
    inline.forEach((n) => types.push(n.type.name));
    // The table's empty first cell adds nothing.
    expect(types).toEqual(['text', 'hard_break', 'text', 'hard_break', 'text']);
  });

  it('keeps a table’s columns, row ids and header row in order', () => {
    expect(
      fittedCols(
        [
          { id: 'a', w: 0.5 },
          { id: 'b', w: 0.5 },
        ],
        2,
      ),
    ).toBeNull();
    const grown = fittedCols([{ id: 'a', w: 1 }], 3)!;
    expect(grown).toHaveLength(3);
    expect(grown.reduce((n, c) => n + c.w, 0)).toBeCloseTo(1);
    expect(
      fittedCols(
        [
          { id: 'a', w: 0.2 },
          { id: 'a', w: 0.8 },
          { id: 'b', w: 1 },
        ],
        2,
      ),
    ).toEqual([
      { id: 'a', w: expect.closeTo(1 / 6) },
      { id: 'b', w: expect.closeTo(5 / 6) },
    ]);
    expect(fittedCols('junk', 1)).toHaveLength(1);
    expect(fittedCols([{ id: 'a', w: 2 }], 1)).toEqual([{ id: 'a', w: 1 }]);

    // A pasted table: no columns, repeated row ids, a stray header cell.
    const cell = (t: string, header = false) =>
      (header ? S.nodes.table_header : S.nodes.table_cell).create(null, S.text(t));
    const node = S.nodes.table.create({ id: 't', cols: [] }, [
      S.nodes.table_row.create({ id: 'r' }, [cell('a', true), cell('b')]),
      S.nodes.table_row.create({ id: 'r' }, [cell('c', true), cell('d')]),
    ]);
    const base = EditorState.create({
      doc: S.nodes.doc.create(null, [S.nodes.paragraph.create()]),
      plugins: [tableColsPlugin],
    });
    const next = base.apply(base.tr.insert(0, node));
    const fixed = next.doc.firstChild!;
    expect((fixed.attrs.cols as unknown[]).length).toBe(2);
    expect(fixed.child(0).attrs.id).not.toBe(fixed.child(1).attrs.id);
    expect(fixed.child(0).child(0).type).toBe(S.nodes.table_cell);
    expect(fixed.child(1).child(0).type).toBe(S.nodes.table_cell);
    // Nothing to fix: no transaction appended.
    expect(next.apply(next.tr.insertText('x', next.doc.content.size - 1)).doc.firstChild).toBe(
      next.doc.firstChild,
    );
  });

  it('says when the selection is in a table and whether it has a header row', () => {
    const s = stateOf(blocks(table(2, 2)));
    expect(selectionStateOf(at(s, cellPos(s, 1, 0)))).toMatchObject({
      inTable: true,
      tableHeader: true,
    });
    expect(selectionStateOf(at(s, 2))).toMatchObject({ inTable: false, tableHeader: false });
    const plain = stateOf(blocks(table(2, 2, false)));
    expect(selectionStateOf(at(plain, cellPos(plain, 0, 0))).tableHeader).toBe(false);
  });

  it('never opens the slash menu in a cell', () => {
    const bridge = { onChange: () => {}, onKey: () => false };
    const s = EditorState.create({
      doc: blocksToDoc(blocks(table(2, 2))),
      plugins: [slashPlugin(bridge)],
    });
    const inCell = at(s, cellPos(s, 1, 0));
    const typed = inCell.apply(inCell.tr.insertText('/').setMeta('uiEvent', 'input'));
    expect(slashKey.getState(typed)?.active).toBe(false);
  });
});

describe('Backspace and Delete beside a table or a contents block', () => {
  const tocBlocks: ArticleBlock[] = [
    { id: 'a', type: 'paragraph', runs: [{ text: 'Before' }] },
    { id: 'c', type: 'toc' },
    { id: 'b', type: 'paragraph', runs: [{ text: 'After' }] },
  ];

  it('selects a contents block first, from the block after it or before it', () => {
    const s = stateOf(tocBlocks);
    const after = s.doc.child(0).nodeSize + s.doc.child(1).nodeSize + 1;
    const back = run(backspaceAtStart, at(s, after));
    expect(back.state.selection).toBeInstanceOf(NodeSelection);
    expect((back.state.selection as NodeSelection).node.type).toBe(S.nodes.toc);
    const fwd = run(deleteAtEnd, at(s, s.doc.child(0).nodeSize - 1));
    expect((fwd.state.selection as NodeSelection).node.type).toBe(S.nodes.toc);
  });

  it('takes the caret into the table rather than joining it', () => {
    const s = stateOf(blocks(table(2, 2)));
    const after = s.doc.child(0).nodeSize + s.doc.child(1).nodeSize + 1;
    const back = run(backspaceAtStart, at(s, after));
    expect(back.state.selection.$from.parent.type).toBe(S.nodes.table_cell);
    expect(tableOf(back.state)!.rows).toHaveLength(2);
    const fwd = run(deleteAtEnd, at(s, s.doc.child(0).nodeSize - 1));
    expect(fwd.state.selection.$from.parent.type).toBe(S.nodes.table_header);
  });
});
