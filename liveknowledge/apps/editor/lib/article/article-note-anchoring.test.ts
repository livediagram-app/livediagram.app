// A comment or an action on some words stays on them through edits (docs/specs/030-knowledgebase/page-comments.md
// "Comments on the writing", Work Tracker 1484): the anchor is a `note` mark in the writing, never an offset, so text
// typed before, after or inside it, a co-editor's change elsewhere, and undoing a delete all keep it on its words;
// deleting every word it was on keeps a note holding a conversation, detached, and drops an empty one.
import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import {
  articleNoteIds,
  noteAnchorTexts,
  newArticleNote,
  withEmptyNoteMarkersRemoved,
  detachedNoteIds,
  type ArticleBlock,
  type Element,
} from '@liveknowledge/document';
import { articleSchema } from './article-schema';
import { blocksToDoc, docToBlocks } from './article-convert';

const START: ArticleBlock[] = [
  { id: 'p1', type: 'paragraph', runs: [{ text: 'The release train leaves on Tuesday.' }] },
  { id: 'p2', type: 'paragraph', runs: [{ text: 'Ask Sam before you ship.' }] },
];

function stateOf(blocks: readonly ArticleBlock[]) {
  return EditorState.create({ doc: blocksToDoc(blocks) });
}
// The position of `word` in the writing.
function at(state: EditorState, word: string): number {
  let found = -1;
  state.doc.descendants((node, pos) => {
    if (found >= 0 || !node.isText) return;
    const i = node.text!.indexOf(word);
    if (i >= 0) found = pos + i;
  });
  if (found < 0) throw new Error(`no ${word}`);
  return found;
}
function marked(state: EditorState, word: string, id = 'n1') {
  const from = at(state, word);
  const mark = articleSchema.marks.note.create({ id, kind: 'comment' });
  return state.apply(state.tr.addMark(from, from + word.length, mark));
}
const quoteOf = (state: EditorState, id = 'n1') =>
  noteAnchorTexts({ f: { blocks: docToBlocks(state.doc) } }).get(id);

describe('a note’s anchor through edits', () => {
  const noted = marked(stateOf(START), 'Tuesday');

  it('stays on its words as text is typed before and after them', () => {
    let s = noted;
    s = s.apply(s.tr.insertText('Heads up: ', at(s, 'The')));
    s = s.apply(s.tr.insertText(' at noon', at(s, '.')));
    expect(quoteOf(s)).toBe('Tuesday');
  });

  it('takes no text typed right after it (the mark is not inclusive)', () => {
    const end = at(noted, 'Tuesday') + 'Tuesday'.length;
    const s = noted.apply(
      noted.tr.setSelection(TextSelection.create(noted.doc, end)).insertText(' morning'),
    );
    expect(quoteOf(s)).toBe('Tuesday');
  });

  it('keeps the words left when only some of them are deleted', () => {
    const from = at(noted, 'Tuesday');
    const s = noted.apply(noted.tr.delete(from, from + 3));
    expect(quoteOf(s)).toBe('sday');
  });

  it('moves with its paragraph when another paragraph is added above', () => {
    const s = noted.apply(
      noted.tr.insert(
        0,
        articleSchema.nodes.paragraph.create({ id: 'p0' }, articleSchema.text('New first line.')),
      ),
    );
    expect(quoteOf(s)).toBe('Tuesday');
  });

  it('comes back on undo after its words were deleted', () => {
    const from = at(noted, 'Tuesday');
    const del = noted.tr.delete(from, from + 'Tuesday'.length);
    const cut = noted.apply(del);
    expect(articleNoteIds({ f: { blocks: docToBlocks(cut.doc) } }).has('n1')).toBe(false);
    // Undo is the delete's step inverted, as the editor's history applies it.
    const back = cut.apply(cut.tr.step(del.steps[0]!.invert(noted.doc)));
    expect(quoteOf(back)).toBe('Tuesday');
  });
});

describe('deleting every word a note was on', () => {
  const talked = {
    ...newArticleNote('n1', 'comment', { x: 0, y: 0 }),
    commentThread: {
      comments: [
        {
          id: 'c',
          text: 'Still Tuesday?',
          createdAt: 1,
          authorName: 'Priya',
          authorColor: '#4f46e5',
        },
      ],
      resolved: false,
    },
  } as unknown as Element;
  const empty = newArticleNote('n2', 'comment', { x: 0, y: 40 }) as unknown as Element;

  it('keeps the note holding a comment, detached, and drops the empty one', () => {
    let s = marked(marked(stateOf(START), 'Tuesday', 'n1'), 'Sam', 'n2');
    for (const word of ['Tuesday', 'Sam']) {
      const from = at(s, word);
      s = s.apply(s.tr.delete(from, from + word.length));
    }
    const blocks = docToBlocks(s.doc);
    const gone = new Set(['n1', 'n2'].filter((id) => !articleNoteIds({ f: { blocks } }).has(id)));
    const tab = withEmptyNoteMarkersRemoved(
      { elements: [talked, empty], articles: { f: { blocks } } },
      gone,
    );
    expect(tab.elements.map((e) => e.id)).toEqual(['n1']);
    expect([...detachedNoteIds(tab)]).toEqual(['n1']);
  });
});
