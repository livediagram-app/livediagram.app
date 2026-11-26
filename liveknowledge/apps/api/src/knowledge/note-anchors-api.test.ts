import { describe, expect, it } from 'vitest';
import { newArticleNote, type Element, type Tab } from '@liveknowledge/document';
import { savedPageChanged } from './page-authors';
import { restoredTab } from '../versions/restore-tab';
import { threadsOfTab } from '../comments';

// The api's half of comments on a page's words (docs/specs/030-knowledgebase/page-comments.md "Comments on the
// writing", Work Tracker 1484): a note is not an edit, a restore keeps the notes, and the thread listing says where
// each note's thread sits.

const comment = {
  id: 'c1',
  text: 'Still Tuesday?',
  createdAt: 1,
  authorName: 'Priya',
  authorColor: '#4f46e5',
};
const talked = (id: string, resolved = false) =>
  ({
    ...newArticleNote(id, 'comment', { x: 900, y: 120 }),
    commentThread: { comments: [comment], resolved },
  }) as unknown as Element;
const flow = (runs: object[]) => ({ f: { blocks: [{ id: 'b', type: 'paragraph', runs }] } });
const page = (runs: object[], elements: Element[] = [], extra: Partial<Tab> = {}): Tab =>
  ({
    id: 't1',
    name: 'Release Process',
    pages: [{ id: 'p', orientation: 'portrait', kind: 'article', flow: 'f' }],
    articles: flow(runs),
    elements,
    ...extra,
  }) as unknown as Tab;

describe('a note is not an edit of the page', () => {
  const before = page([{ text: 'Ships on Tuesday.' }]);

  it('moves no Updated when only a note’s mark and its marker arrive', () => {
    const after = page(
      [{ text: 'Ships on ' }, { text: 'Tuesday', note: 'n1' }, { text: '.' }],
      [talked('n1')],
    );
    // The runs the mark split read as the same words.
    expect(savedPageChanged(before, after)).toBe(false);
    const sameRuns = page([{ text: 'Ships on Tuesday.', note: 'n1' }], [talked('n1')]);
    expect(savedPageChanged(before, sameRuns)).toBe(false);
    expect(
      savedPageChanged(
        sameRuns,
        page([{ text: 'Ships on Tuesday.', note: 'n1' }], [talked('n1', true)]),
      ),
    ).toBe(false);
  });

  it('still moves it for a change to the words or the objects', () => {
    expect(savedPageChanged(before, page([{ text: 'Ships on Wednesday.' }]))).toBe(true);
    const square = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 9,
      height: 9,
    } as Element;
    expect(savedPageChanged(before, page([{ text: 'Ships on Tuesday.' }], [square]))).toBe(true);
  });
});

describe('a version restored', () => {
  it('keeps a note made since, with its thread, detached', () => {
    const stored = page([{ text: 'Ships on ' }, { text: 'Tuesday', note: 'n1' }], [talked('n1')]);
    const version = {
      pages: stored.pages,
      articles: flow([{ text: 'Ships on Monday' }]),
      elements: [],
    };
    const next = restoredTab(stored, version as unknown as Parameters<typeof restoredTab>[1]);
    expect(next.elements.map((e) => e.id)).toEqual(['n1']);
    const [thread] = threadsOfTab({ ...next, name: 'Release Process' }, 'all', null);
    expect(thread!.anchor).toEqual({ detached: true });
  });

  it('keeps a note anchored when the version holds its words', () => {
    const stored = page([{ text: 'Tuesday', note: 'n1' }, { text: ' later' }], [talked('n1')]);
    const version = {
      pages: stored.pages,
      articles: flow([{ text: 'Tuesday', note: 'n1' }]),
      elements: [],
    };
    const next = restoredTab(stored, version as unknown as Parameters<typeof restoredTab>[1]);
    const [thread] = threadsOfTab({ ...next, name: 'Release Process' }, 'all', null);
    expect(thread!.anchor).toEqual({ text: 'Tuesday' });
  });
});

describe('the thread listing’s anchor', () => {
  it('quotes the saved words, says detached once they are gone, and leaves a draft’s words unread', () => {
    const tab = page(
      [{ text: 'Ask ' }, { text: 'Sam', note: 'n1' }],
      [talked('n1'), talked('gone'), talked('drafted')],
      {
        articles: {
          ...flow([{ text: 'Ask ' }, { text: 'Sam', note: 'n1' }]),
          draft: {
            blocks: [
              { id: 'd', type: 'paragraph', runs: [{ text: 'secret plan', note: 'drafted' }] },
            ],
          },
        },
      } as Partial<Tab>,
    );
    const threads = threadsOfTab({ ...tab, name: 'Release Process' }, 'all', null);
    const byId = new Map(threads.map((t) => [t.elementId, t]));
    expect(byId.get('n1')!.anchor).toEqual({ text: 'Sam' });
    expect(byId.get('gone')!.anchor).toEqual({ detached: true });
    expect(byId.get('drafted')!.anchor).toBeUndefined();
    expect(JSON.stringify(threads)).not.toContain('secret plan');
  });
});
