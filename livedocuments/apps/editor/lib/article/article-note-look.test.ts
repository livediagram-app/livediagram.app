// A margin note's look and name (docs/specs/007-editor/article-pages.md "Comments and actions"):
// a comment and an action never share a face or a name, and each says where it stands.
import { describe, expect, it } from 'vitest';
import {
  newArticleNote,
  type ArticleNoteElement,
  type CommentThread,
  type ElementAction,
} from '@livedocuments/document';
import { elementAriaLabel } from '@/lib/element-names';
import { NOTE_INK, noteAriaLabel, noteLook } from './article-note-look';

const thread = (n: number, resolved = false): CommentThread => ({
  resolved,
  comments: Array.from({ length: n }, (_, i) => ({
    id: String(i),
    text: 'c',
    authorName: 'Me',
    authorColor: '#000',
    createdAt: 0,
  })),
});
const action = (status: ElementAction['status'], name: string | null = 'Sam Lee') =>
  ({
    id: 'a',
    name: 'Check it',
    description: '',
    assignee: { userId: 'u1', name },
    teamId: null,
    assignerId: 'me',
    assignerName: 'Me',
    status,
    createdAt: 0,
    updatedAt: 0,
  }) as ElementAction;
const comment = (t?: CommentThread): ArticleNoteElement => ({
  ...newArticleNote('n', 'comment', { x: 0, y: 0 }),
  commentThread: t,
});
const act = (a?: ElementAction): ArticleNoteElement => ({
  ...newArticleNote('n', 'action', { x: 0, y: 0 }),
  action: a,
});

describe('noteLook', () => {
  it('gives a comment and an action different faces in every state', () => {
    const comments = [comment(), comment(thread(2)), comment(thread(2, true))].map(
      (e) => noteLook(e).face,
    );
    const actions = [act(), act(action('open')), act(action('done')), act(action('wont-do'))].map(
      (e) => noteLook(e).face,
    );
    expect(comments).toEqual(['comment', 'comment', 'comment-resolved']);
    expect(actions).toEqual(['action-open', 'action-open', 'action-done', 'action-wont-do']);
    for (const c of comments) expect(actions).not.toContain(c);
  });

  it("counts a comment's open comments", () => {
    expect(noteLook(comment(thread(3)))).toEqual({ face: 'comment', open: 3 });
    expect(noteLook(comment())).toEqual({ face: 'comment', open: 0 });
  });

  it("carries an action's assignee, null before one is assigned", () => {
    const look = noteLook(act(action('open')));
    expect(look.face === 'action-open' && look.assignee?.initials).toBe('SL');
    expect(noteLook(act())).toEqual({ face: 'action-open', assignee: null });
  });
});

describe('note colours', () => {
  it('keeps both notes off the amber chrome and apart from each other', () => {
    const all: string[] = [...Object.values(NOTE_INK.comment), ...Object.values(NOTE_INK.action)];
    // Tailwind amber 50 to 900, the brand's own scale.
    const amber = [
      '#fffbeb',
      '#fef3c7',
      '#fde68a',
      '#fcd34d',
      '#fbbf24',
      '#f59e0b',
      '#d97706',
      '#b45309',
      '#92400e',
      '#78350f',
    ];
    for (const a of amber) expect(all).not.toContain(a);
    expect(NOTE_INK.comment.ink).not.toBe(NOTE_INK.action.ink);
  });
});

describe('noteAriaLabel', () => {
  it('names which it is and where it stands', () => {
    expect(noteAriaLabel(comment())).toBe('Comment, no comments yet');
    expect(noteAriaLabel(comment(thread(2)))).toBe('Comment, 2 open');
    expect(noteAriaLabel(comment(thread(2, true)))).toBe('Comment, resolved');
    expect(noteAriaLabel(act())).toBe('Action, not assigned yet');
    expect(noteAriaLabel(act(action('open')))).toBe('Action for Sam Lee');
    expect(noteAriaLabel(act(action('done')))).toBe('Action for Sam Lee, done');
    expect(noteAriaLabel(act(action('wont-do')))).toBe("Action for Sam Lee, won't do");
    expect(noteAriaLabel(act(action('open', null)))).toBe('Action for a teammate');
  });

  it("is the marker's element name", () => {
    expect(elementAriaLabel(act(action('done')))).toBe('Action for Sam Lee, done');
  });
});
