// @vitest-environment jsdom

// A margin note's face (docs/specs/007-editor/article-pages.md "Comments and actions"): a comment
// and an action draw different glyphs on differently shaped chips, and resolved and done show.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  newArticleNote,
  type ArticleNoteElement,
  type ElementAction,
} from '@livedocuments/document';
import { describeVariant } from '@/components/canvas/element-variant';
import { ArticleNoteFace } from './ArticleNoteFace';

afterEach(() => cleanup());

const thread = (n: number, resolved = false) => ({
  resolved,
  comments: Array.from({ length: n }, (_, i) => ({
    id: String(i),
    text: 'c',
    authorName: 'Me',
    authorColor: '#000',
    createdAt: 0,
  })),
});
const action = (status: ElementAction['status']) =>
  ({
    id: 'a',
    name: 'Check it',
    description: '',
    assignee: { userId: 'u1', name: 'Sam Lee' },
    teamId: null,
    assignerId: 'me',
    assignerName: 'Me',
    status,
    createdAt: 0,
    updatedAt: 0,
  }) as ElementAction;
const note = (kind: 'comment' | 'action', extra: Partial<ArticleNoteElement> = {}) =>
  ({ ...newArticleNote('n', kind, { x: 0, y: 0 }), ...extra }) as ArticleNoteElement;

function face(el: ArticleNoteElement): HTMLElement {
  const { container } = render(<ArticleNoteFace element={el} />);
  return container.querySelector('[data-note-face]') as HTMLElement;
}

describe('ArticleNoteFace', () => {
  it('draws a speech bubble for a comment and a ringed tick for an action', () => {
    const c = face(note('comment', { commentThread: thread(2) }));
    expect(c.dataset.noteFace).toBe('comment');
    expect(c.textContent).toBe('2');
    expect(c.querySelector('circle')).toBeNull();
    cleanup();
    const a = face(note('action', { action: action('open') }));
    expect(a.dataset.noteFace).toBe('action-open');
    expect(a.querySelector('circle')?.getAttribute('fill')).toBe('none');
    expect(a.querySelector('[data-note-assignee]')?.textContent).toBe('SL');
  });

  it('shows a resolved comment as a tick in an outlined bubble', () => {
    const c = face(note('comment', { commentThread: thread(2, true) }));
    expect(c.dataset.noteFace).toBe('comment-resolved');
    expect(c.querySelector('path')?.getAttribute('fill')).toBe('none');
    expect(c.textContent).toBe('');
  });

  it("fills a done action solid emerald and Won't Do slate, with no assignee mark", () => {
    const done = face(note('action', { action: action('done') }));
    expect(done.dataset.noteFace).toBe('action-done');
    expect(done.querySelector('circle')?.getAttribute('fill')).toBe('#047857');
    expect(done.querySelector('[data-note-assignee]')).toBeNull();
    cleanup();
    const wont = face(note('action', { action: action('wont-do') }));
    expect(wont.dataset.noteFace).toBe('action-wont-do');
    expect(wont.querySelector('circle')?.getAttribute('fill')).toBe('#64748b');
  });

  it('rounds a comment chip and squares an action chip, in neither note amber', () => {
    const comment = describeVariant(note('comment'), false, false, null).style;
    const act = describeVariant(note('action'), false, false, null).style;
    expect(comment.borderRadius).toBe('50%');
    expect(act.borderRadius).toBe(8);
    expect(comment.backgroundColor).not.toBe(act.backgroundColor);
    expect(comment.borderColor).not.toBe(act.borderColor);
  });
});
