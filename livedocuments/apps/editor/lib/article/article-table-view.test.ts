// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Slice } from 'prosemirror-model';
import {
  newArticleTable,
  type ArticleBlock,
  type ArticleTableBlock,
} from '@livedocuments/document';
import { blocksToDoc, docToBlocks } from './article-convert';
import { articleSchema as S } from './article-schema';
import { cellArrow } from './article-table-commands';
import { blockIdsPlugin } from './article-plugins';
import {
  articleTablePasteProps,
  jumpToHeading,
  tableKeyPlugins,
  tableNodeViews,
  tablePlugins,
  type TableRights,
} from './article-table-editor';
import {
  normalisePastedTables,
  pasteIntoCell,
  trackTablePaste,
  tsvSlice,
} from './article-table-paste';
import { measureRepeats, repeatHeaderKey } from './article-table-repeat';
import { headingPages, measureTocPages, tocKey } from './article-toc-view';
import { linkAreas } from '@/components/canvas/article/article-editor-handle';
import { registerArticleHandle, type ArticleEditorHandle } from './article-editor-store';
import { pdfLinksFor } from '../export-pdf-links';
import { assemblePdf } from '../export-tab-pdf';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

// docs/specs/007-editor/article-pages.md "Tables" and "Table of contents": the table and the contents
// block as drawn in the writing, what a paste makes of a table, and what each role may do with them.

const table = (rows: number, cols: number, header = true): ArticleTableBlock => {
  const t = newArticleTable('t', rows, cols, header);
  return {
    ...t,
    rows: t.rows.map((r, i) => ({ ...r, cells: r.cells.map((_, j) => [{ text: `${i}${j}` }]) })),
  };
};

const heading = (id: string, text: string, style: 'h1' | 'h2' | 'h3' = 'h1'): ArticleBlock => ({
  id,
  type: 'paragraph',
  style,
  runs: [{ text }],
});

// The three roles: an Editor reshapes, a Participant writes in cells, a Viewer reads.
const ROLES: Record<'editor' | 'participant' | 'viewer', TableRights> = {
  editor: { editable: () => true, reshape: () => true },
  participant: { editable: () => true, reshape: () => false },
  viewer: { editable: () => false, reshape: () => false },
};

// jsdom has no layout: ProseMirror's pointer handling asks for the element at a point.
document.elementFromPoint ??= () => null;

let views: EditorView[] = [];
afterEach(() => {
  views.forEach((v) => v.destroy());
  views = [];
  document.body.replaceChildren();
  track.mockClear();
});

function mount(blocks: ArticleBlock[], rights: TableRights = ROLES.editor) {
  const onJump = vi.fn();
  const host = document.createElement('div');
  document.body.appendChild(host);
  const view = new EditorView(host, {
    state: EditorState.create({
      doc: blocksToDoc(blocks),
      plugins: [...tableKeyPlugins(rights), blockIdsPlugin, ...tablePlugins()],
    }),
    editable: rights.editable,
    nodeViews: tableNodeViews(rights, onJump),
  });
  views.push(view);
  return { view, onJump };
}

const tableOf = (view: EditorView) =>
  docToBlocks(view.state.doc, []).find((b) => b.type === 'table') as ArticleTableBlock;

// The first position inside cell (row, col).
function cellPos(view: EditorView, row: number, col: number): number {
  let found = -1;
  view.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.type !== S.nodes.table) return true;
    let p = pos + 1;
    for (let r = 0; r < row; r++) p += node.child(r).nodeSize;
    p += 1;
    for (let c = 0; c < col; c++) p += node.child(row).child(c).nodeSize;
    found = p + 1;
    return false;
  });
  return found;
}

const press = (view: EditorView, key: string) =>
  view.someProp('handleKeyDown', (f) =>
    f(view, new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })),
  );

const pointer = (el: Element, type: string, clientX: number, extra: object = {}) =>
  el.dispatchEvent(
    Object.assign(
      new MouseEvent(type, { bubbles: true, cancelable: true, clientX, button: 0 }),
      extra,
    ),
  );

describe('a table as drawn', () => {
  it('marks its block, its header row and its columns’ shares', () => {
    const { view } = mount([table(3, 2)]);
    const dom = view.dom.querySelector<HTMLElement>('table.article-table')!;
    expect(dom.dataset.blockId).toBe('t');
    expect(dom.dataset.header).toBe('');
    expect(dom.style.getPropertyValue('--article-table-cols')).toBe('0.5fr 0.5fr');
    expect(dom.querySelectorAll('th')).toHaveLength(2);
    // Header off: no mark.
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, cellPos(view, 1, 0))),
    );
    const plain = mount([table(2, 2, false)]).view.dom.querySelector<HTMLElement>('table')!;
    expect(plain.dataset.header).toBeUndefined();
  });

  it('resizes two columns by their grip for an Editor, written once on release', () => {
    const { view } = mount([table(2, 2)]);
    const dom = view.dom.querySelector<HTMLElement>('table')!;
    const row = dom.querySelector('tr')!;
    row.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 20 }) as DOMRect;
    const cell = row.firstElementChild!;
    pointer(cell, 'pointermove', 60);
    expect(dom.dataset.grip).toBeUndefined();
    pointer(cell, 'pointermove', 101);
    expect(dom.dataset.grip).toBe('1');
    expect(dom.style.getPropertyValue('--article-grip-x')).toBe('50.000%');
    pointer(cell, 'pointerdown', 101);
    pointer(cell, 'pointermove', 141);
    expect(dom.style.getPropertyValue('--article-table-cols')).toBe('0.7fr 0.3fr');
    pointer(cell, 'pointerup', 141);
    expect(tableOf(view).cols.map((c) => c.w)).toEqual([0.7, 0.3]);
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'ArticleTableShape');
    pointer(cell, 'pointerleave', 0);
    expect(dom.dataset.grip).toBeUndefined();
  });

  it('puts the widths back on Escape or a cancelled drag, and writes nothing for no move', () => {
    const { view } = mount([table(2, 2)]);
    const dom = view.dom.querySelector<HTMLElement>('table')!;
    const row = dom.querySelector('tr')!;
    row.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 20 }) as DOMRect;
    const cell = row.firstElementChild!;
    const before = view.state.doc;
    const drag = (to: number) => {
      pointer(cell, 'pointermove', 100);
      pointer(cell, 'pointerdown', 100);
      pointer(cell, 'pointermove', to);
    };
    drag(150);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dom.style.getPropertyValue('--article-table-cols')).toBe('0.5fr 0.5fr');
    drag(150);
    pointer(cell, 'pointercancel', 150);
    expect(dom.style.getPropertyValue('--article-table-cols')).toBe('0.5fr 0.5fr');
    drag(100);
    pointer(cell, 'pointerup', 100);
    expect(view.state.doc).toBe(before);
  });

  it('shows no grip to a Participant, a Viewer or a finger', () => {
    for (const rights of [ROLES.participant, ROLES.viewer]) {
      const { view } = mount([table(2, 2)], rights);
      const row = view.dom.querySelector('tr')!;
      row.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 20 }) as DOMRect;
      pointer(row.firstElementChild!, 'pointermove', 100);
      expect(view.dom.querySelector<HTMLElement>('table')!.dataset.grip).toBeUndefined();
    }
    const { view } = mount([table(2, 2)]);
    const row = view.dom.querySelector('tr')!;
    row.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 20 }) as DOMRect;
    pointer(row.firstElementChild!, 'pointermove', 100, { pointerType: 'touch' });
    expect(view.dom.querySelector<HTMLElement>('table')!.dataset.grip).toBeUndefined();
  });

  it('lets a Participant write and move in cells, but never grow the table with Tab', () => {
    const { view } = mount(
      [table(2, 2), { id: 'p', type: 'paragraph', runs: [] }],
      ROLES.participant,
    );
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, cellPos(view, 1, 1))),
    );
    view.dispatch(view.state.tr.insertText('!'));
    expect(press(view, 'Tab')).toBe(true);
    expect(tableOf(view).rows).toHaveLength(2);
    expect(tableOf(view).rows[1]!.cells[1]).toEqual([{ text: '!11' }]);
    const editor = mount([table(2, 2)]).view;
    editor.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, cellPos(editor, 1, 1))),
    );
    press(editor, 'Tab');
    expect(tableOf(editor).rows).toHaveLength(3);
  });
});

describe('Up and Down in a cell', () => {
  const arrow = (view: EditorView, dir: 1 | -1, edge = true) =>
    cellArrow(dir)(view.state, view.dispatch, {
      ...view,
      endOfTextblock: () => edge,
    } as unknown as EditorView);

  it('move to the cell above or below, and out of the table past its first or last row', () => {
    const { view } = mount([
      { id: 'a', type: 'paragraph', runs: [{ text: 'Before' }] },
      table(2, 2),
      { id: 'b', type: 'paragraph', runs: [{ text: 'After' }] },
    ]);
    const go = (pos: number) =>
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
    go(cellPos(view, 0, 1));
    expect(arrow(view, 1)).toBe(true);
    expect(view.state.selection.from).toBe(cellPos(view, 1, 1));
    expect(arrow(view, 1)).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('After');
    go(cellPos(view, 0, 0));
    expect(arrow(view, -1)).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('Before');
  });

  it('leave a line within a cell, a range and the writing outside a table to the browser', () => {
    const { view } = mount([{ id: 'a', type: 'paragraph', runs: [{ text: 'x' }] }, table(2, 2)]);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
    expect(arrow(view, 1)).toBe(false);
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, cellPos(view, 0, 0))),
    );
    expect(arrow(view, 1, false)).toBe(false);
    const p = cellPos(view, 0, 0);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, p, p + 1)));
    expect(arrow(view, 1)).toBe(false);
    expect(cellArrow(1)(view.state)).toBe(false);
  });
});

describe('a contents block as drawn', () => {
  const doc = (depth?: 1 | 2): ArticleBlock[] => [
    { id: 'toc', type: 'toc', ...(depth ? { depth } : {}) },
    heading('h1', 'Intro'),
    heading('h2', 'Detail', 'h2'),
    heading('h3', 'Deep', 'h3'),
  ];
  const entries = (view: EditorView) =>
    Array.from(view.dom.querySelectorAll('.article-toc-entry')).map((e) =>
      e.getAttribute('aria-label'),
    );

  it('lists the headings to its depth, with their pages once measured', () => {
    const { view } = mount(doc());
    expect(entries(view)).toEqual(['Intro', 'Detail', 'Deep']);
    view.dispatch(
      view.state.tr.setMeta(
        tocKey,
        new Map([
          ['h1', 0],
          ['h2', 1],
        ]),
      ),
    );
    expect(entries(view)).toEqual(['Intro, page 1', 'Detail, page 2', 'Deep']);
    // The same pages again change nothing; a caret move keeps the entries.
    const decos = tocKey.getState(view.state)!.decos;
    view.dispatch(
      view.state.tr.setMeta(
        tocKey,
        new Map([
          ['h1', 0],
          ['h2', 1],
        ]),
      ),
    );
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3)));
    expect(tocKey.getState(view.state)!.decos).toBe(decos);
    expect(entries(mount(doc(1)).view)).toEqual(['Intro']);
  });

  it('follows a heading as it is written', () => {
    const { view } = mount(doc());
    let end = 0;
    view.state.doc.forEach((n, pos) => {
      if (n.attrs.id === 'h1') end = pos + n.nodeSize - 1;
    });
    view.dispatch(view.state.tr.insertText(' Two', end));
    expect(entries(view)[0]).toBe('Intro Two');
  });

  it('gives an Editor the depth chips, which set its depth', () => {
    const { view } = mount(doc());
    const chips = view.dom.querySelectorAll<HTMLButtonElement>('[data-toc-depth]');
    expect(Array.from(chips).map((c) => c.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
    ]);
    chips[0]!.click();
    expect(view.state.doc.firstChild!.attrs.depth).toBe(1);
    expect(entries(view)).toEqual(['Intro']);
  });

  it('jumps to a heading from its entry, the buttons its own', () => {
    const { view, onJump } = mount(doc());
    const entry = view.dom.querySelector<HTMLButtonElement>('[data-toc-target="h2"]')!;
    entry.click();
    expect(onJump).toHaveBeenCalledWith(view, 'h2');
    const nav = view.dom.querySelector('nav')!;
    const nodeView = tableNodeViews(ROLES.editor, vi.fn()).toc(
      view.state.doc.firstChild!,
      view,
      () => 0,
      [],
      undefined as never,
    );
    const onButton = new MouseEvent('mousedown', { bubbles: true });
    entry.dispatchEvent(onButton);
    expect(nodeView.stopEvent!(onButton)).toBe(true);
    const onNav = new MouseEvent('mousedown', { bubbles: true });
    nav.dispatchEvent(onNav);
    expect(nodeView.stopEvent!(onNav)).toBe(false);
    expect(nodeView.ignoreMutation!({} as never)).toBe(true);
    expect(nodeView.update!(S.nodes.paragraph.create(), [], undefined as never)).toBe(false);
    nodeView.destroy!();
  });

  it('shows a Participant no chips, and a Viewer no chips and no empty hint', () => {
    expect(mount(doc(), ROLES.participant).view.dom.querySelector('[data-toc-depth]')).toBeNull();
    const viewer = mount([{ id: 'toc', type: 'toc' }], ROLES.viewer).view;
    expect(viewer.dom.querySelector('[data-toc-depth]')).toBeNull();
    expect(viewer.dom.querySelector('.article-toc-empty')).toBeNull();
    const editor = mount([{ id: 'toc', type: 'toc' }]).view;
    expect(editor.dom.querySelector('.article-toc-empty')!.textContent).toBe(
      'Headings you add are listed here',
    );
    // A chip pressed with no right to reshape changes nothing.
    const participant = mount(doc(), ROLES.editor);
    const chip = participant.view.dom.querySelector<HTMLButtonElement>('[data-toc-depth="1"]')!;
    ROLES.editor.reshape = () => false;
    chip.click();
    ROLES.editor.reshape = () => true;
    expect(participant.view.state.doc.firstChild!.attrs.depth).not.toBe(1);
  });

  it('measures headings’ pages only when there is a contents block, dispatching a change once', () => {
    const plain = mount([heading('h1', 'Intro')]).view;
    const spy = vi.spyOn(plain, 'dispatch');
    measureTocPages(plain, () => 0);
    expect(spy).not.toHaveBeenCalled();
    const { view } = mount(doc());
    view.dom.querySelectorAll<HTMLElement>('[data-block-id]').forEach((el, i) => {
      el.getClientRects = () => [{ left: i * 100 }] as unknown as DOMRectList;
    });
    expect([...headingPages(view, (x) => Math.floor(x / 100))]).toEqual([
      ['h1', 1],
      ['h2', 2],
      ['h3', 3],
    ]);
    measureTocPages(view, (x) => Math.floor(x / 100));
    expect(entries(view)[0]).toBe('Intro, page 2');
    const again = vi.spyOn(view, 'dispatch');
    measureTocPages(view, (x) => Math.floor(x / 100));
    expect(again).not.toHaveBeenCalled();
  });
});

describe('the header row repeated', () => {
  it('measures the breaks of a table with a header row, dispatching only a change', () => {
    const { view } = mount([table(4, 2)]);
    Object.defineProperty(view.dom, 'clientHeight', { value: 50, configurable: true });
    view.dom.querySelectorAll<HTMLElement>('tr').forEach((tr) => {
      Object.defineProperty(tr, 'offsetHeight', { value: 20, configurable: true });
      tr.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    });
    expect(measureRepeats(view, 0, 1)).toBe(true);
    // A 50 px column of 20 px rows: rows 2 and 3 each start a page under a copy of the header row.
    expect(repeatHeaderKey.getState(view.state)!.get('t')).toHaveLength(2);
    expect(view.dom.querySelectorAll('tr.article-table-repeat')).toHaveLength(2);
    expect(measureRepeats(view, 0, 1)).toBe(false);
    // A one-row table, and one without a header row, never repeat.
    expect(measureRepeats(mount([table(1, 2)]).view, 0, 1)).toBe(false);
    expect(measureRepeats(mount([table(4, 2, false)]).view, 0, 1)).toBe(false);
  });
});

describe('jumping to a heading', () => {
  it('puts an Editor’s caret at its start and brings it into view; a Viewer’s view only moves', () => {
    const { view } = mount([
      { id: 'p', type: 'paragraph', runs: [{ text: 'x' }] },
      heading('h', 'Go'),
    ]);
    const reveal = vi.fn();
    const el = view.dom.querySelector<HTMLElement>('[data-block-id="h"]')!;
    el.getClientRects = () => [{ left: 1 }] as unknown as DOMRectList;
    jumpToHeading(view, 'h', true, reveal);
    expect(view.state.selection.$from.parent.textContent).toBe('Go');
    expect(reveal).toHaveBeenCalledTimes(1);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
    jumpToHeading(view, 'h', false, reveal);
    expect(view.state.selection.from).toBe(1);
    expect(reveal).toHaveBeenCalledTimes(2);
    jumpToHeading(view, 'gone', true, reveal);
    expect(reveal).toHaveBeenCalledTimes(2);
  });
});

describe('a table pasted', () => {
  const html = (body: string) =>
    new DOMParser().parseFromString(normalisePastedTables(body), 'text/html');

  it('leaves HTML with no table as it is', () => {
    expect(normalisePastedTables('<p>Hi</p>')).toBe('<p>Hi</p>');
  });

  it('splits merged cells, keeps a header row and makes cells’ blocks lines', () => {
    const doc = html(
      '<table><thead><tr><th colspan="2">Name</th></tr></thead><tbody>' +
        '<tr><td rowspan="2"><p>A</p><ul><li>one</li><li>two</li></ul></td><td>1</td></tr>' +
        '<tr><td><table><tr><td>in</td><td>ner</td></tr></table></td></tr></tbody></table>',
    );
    const rows = Array.from(doc.querySelectorAll('tr'));
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.children.length)).toEqual([2, 2, 2]);
    expect(rows[0]!.children[0]!.tagName).toBe('TH');
    expect(rows[1]!.children[0]!.innerHTML).toBe('A<br>one<br>two');
    expect(rows[2]!.children[0]!.textContent).toBe('');
    expect(rows[2]!.children[1]!.textContent).toBe('in ner');
  });

  it('reads a first row of th cells as a header row, and none otherwise', () => {
    expect(
      html(
        '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>',
      ).querySelectorAll('th'),
    ).toHaveLength(2);
    expect(
      html('<table><tr><td>A</td></tr><tr><td>1</td></tr></table>').querySelectorAll('th'),
    ).toHaveLength(0);
  });

  it('only flattens the cells of a copy from the editor', () => {
    const out = normalisePastedTables(
      '<table data-pm-slice="1 1 []"><tr><td colspan="2"><p>a</p><p>b</p></td></tr></table>',
    );
    expect(out).toContain('colspan="2"');
    expect(out).toContain('a<br>b');
  });

  it('makes tab-separated text a table with no header row, quoted cells whole', () => {
    const t = tsvSlice('a\t"b\tc"\n1\t\n')!.content.firstChild!;
    expect(t.type).toBe(S.nodes.table);
    expect(t.firstChild!.firstChild!.type).toBe(S.nodes.table_cell);
    const cells: string[][] = [];
    t.forEach((row) => {
      const line: string[] = [];
      row.forEach((c) => line.push(c.textContent));
      cells.push(line);
    });
    expect(cells).toEqual([
      ['a', 'b c'],
      ['1', ''],
    ]);
    expect(tsvSlice('one line\tonly')).toBeNull();
  });

  it('flattens a paste into a cell to its text, leaving cells to the table and other places alone', () => {
    const { view } = mount([{ id: 'p', type: 'paragraph', runs: [{ text: 'x' }] }, table(2, 2)]);
    const two = new Slice(
      blocksToDoc([
        { id: 'a', type: 'paragraph', runs: [{ text: 'A' }] },
        { id: 'b', type: 'paragraph', runs: [{ text: 'B' }] },
      ]).content,
      1,
      1,
    );
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
    expect(pasteIntoCell(view, two)).toBe(false);
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, cellPos(view, 1, 0))),
    );
    expect(pasteIntoCell(view, two)).toBe(true);
    expect(
      tableOf(view)
        .rows[1]!.cells[0]!.map((r) => r.text)
        .join(''),
    ).toBe('A\nB10');
    const cells = new Slice(blocksToDoc([table(1, 2, false)]).firstChild!.content, 1, 1);
    expect(pasteIntoCell(view, cells)).toBe(false);
  });

  it('counts a paste that makes a table block, never one into a cell', () => {
    const slice = new Slice(blocksToDoc([table(2, 2)]).content, 0, 0);
    trackTablePaste(slice, true);
    trackTablePaste(new Slice(blocksToDoc([heading('h', 'x')]).content, 0, 0), false);
    expect(track).not.toHaveBeenCalled();
    trackTablePaste(slice, false);
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'ArticleTablePaste');
  });

  it('composes over the writing’s own paste', () => {
    const base = {
      transformPastedHTML: vi.fn((h: string) => h.replace('X', 'Y')),
      clipboardTextParser: vi.fn(() => Slice.empty),
      handlePaste: vi.fn(() => true),
    };
    const props = articleTablePasteProps(base);
    const { view } = mount([{ id: 'p', type: 'paragraph', runs: [{ text: 'x' }] }, table(2, 2)]);
    expect(props.transformPastedHTML!('<p>X</p>', view)).toBe('<p>Y</p>');
    expect(articleTablePasteProps({}).transformPastedHTML!('<p>X</p>', view)).toBe('<p>X</p>');
    const $p = view.state.doc.resolve(1);
    expect(props.clipboardTextParser!('a\tb\nc\td', $p, true, view).content.firstChild!.type).toBe(
      S.nodes.table,
    );
    expect(props.clipboardTextParser!('plain', $p, true, view)).toBe(Slice.empty);
    const code = EditorState.create({
      doc: blocksToDoc([{ id: 'c', type: 'code', text: 'x' }]),
    }).doc.resolve(1);
    if (code.parent.type.spec.code) {
      props.clipboardTextParser!('a\tb\nc\td', code, true, view);
      expect(base.clipboardTextParser).toHaveBeenCalledTimes(2);
    }
    const event = (types: Record<string, string>) =>
      ({
        clipboardData: {
          types: Object.keys(types),
          getData: (t: string) => types[t] ?? '',
        },
      }) as unknown as ClipboardEvent;
    const slice = new Slice(blocksToDoc([heading('h', 'x')]).content, 0, 0);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
    expect(props.handlePaste!(view, event({ 'text/plain': 'a\tb\nc\td' }), slice)).toBe(false);
    expect(props.handlePaste!(view, event({ 'text/plain': 'hi' }), slice)).toBe(true);
    expect(articleTablePasteProps({}).handlePaste!(view, event({}), slice)).toBe(false);
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, cellPos(view, 1, 0))),
    );
    expect(props.handlePaste!(view, event({ 'text/plain': 'hi' }), slice)).toBe(true);
    expect(base.handlePaste).toHaveBeenCalledTimes(1);
  });
});

describe('a PDF’s link areas', () => {
  const page = (id: string, x: number, flow?: string) => ({
    id,
    kind: 'article' as const,
    ...(flow ? { flow } : {}),
    rect: { x, y: 0, width: 800, height: 1000 },
  });

  it('reads the contents entries and the text’s links off the writing, on canvas', () => {
    const { view } = mount([
      { id: 'toc', type: 'toc' },
      heading('h1', 'Intro'),
      {
        id: 'p',
        type: 'paragraph',
        runs: [
          { text: 'site', href: 'https://example.com' },
          { text: ' bad', href: 'javascript:alert(1)' },
        ],
      },
    ]);
    view.dom.getBoundingClientRect = () => ({ left: 0, top: 0, width: 608 }) as DOMRect;
    Object.defineProperty(view.dom, 'offsetWidth', { value: 608, configurable: true });
    const rect = (left: number, w = 50) =>
      [{ left, top: 10, width: w, height: 20 }] as unknown as DOMRectList;
    view.dom.querySelector<HTMLElement>('[data-block-id="h1"]')!.getClientRects = () => rect(1);
    view.dom.querySelector<HTMLElement>('.article-toc-entry')!.getClientRects = () => rect(5);
    view.dom.querySelectorAll<HTMLElement>('a').forEach((a, i) => {
      a.getClientRects = () => rect(9, i === 0 ? 30 : 0);
    });
    const areas = linkAreas(view, {
      flow: 'f',
      pages: [page('a', 0, 'f')] as never,
      margin: 96,
      zoom: 1,
    });
    expect(areas).toEqual([
      { x: 101, y: 106, w: 50, h: 20, page: 0 },
      { x: 105, y: 106, w: 30, h: 20, href: 'https://example.com' },
    ]);
  });

  it('puts each page’s areas on it, linking within the PDF, from the editors registered', () => {
    const handle = {
      flow: 'f',
      links: () => [
        { x: 10, y: 10, w: 10, h: 10, page: 1 },
        { x: 810, y: 10, w: 10, h: 10, page: 0 },
      ],
    } as unknown as ArticleEditorHandle;
    const off = registerArticleHandle(handle);
    const pages = [page('a', 0, 'f'), page('b', 800, 'f'), page('c', 1600)];
    const links = pdfLinksFor(pages as never, pages);
    off();
    expect(links[0]).toEqual([{ x: 7.5, y: 735, w: 7.5, h: 7.5, page: 1 }]);
    expect(links[1]).toEqual([{ x: 7.5, y: 735, w: 7.5, h: 7.5, page: 0 }]);
    expect(links[2]).toEqual([]);
    // An article with no editor laid out: no areas.
    expect(pdfLinksFor([page('a', 0, 'g')] as never, [page('a', 0, 'g')])).toEqual([[]]);
  });

  it('writes the annotations after the pages, each page listing its own', async () => {
    const img = { width: 1, height: 1, bytes: new Uint8Array([0]), mediaW: 600, mediaH: 750 };
    const blob = assemblePdf([
      { ...img, links: [{ x: 0, y: 0, w: 1, h: 1, page: 1 }] },
      { ...img, links: [{ x: 0, y: 0, w: 1, h: 1, uri: 'https://x.y' }] },
      img,
    ]);
    const text = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));
    expect(text).toContain('/Contents 4 0 R /Annots [12 0 R] >>');
    expect(text).toContain('/Contents 7 0 R /Annots [13 0 R] >>');
    expect(text).toContain('/Contents 10 0 R >>');
    expect(text).toContain(
      '12 0 obj\n<< /Type /Annot /Subtype /Link /Rect [0 0 1 1] /Border [0 0 0] /Dest [6 0 R /Fit] >>',
    );
    expect(text).toContain('/Size 14');
  });
});
