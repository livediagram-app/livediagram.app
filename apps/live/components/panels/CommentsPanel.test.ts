import { describe, expect, it } from 'vitest';
import type { BoxedElement, Comment } from '@livediagram/diagram';
import { commentRowsFromElements } from '@/components/panels/CommentsPanel';

// commentRowsFromElements turns a tab's element list into the rows
// the floating Comments panel renders (one per element-with-
// comments, newest-first). A regression here breaks the panel
// silently: it renders the wrong label, the wrong author dot, the
// wrong "X minutes ago" stamp, or the wrong order with discussion
// at the bottom. Cover every visible branch.

function mkComment(text: string, createdAt: number, author = 'Alice', color = '#0ea5e9'): Comment {
  return { id: `c-${createdAt}`, text, createdAt, authorName: author, authorColor: color };
}

function mkShape(
  id: string,
  comments: Comment[],
  opts: { label?: string; resolved?: boolean } = {},
): BoxedElement {
  return {
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...(opts.label !== undefined ? { label: opts.label } : {}),
    ...(comments.length > 0
      ? { commentThread: { comments, resolved: opts.resolved ?? false } }
      : {}),
  } as BoxedElement;
}

describe('commentRowsFromElements', () => {
  it('returns [] for an empty element list', () => {
    expect(commentRowsFromElements([])).toEqual([]);
  });

  it('skips elements without a commentThread', () => {
    const plain = mkShape('a', []);
    expect(commentRowsFromElements([plain])).toEqual([]);
  });

  it('skips elements whose commentThread is empty (zero-comment thread is a no-op)', () => {
    // Threads with comments: [] occur after a user deletes every
    // comment on an element. We treat that as "no discussion to
    // show", same shape as never-commented.
    const empty: BoxedElement = {
      id: 'e',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      commentThread: { comments: [], resolved: false },
    } as BoxedElement;
    expect(commentRowsFromElements([empty])).toEqual([]);
  });

  it('emits one row per element with at least one comment', () => {
    const el = mkShape('a', [mkComment('hi', 100)], { label: 'Node A' });
    const rows = commentRowsFromElements([el]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      elementId: 'a',
      label: 'Node A',
      count: 1,
      resolved: false,
      latestText: 'hi',
      latestAt: 100,
      latestAuthorName: 'Alice',
      latestAuthorColor: '#0ea5e9',
    });
  });

  it('uses the LAST comment in the array as the row preview, not the first', () => {
    // The thread stores comments in chronological order (oldest at
    // index 0, newest at length-1). The panel shows the newest as
    // the row preview because that's the active discussion.
    const el = mkShape('a', [
      mkComment('first', 100, 'Alice', '#0ea5e9'),
      mkComment('second', 200, 'Bob', '#22c55e'),
      mkComment('third', 300, 'Carol', '#a855f7'),
    ]);
    const [row] = commentRowsFromElements([el]);
    expect(row!.count).toBe(3);
    expect(row!.latestText).toBe('third');
    expect(row!.latestAt).toBe(300);
    expect(row!.latestAuthorName).toBe('Carol');
    expect(row!.latestAuthorColor).toBe('#a855f7');
  });

  it('falls back to "Untitled" when the element has no label', () => {
    const el = mkShape('a', [mkComment('hi', 100)]);
    expect(commentRowsFromElements([el])[0]!.label).toBe('Untitled');
  });

  it('falls back to "Untitled" when the label is whitespace-only', () => {
    // The row would otherwise read as a blank entry, which looks
    // like a render bug. Trim + empty check matches the title
    // treatment elsewhere in the editor.
    const el = mkShape('a', [mkComment('hi', 100)], { label: '   ' });
    expect(commentRowsFromElements([el])[0]!.label).toBe('Untitled');
  });

  it('trims surrounding whitespace from a non-empty label', () => {
    const el = mkShape('a', [mkComment('hi', 100)], { label: '  My Node  ' });
    expect(commentRowsFromElements([el])[0]!.label).toBe('My Node');
  });

  it('carries the resolved flag through to the row', () => {
    const el = mkShape('a', [mkComment('hi', 100)], { resolved: true });
    expect(commentRowsFromElements([el])[0]!.resolved).toBe(true);
  });

  it('sorts rows newest-first by latestAt across many elements', () => {
    // Three elements with overlapping discussion timelines: the row
    // order must reflect "where is the active discussion right now",
    // not the element-list order. A regression here pushes active
    // threads below resolved-but-recently-touched ones.
    const oldest = mkShape('old', [mkComment('a', 100)], { label: 'Old' });
    const newest = mkShape('new', [mkComment('c', 300)], { label: 'New' });
    const middle = mkShape('mid', [mkComment('b', 200)], { label: 'Mid' });
    // Pass them deliberately out of order (oldest, newest, middle)
    // so the sort actually has to do work.
    const rows = commentRowsFromElements([oldest, newest, middle]);
    expect(rows.map((r) => r.elementId)).toEqual(['new', 'mid', 'old']);
  });

  it('keeps resolved threads in the list (dimmed treatment lives in the row, not the filter)', () => {
    // Resolved threads still surface so the user can jump back to
    // them. The CommentsPanel dims the row visually; the helper
    // doesn't filter them out.
    const resolved = mkShape('r', [mkComment('done', 100)], { resolved: true });
    const open = mkShape('o', [mkComment('todo', 200)]);
    const rows = commentRowsFromElements([resolved, open]);
    expect(rows.map((r) => r.elementId)).toEqual(['o', 'r']);
    expect(rows.find((r) => r.elementId === 'r')!.resolved).toBe(true);
  });
});
