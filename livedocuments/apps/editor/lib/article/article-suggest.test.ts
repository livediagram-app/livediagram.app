import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state';
import { Slice, Fragment } from 'prosemirror-model';
import {
  acceptedArticleFlow,
  articleSuggestionList,
  rejectedArticleFlow,
  type ArticleBlock,
} from '@livedocuments/document';
import { blocksToDoc, docToBlocks } from './article-convert';
import { articleSchema } from './article-schema';
import { blockIdsPlugin } from './article-plugins';
import { suggestTransaction, SUGGEST_PASS, passesAsItIs, formatOf } from './article-suggest';
import {
  listSuggestions,
  resolveSuggestionsTr,
  selectFirstSuggestion,
  suggestionAt,
} from './article-suggest-resolve';

// Suggesting in the writing (docs/specs/007-editor/suggestions.md "What a suggestion is"): a person's own change kept
// beside the text, decided later.
const S = articleSchema;
const sam = { by: 'key-sam', n: 'Sam', c: '#ff0066' };
const kim = { by: 'key-kim', n: 'Kim' };
const ids = () => {
  let n = 0;
  return () => `s${++n}`;
};
const p = (id: string, text: string): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: text ? [{ text }] : [],
});

function stateOf(blocks: ArticleBlock[]) {
  return EditorState.create({ schema: S, doc: blocksToDoc(blocks), plugins: [blockIdsPlugin] });
}

// The state after `make` builds a transaction on `state`, remade as `author`'s suggestions.
function suggest(
  state: EditorState,
  make: (s: EditorState) => Transaction,
  author: { by: string; n: string; c?: string } = sam,
  newId = ids(),
) {
  const out = suggestTransaction(state, make(state), author, 7, newId);
  if ('refused' in out) return { refused: true as const, state };
  return { refused: false as const, state: state.apply(out) };
}

const blocksOf = (state: EditorState) => docToBlocks(state.doc);
const at = (state: EditorState, pos: number) =>
  state.apply(state.tr.setSelection(TextSelection.create(state.doc, pos)));

describe('suggestTransaction', () => {
  it('makes typing an insertion in the author’s name, joining the author’s own typing beside it', () => {
    let state = at(stateOf([p('b1', 'Hello world')]), 6);
    state = suggest(state, (s) => s.tr.insertText(' big')).state;
    state = suggest(state, (s) => s.tr.insertText('!')).state;
    const [block] = blocksOf(state) as unknown as [{ runs: unknown[] }];
    expect(block.runs).toEqual([
      { text: 'Hello' },
      {
        text: ' big!',
        sg: { id: 's1', k: 'ins', by: 'key-sam', n: 'Sam', c: '#ff0066', at: 7 },
      },
      { text: ' world' },
    ]);
    expect(state.selection.head).toBe(11);
  });

  it('strikes deleted words, the caret moving past them as Backspace and Delete do', () => {
    let state = at(stateOf([p('b1', 'Hello')]), 6);
    state = suggest(state, (s) => s.tr.delete(5, 6)).state;
    expect(state.selection.head).toBe(5);
    state = suggest(state, (s) => s.tr.delete(4, 5)).state;
    expect(
      articleSuggestionList({ blocks: blocksOf(state) }).map((e) => [e.suggestion.k, e.text]),
    ).toEqual([['del', 'lo']]);
    state = at(state, 1);
    state = suggest(state, (s) => s.tr.delete(1, 2)).state;
    expect(state.selection.head).toBe(2);
    expect(rejectedArticleFlow({ blocks: blocksOf(state) }).blocks).toEqual([p('b1', 'Hello')]);
  });

  it('takes the author’s own insertion out for real, and leaves another’s', () => {
    let state = at(stateOf([p('b1', 'ab')]), 2);
    state = suggest(state, (s) => s.tr.insertText('XY')).state;
    state = suggest(state, (s) => s.tr.delete(3, 4)).state;
    expect(articleSuggestionList({ blocks: blocksOf(state) })[0]!.text).toBe('X');
    const theirs = suggest(state, (s) => s.tr.delete(2, 3), kim).state;
    expect(articleSuggestionList({ blocks: blocksOf(theirs) }).map((e) => e.text)).toEqual(['X']);
  });

  it('replaces a selection with the old words struck and the new inserted after them', () => {
    const state = stateOf([p('b1', 'a cat sat')]);
    const out = suggest(state, (s) =>
      s.tr.setSelection(TextSelection.create(s.doc, 3, 6)).insertText('dog'),
    ).state;
    const blocks = { blocks: blocksOf(out) };
    expect(articleSuggestionList(blocks).map((e) => [e.suggestion.k, e.text])).toEqual([
      ['del', 'cat'],
      ['ins', 'dog'],
    ]);
    expect(acceptedArticleFlow(blocks).blocks).toEqual([p('b1', 'a dog sat')]);
  });

  it('puts a paragraph break in on Enter, and takes one out across a paragraph’s start', () => {
    let state = at(stateOf([p('b1', 'Hello world')]), 7);
    state = suggest(state, (s) => s.tr.split(7)).state;
    const split = blocksOf(state);
    expect(split).toHaveLength(2);
    expect((split[1] as { sg?: { k: string } }).sg?.k).toBe('ins');
    expect(rejectedArticleFlow({ blocks: split }).blocks).toEqual([p('b1', 'Hello world')]);
    // Backspace at the new paragraph's start: the author's own break goes for real.
    state = suggest(state, (s) => s.tr.delete(7, 9)).state;
    expect(blocksOf(state)).toEqual([p('b1', 'Hello world')]);
    // Someone else's paragraphs: the break is marked taken out, both paragraphs stay.
    let two = stateOf([p('b1', 'One'), p('b2', 'Two')]);
    two = suggest(two, (s) => s.tr.delete(4, 6)).state;
    const marked = blocksOf(two);
    expect((marked[1] as { sg?: { k: string } }).sg?.k).toBe('del');
    expect(acceptedArticleFlow({ blocks: marked }).blocks).toEqual([p('b1', 'OneTwo')]);
  });

  it('makes formatting a format change that remembers the format before', () => {
    let state = stateOf([p('b1', 'Make it bold')]);
    state = suggest(state, (s) => s.tr.addMark(9, 13, S.marks.bold.create())).state;
    const blocks = blocksOf(state) as unknown as [{ runs: unknown[] }];
    expect(blocks[0].runs[1]).toEqual({
      text: 'bold',
      b: true,
      sg: { id: 's1', k: 'fmt', by: 'key-sam', n: 'Sam', c: '#ff0066', at: 7, was: {} },
    });
    // Taking the bold off again leaves no change to suggest.
    state = suggest(state, (s) => s.tr.removeMark(9, 13, S.marks.bold)).state;
    expect(blocksOf(state)).toEqual([p('b1', 'Make it bold')]);
  });

  it('refuses what has no suggestion form: a block’s style, a footnote, a divider', () => {
    const state = stateOf([p('b1', 'Title'), { id: 'd', type: 'divider' }, p('b2', 'x')]);
    expect(
      suggest(state, (s) =>
        s.tr.setNodeMarkup(0, undefined, { ...s.doc.firstChild!.attrs, style: 'h1' }),
      ).refused,
    ).toBe(true);
    expect(suggest(state, (s) => s.tr.delete(6, 8)).refused).toBe(true);
    const note = S.nodes.footnote.create({ text: 'n' });
    expect(suggest(state, (s) => s.tr.insert(2, note)).refused).toBe(true);
    const table = Slice.maxOpen(Fragment.from(S.nodes.divider.create({ id: 'x' })));
    expect(suggest(state, (s) => s.tr.replace(2, 2, table)).refused).toBe(true);
  });

  it('lets a comment on words, a collaborator’s change, an undo and a decision pass as they are', () => {
    const state = stateOf([p('b1', 'Hello')]);
    const comment = suggest(state, (s) =>
      s.tr.addMark(1, 3, S.marks.note.create({ id: 'n1' })),
    ).state;
    expect((blocksOf(comment)[0] as { runs: { note?: string }[] }).runs[0]!.note).toBe('n1');
    expect(passesAsItIs(state.tr.insertText('x', 1).setMeta('article-remote', true))).toBe(true);
    expect(passesAsItIs(state.tr.insertText('x', 1).setMeta(SUGGEST_PASS, true))).toBe(true);
    expect(passesAsItIs(state.tr)).toBe(true);
  });

  it('pastes words without the suggestion marks they were copied with', () => {
    const marked = S.text('x', [S.marks.suggestion.create({ id: 'k', k: 'ins', by: 'key-kim' })]);
    const state = at(stateOf([p('b1', 'ab')]), 2);
    const out = suggest(state, (s) =>
      s.tr.replaceSelection(new Slice(Fragment.from(marked), 0, 0)),
    ).state;
    expect(articleSuggestionList({ blocks: blocksOf(out) })[0]!.suggestion.by).toBe('key-sam');
  });

  it('reads a run’s formatting', () => {
    expect(
      formatOf([
        S.marks.bold.create(),
        S.marks.link.create({ href: 'https://x.io' }),
        S.marks.color.create({ color: '#ff0000' }),
        S.marks.highlight.create({ color: '#00ff00' }),
      ]),
    ).toEqual({ b: true, href: 'https://x.io', color: '#ff0000', hl: '#00ff00' });
  });
});

describe('deciding suggestions', () => {
  const suggested = () => {
    let state = stateOf([p('b1', 'a cat sat'), p('b2', 'Two')]);
    state = suggest(state, (s) =>
      s.tr.setSelection(TextSelection.create(s.doc, 3, 6)).insertText('dog'),
    ).state;
    state = suggest(
      state,
      (s) => s.tr.delete(13, 15),
      sam,
      () => 'brk',
    ).state;
    return state;
  };
  it('accepts and rejects every suggestion as the stored form would', () => {
    const state = suggested();
    const flow = { blocks: blocksOf(state) };
    const accepted = state.apply(resolveSuggestionsTr(state, () => 'accept').tr);
    expect(blocksOf(accepted)).toEqual(acceptedArticleFlow(flow).blocks);
    const rejected = state.apply(resolveSuggestionsTr(state, () => 'reject').tr);
    expect(blocksOf(rejected)).toEqual(rejectedArticleFlow(flow).blocks);
  });
  it('decides one by id, and finds it at a position', () => {
    const state = suggested();
    const list = listSuggestions(state);
    expect(list.map((s) => s.k)).toEqual(['del', 'ins', 'del']);
    const found = suggestionAt(state, 4)!;
    expect(found).toMatchObject({ text: 'cat', isBreak: false });
    const brk = suggestionAt(state, 15)!;
    expect(brk).toMatchObject({ isBreak: true });
    const out = resolveSuggestionsTr(state, (s) => (s.id === found.attrs.id ? 'accept' : null));
    expect(out.decided).toBe(1);
    expect(listSuggestions(state.apply(out.tr))).toHaveLength(2);
    expect(selectFirstSuggestion(state, null)).not.toBeNull();
    expect(selectFirstSuggestion(state, 'cs-none')).toBeNull();
  });
  it('rejects a format change by putting the old format back', () => {
    let state = stateOf([p('b1', 'word')]);
    state = suggest(state, (s) => s.tr.addMark(1, 5, S.marks.italic.create())).state;
    const out = state.apply(resolveSuggestionsTr(state, () => 'reject').tr);
    expect(blocksOf(out)).toEqual([p('b1', 'word')]);
  });
});
