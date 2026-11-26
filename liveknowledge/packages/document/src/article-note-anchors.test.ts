import { describe, expect, it } from 'vitest';
import {
  NOTE_ANCHOR_MAX,
  articlesWithoutNoteMarks,
  detachedNoteIds,
  noteAnchorTexts,
  noteHoldsConversation,
  withAbandonedNoteDropped,
  withEmptyNoteMarkersRemoved,
  withHeldNotesKept,
} from './article-note-anchors';
import { newArticleNote } from './article-notes';
import { createElementAction } from './element-action';
import type { Element } from './index';

const comment = {
  id: 'c1',
  text: 'Is this still true?',
  createdAt: 1,
  authorName: 'Priya',
  authorColor: '#4f46e5',
};
const marker = (id: string, extra: object = {}) =>
  ({ ...newArticleNote(id, 'comment', { x: 0, y: 0 }), ...extra }) as unknown as Element;
const talked = (id: string) =>
  marker(id, { commentThread: { comments: [comment], resolved: false } });
const acted = (id: string) =>
  marker(id, {
    articleNote: 'action',
    action: createElementAction({
      name: 'Check it',
      description: '',
      assignee: { userId: 'u2', name: 'Sam' },
      teamId: 't',
      assigner: { id: 'u1', name: 'Priya' },
    }),
  });
const writing = (runs: object[]) => ({ f: { blocks: [{ id: 'b', type: 'paragraph', runs }] } });

describe('a note holding a conversation', () => {
  it('holds one with a comment or an action, not an empty one', () => {
    expect(noteHoldsConversation(talked('n'))).toBe(true);
    expect(noteHoldsConversation(acted('n'))).toBe(true);
    expect(noteHoldsConversation(marker('n'))).toBe(false);
    expect(
      noteHoldsConversation(marker('n', { commentThread: { comments: [], resolved: false } })),
    ).toBe(false);
  });
});

describe('deleting the words a note is on', () => {
  it('keeps a note holding a comment or an action, detached, and drops an empty one', () => {
    const tab = { elements: [talked('a'), acted('b'), marker('c')] };
    const next = withEmptyNoteMarkersRemoved(tab, new Set(['a', 'b', 'c']));
    expect(next.elements.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('is the same tab when nothing goes', () => {
    const tab = { elements: [talked('a')] };
    expect(withEmptyNoteMarkersRemoved(tab, new Set())).toBe(tab);
    expect(withEmptyNoteMarkersRemoved(tab, new Set(['a']))).toBe(tab);
  });

  it('tells a detached note from an anchored one, the draft counting as writing', () => {
    const tab = {
      elements: [talked('a'), talked('b'), talked('d')],
      articles: {
        ...writing([{ text: 'kept', note: 'a' }]),
        draft: { blocks: [{ id: 'x', type: 'paragraph', runs: [{ text: 'new', note: 'd' }] }] },
      },
    };
    expect([...detachedNoteIds(tab)]).toEqual(['b']);
    expect(detachedNoteIds({ elements: [] }).size).toBe(0);
  });
});

describe('a note anchor', () => {
  it('quotes each note’s words in the writing’s order, joined across runs', () => {
    const quotes = noteAnchorTexts(
      writing([
        { text: 'The ' },
        { text: 'release ', note: 'b' },
        { text: 'train', note: 'b', bold: true },
        { text: ' leaves on ' },
        { text: 'Tuesday', note: 'a' },
      ]),
    );
    expect([...quotes.entries()]).toEqual([
      ['b', 'release train'],
      ['a', 'Tuesday'],
    ]);
  });

  it('cuts a long anchor at NOTE_ANCHOR_MAX', () => {
    const quotes = noteAnchorTexts(
      writing([
        { text: 'x'.repeat(500), note: 'a' },
        { text: 'y', note: 'a' },
      ]),
    );
    expect(quotes.get('a')).toHaveLength(NOTE_ANCHOR_MAX);
  });

  it('survives edits around it: the mark rides the runs, never an offset', () => {
    const before = noteAnchorTexts(writing([{ text: 'Ship on ' }, { text: 'Friday', note: 'a' }]));
    const after = noteAnchorTexts(
      writing([
        { text: 'We now plan to ship on ' },
        { text: 'Friday', note: 'a' },
        { text: ', weather allowing.' },
      ]),
    );
    expect(after.get('a')).toBe(before.get('a'));
  });
});

describe('telling an edit from a comment', () => {
  it('reads the writing without its notes’ marks, the same object when there are none', () => {
    const plain = writing([{ text: 'Hello' }]);
    expect(articlesWithoutNoteMarks(plain)).toBe(plain);
    const marked = writing([{ text: 'Hello', note: 'a', nk: 'action' }]);
    expect(articlesWithoutNoteMarks(marked)).toEqual(plain);
  });
});

describe('a version restored', () => {
  it('keeps the notes made since, holding a conversation, and nothing else', () => {
    const restored = { elements: [marker('old')] };
    const stored = { elements: [marker('old'), talked('since'), marker('empty')] };
    expect(withHeldNotesKept(restored, stored).elements.map((e) => e.id)).toEqual(['old', 'since']);
    expect(withHeldNotesKept(restored, { elements: [marker('old')] })).toBe(restored);
  });
});

describe('a note left holding nothing', () => {
  it('takes its mark and its marker off together, and keeps one holding a conversation', () => {
    const tab = {
      elements: [marker('a'), talked('b')],
      articles: writing([
        { text: 'Ship ' },
        { text: 'on', note: 'a', nk: 'comment' },
        { text: ' Friday', note: 'b' },
      ]),
    };
    const next = withAbandonedNoteDropped(tab, 'a');
    expect(next.elements.map((e) => e.id)).toEqual(['b']);
    expect(next.articles).toEqual(writing([{ text: 'Ship on' }, { text: ' Friday', note: 'b' }]));
    expect(withAbandonedNoteDropped(tab, 'b')).toBe(tab);
    expect(withAbandonedNoteDropped(tab, 'gone')).toBe(tab);
    expect(withAbandonedNoteDropped({ elements: [marker('a')] }, 'a').elements).toEqual([]);
  });
});
