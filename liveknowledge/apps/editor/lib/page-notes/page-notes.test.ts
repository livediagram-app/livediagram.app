import { describe, expect, it } from 'vitest';
import { createElementAction, newArticleNote, type Element } from '@liveknowledge/document';
import { noteMarkStyles, pageNotesOf } from './page-notes';

const comment = (id: string, text: string) => ({
  id,
  text,
  createdAt: 1,
  authorName: 'Priya',
  authorColor: '#4f46e5',
});
const note = (id: string, extra: object) =>
  ({ ...newArticleNote(id, 'comment', { x: 0, y: 0 }), ...extra }) as unknown as Element;
const thread = (id: string, resolved = false, n = 1) =>
  note(id, {
    commentThread: {
      comments: Array.from({ length: n }, (_, i) => comment(`${id}${i}`, `Reply ${i}`)),
      resolved,
    },
  });
const action = (id: string, status: 'open' | 'done' = 'open') =>
  note(id, {
    articleNote: 'action',
    action: {
      ...createElementAction({
        name: 'Confirm the date',
        description: '',
        assignee: { userId: 'u2', name: 'Sam Lee' },
        teamId: 't',
        assigner: { id: 'u1', name: 'Priya' },
      }),
      status,
      due: '2026-12-03',
    },
  });
const words = (runs: object[]) => ({ f: { blocks: [{ id: 'b', type: 'paragraph', runs }] } });

describe('the page’s notes, as the Comments list reads them', () => {
  it('lists notes holding a conversation in the writing’s order, the detached after', () => {
    const tab = {
      elements: [thread('late'), action('act'), thread('gone'), note('empty', {})],
      articles: words([
        { text: 'First ', note: 'act' },
        { text: 'then ' },
        { text: 'last', note: 'late' },
        { text: 'nothing yet', note: 'empty' },
      ]),
    };
    const notes = pageNotesOf(tab);
    expect(notes.map((n) => [n.id, n.kind, n.quote])).toEqual([
      ['act', 'action', 'First '],
      ['late', 'comment', 'last'],
      ['gone', 'comment', null],
    ]);
    expect(notes[0]!.action?.due).toBe('2026-12-03');
  });

  it('counts a thread’s comments and keeps its newest, and reads open from the thread or the action', () => {
    const tab = {
      elements: [thread('a', false, 3), thread('b', true), action('c', 'done')],
      articles: words([
        { text: 'a', note: 'a' },
        { text: 'b', note: 'b' },
        { text: 'c', note: 'c' },
      ]),
    };
    const [a, b, c] = pageNotesOf(tab);
    expect(a).toMatchObject({ count: 3, open: true });
    expect(a!.latest?.text).toBe('Reply 2');
    expect(b!.open).toBe(false);
    expect(c!.open).toBe(false);
  });

  it('is empty, without reading the writing, on a page with no notes', () => {
    expect(pageNotesOf({ elements: [] })).toEqual([]);
  });
});

describe('the notes’ look', () => {
  it('takes a closed note’s tint off and a detached note’s marker out, and writes nothing otherwise', () => {
    const tab = {
      elements: [thread('open'), thread('done', true), action('closed', 'done'), thread('gone')],
      articles: words([
        { text: 'a', note: 'open' },
        { text: 'b', note: 'done' },
        { text: 'c', note: 'closed' },
      ]),
    };
    const css = noteMarkStyles(tab);
    expect(css).toContain('.article-flow [data-note-id="done"]');
    expect(css).toContain('.article-flow [data-note-id="closed"]');
    expect(css).not.toContain('"open"');
    expect(css).toContain('[data-article-note][data-element-id="gone"]{visibility:hidden}');
    expect(
      noteMarkStyles({ elements: [thread('x')], articles: words([{ text: 'x', note: 'x' }]) }),
    ).toBe('');
  });

  it('escapes an id that is not a plain token, so it cannot break out of the selector', () => {
    const css = noteMarkStyles({ elements: [thread('a"]{}*{')], articles: words([]) });
    expect(css).not.toContain('a"]');
  });
});
