// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { DOMParser as PMDOMParser, DOMSerializer, Slice } from 'prosemirror-model';
import { newArticleTable, type ArticleBlock } from '@livedocuments/document';
import { blocksToDoc, docToBlocks } from './article-convert';
import { articleSchema as S } from './article-schema';
import {
  changedRanges,
  clearPendingNote,
  footnoteKey,
  footnoteNodeView,
  footnoteRefs,
  footnotesPlugin,
  insertFootnote,
  mapBreaks,
  sameFootBreaks,
  setFootBreaks,
  touchesRefs,
} from './article-footnotes';

// docs/specs/007-editor/article-pages.md "Footnotes": a reference is an atom holding its note; numbers through the
// article, worked out, never stored.
const para = (id: string, runs: { text: string; fn?: string }[]) =>
  ({ id, type: 'paragraph', runs }) as ArticleBlock;
const BLOCKS: ArticleBlock[] = [
  para('a', [{ text: 'One' }, { text: '**', fn: 'Twin note' }, { text: ' two' }]),
  para('b', [{ text: 'Three' }, { text: '*', fn: 'Last note' }]),
];

const views: EditorView[] = [];
afterEach(() => {
  views.splice(0).forEach((v) => v.destroy());
});
function viewOf(blocks: readonly ArticleBlock[], onRef = vi.fn()) {
  const view = new EditorView(document.createElement('div'), {
    state: EditorState.create({ doc: blocksToDoc(blocks), plugins: [footnotesPlugin(onRef)] }),
    nodeViews: { footnote: footnoteNodeView },
  });
  views.push(view);
  return { view, onRef };
}
const stateOf = (view: EditorView) => footnoteKey.getState(view.state)!;

describe('footnote references in the editor', () => {
  it('reads a run of references as one atom each, and writes them back as the run', () => {
    const doc = blocksToDoc(BLOCKS);
    expect(footnoteRefs(doc)).toEqual([4, 5, 17]);
    expect(doc.nodeAt(4)!.attrs.text).toBe('Twin note');
    expect(docToBlocks(doc)).toEqual(BLOCKS);
  });

  it('never makes a line break after a reference a reference', () => {
    const doc = S.node('doc', null, [
      S.node('paragraph', { id: 'p' }, [
        S.text('a'),
        S.nodes.footnote.create({ text: 'n' }),
        S.nodes.hard_break.create(),
        S.text('b'),
      ]),
    ]);
    expect(docToBlocks(doc)).toEqual([
      para('p', [{ text: 'a' }, { text: '*', fn: 'n' }, { text: '\nb' }]),
    ]);
  });

  it('reads as no text, and copies within livedocuments with its note', () => {
    const doc = blocksToDoc(BLOCKS);
    expect(doc.textContent).toBe('One twoThree');
    const html = DOMSerializer.fromSchema(S).serializeFragment(doc.content);
    const div = document.createElement('div');
    div.append(html);
    expect(div.querySelector('sup[data-footnote]')!.getAttribute('data-footnote')).toBe(
      'Twin note',
    );
    const back = PMDOMParser.fromSchema(S).parse(div);
    expect(footnoteRefs(back)).toHaveLength(3);
    expect(back.nodeAt(footnoteRefs(back)[2]!)!.attrs.text).toBe('Last note');
  });

  it('numbers them through the article, drawn as raised numbers read as "Footnote n"', () => {
    const { view } = viewOf(BLOCKS);
    const refs = [...view.dom.querySelectorAll('sup.article-footnote-ref')];
    expect(refs.map((r) => r.textContent)).toEqual(['Footnote 1', 'Footnote 2', 'Footnote 3']);
    expect(refs.map((r) => r.getAttribute('data-n'))).toEqual(['1', '2', '3']);
    // One taken out: the rest renumber.
    view.dispatch(view.state.tr.delete(4, 5));
    expect(
      [...view.dom.querySelectorAll('sup.article-footnote-ref')].map((r) => r.textContent),
    ).toEqual(['Footnote 1', 'Footnote 2']);
    expect(stateOf(view).refs).toEqual([4, 16]);
  });

  it('carries the numbers through typing without counting again, and counts again when one comes or goes', () => {
    const { view } = viewOf(BLOCKS);
    const typed = view.state.tr.insertText('xx', 1);
    expect(touchesRefs(typed, stateOf(view).refs)).toBe(false);
    view.dispatch(typed);
    expect(stateOf(view).refs).toEqual([6, 7, 19]);
    const pasted = view.state.tr.replace(
      1,
      1,
      new Slice(S.node('paragraph', null, [S.nodes.footnote.create({ text: 'p' })]).content, 0, 0),
    );
    expect(touchesRefs(pasted, stateOf(view).refs)).toBe(true);
    view.dispatch(pasted);
    expect(stateOf(view).refs).toEqual([1, 7, 8, 20]);
    const gone = view.state.tr.delete(7, 8);
    expect(touchesRefs(gone, stateOf(view).refs)).toBe(true);
    // A selection change leaves it as it was.
    const before = stateOf(view);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)));
    expect(stateOf(view)).toBe(before);
  });

  it('puts one in at the caret, the caret after it and its note waiting for it', () => {
    const { view } = viewOf([para('a', [{ text: 'Hello' }])]);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3)));
    expect(insertFootnote(view.state, undefined, view)).toBe(true);
    expect(insertFootnote(view.state, view.dispatch, view)).toBe(true);
    expect(view.state.doc.nodeAt(3)!.type).toBe(S.nodes.footnote);
    expect(view.state.selection.from).toBe(4);
    expect(stateOf(view).pending).toBe(3);
    // Typing before it carries the waiting note along.
    view.dispatch(view.state.tr.insertText('ab', 1));
    expect(stateOf(view).pending).toBe(5);
    clearPendingNote(view);
    expect(stateOf(view).pending).toBeNull();
  });

  it('puts one after a selection, and in a table cell, never in a code block', () => {
    const { view } = viewOf([para('a', [{ text: 'Hello' }])]);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 4)));
    insertFootnote(view.state, view.dispatch, view);
    expect(view.state.doc.nodeAt(4)!.type).toBe(S.nodes.footnote);

    const table = newArticleTable('t', 2, 2, false);
    const inTable = viewOf([table]).view;
    inTable.dispatch(inTable.state.tr.setSelection(TextSelection.create(inTable.state.doc, 3)));
    expect(insertFootnote(inTable.state, inTable.dispatch, inTable)).toBe(true);
    const cells = (docToBlocks(inTable.state.doc)[0] as typeof table).rows[0]!.cells;
    expect(cells[0]).toEqual([{ text: '*', fn: '' }]);

    const code = viewOf([{ id: 'c', type: 'code', text: 'x = 1' }]).view;
    code.dispatch(code.state.tr.setSelection(TextSelection.create(code.state.doc, 2)));
    expect(insertFootnote(code.state, code.dispatch, code)).toBe(false);
  });

  it('takes a press on a reference to its note', () => {
    const { view, onRef } = viewOf(BLOCKS);
    const plugin = view.state.plugins[0]!;
    const click = plugin.props.handleClickOn!.bind(plugin);
    const at = (pos: number) =>
      click(view, pos, view.state.doc.nodeAt(pos)!, pos, new MouseEvent('click'), true);
    expect(at(17)).toBe(true);
    expect(onRef).toHaveBeenCalledWith(3);
    expect(click(view, 1, view.state.doc.firstChild!, 0, new MouseEvent('click'), false)).toBe(
      false,
    );
  });
});

describe('footnotes on a keystroke', () => {
  it('carries 400 references and 50 breaks through 500 keystrokes without walking the writing', () => {
    const blocks = Array.from({ length: 2000 }, (_, i) =>
      i % 5 === 0
        ? para(`p${i}`, [
            { text: 'Some words ' },
            { text: '*', fn: `Note ${i}` },
            { text: ' more' },
          ])
        : para(`p${i}`, [{ text: 'Plain words in a paragraph of the article.' }]),
    );
    const state = EditorState.create({
      doc: blocksToDoc(blocks),
      plugins: [footnotesPlugin(() => {})],
    });
    const breaks = footnoteKey
      .getState(state)!
      .refs.filter((_p, i) => i % 8 === 0)
      .map((pos, page) => ({ page, pos: pos + 2, block: false }));
    let s = state.apply(state.tr.setMeta(footnoteKey, { breaks }));
    const took = cpuMsOf(() => {
      for (let k = 0; k < 500; k++) s = s.apply(s.tr.insertText('a', 2 + k));
    });
    expect(footnoteKey.getState(s)!.refs).toHaveLength(400);
    expect(took).toBeLessThan(cpuBudgetMs(400));
  });
});

describe("the breaks above a page's notes", () => {
  it('draws a break inside a block as a box, and one before a block on the block', () => {
    const { view } = viewOf([para('a', [{ text: 'Hello world' }]), para('b', [{ text: 'Next' }])]);
    setFootBreaks(view, [
      { page: 0, pos: 4, block: false },
      { page: 1, pos: 13, block: true },
    ]);
    expect(view.dom.querySelectorAll('.article-foot-break')).toHaveLength(1);
    expect(
      view.dom.querySelector('.article-foot-break-before')!.getAttribute('data-block-id'),
    ).toBe('b');
    // The same breaks again draw nothing new; a block break with no block there is skipped.
    setFootBreaks(view, [{ page: 0, pos: 200, block: true }]);
    expect(view.dom.querySelector('.article-foot-break-before')).toBeNull();
  });

  it('carries the breaks through a change, dropping one inside a block that changed', () => {
    const { view } = viewOf([
      para('a', [{ text: 'Hello world' }]),
      para('b', [{ text: 'Next line' }]),
    ]);
    const breaks = [
      { page: 0, pos: 4, block: false },
      { page: 1, pos: 16, block: false },
      { page: 2, pos: 13, block: true },
    ];
    const typed = view.state.tr.insertText('!', 2);
    expect(changedRanges(typed)).toEqual([[2, 3]]);
    expect(mapBreaks(typed, breaks)).toEqual([
      { page: 1, pos: 17, block: false },
      { page: 2, pos: 14, block: true },
    ]);
    // A change in the other block keeps the first one; a break whose place went goes with it.
    const cut = view.state.tr.delete(15, 18);
    expect(mapBreaks(cut, breaks)).toEqual([
      { page: 0, pos: 4, block: false },
      { page: 2, pos: 13, block: true },
    ]);
    const joined = view.state.tr.delete(12, 15);
    expect(mapBreaks(joined, breaks)).toEqual([]);
    // Plugin state follows them.
    setFootBreaks(view, breaks);
    view.dispatch(view.state.tr.insertText('!', 2));
    expect(stateOf(view).breaks).toEqual(mapBreaks(typed, breaks));
  });

  it('says whether two sets of breaks are the same', () => {
    const a = [{ page: 0, pos: 4, block: false }];
    expect(sameFootBreaks(a, [{ page: 0, pos: 4, block: false }])).toBe(true);
    expect(sameFootBreaks(a, [{ page: 0, pos: 4, block: true }])).toBe(false);
    expect(sameFootBreaks(a, [])).toBe(false);
  });
});
