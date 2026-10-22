import { describe, expect, it } from 'vitest';
import type { ActionRow, CommentRow } from '@/components/panels/CollaboratePanel';
import {
  emptyCopy,
  firstName,
  kindCounts,
  rowsFor,
  sectionsFor,
  showKindChips,
} from './collaborate-model';

// The Collaborate panel's view rules (docs/specs/012-collaboration/assigned-actions.md §5).

const comment = (id: string, at: number, resolved = false): CommentRow => ({
  elementId: id,
  label: id,
  count: 1,
  latestAuthorName: 'Priya Shah',
  latestAuthorColor: '#db2777',
  latestText: 'hi',
  latestAt: at,
  resolved,
});

const action = (
  id: string,
  at: number,
  status: 'open' | 'done' = 'open',
  mine = false,
): ActionRow => ({
  elementId: id,
  label: id,
  actionName: id,
  status,
  assigneeName: 'Sam',
  mine,
  createdAt: at,
});

const ids = (rows: ReturnType<typeof rowsFor>) =>
  rows.map((r) => (r.kind === 'action' ? r.action.elementId : r.comment.elementId));

describe('rowsFor', () => {
  const comments = [comment('c-open', 30), comment('c-done', 40, true)];
  const actions = [
    action('a-open', 20),
    action('a-mine', 10, 'open', true),
    action('a-done', 50, 'done'),
  ];

  it('puts your own actions first, then everything newest-first', () => {
    expect(ids(rowsFor('open', 'all', comments, actions))).toEqual(['a-mine', 'c-open', 'a-open']);
  });

  it('splits resolved threads and completed actions onto the Resolved side', () => {
    expect(ids(rowsFor('resolved', 'all', comments, actions))).toEqual(['a-done', 'c-done']);
  });

  it('narrows to one kind', () => {
    expect(ids(rowsFor('open', 'comments', comments, actions))).toEqual(['c-open']);
    expect(ids(rowsFor('open', 'actions', comments, actions))).toEqual(['a-mine', 'a-open']);
  });
});

describe('kindCounts + showKindChips', () => {
  it('counts each kind on one side', () => {
    const counts = kindCounts('open', [comment('c', 1), comment('r', 2, true)], [action('a', 1)]);
    expect(counts).toEqual({ all: 2, comments: 1, actions: 1 });
  });

  it('shows the chips only when the tab has both kinds', () => {
    expect(showKindChips([comment('c', 1)], [action('a', 1)])).toBe(true);
    expect(showKindChips([comment('c', 1)], [])).toBe(false);
    expect(showKindChips([], [action('a', 1)])).toBe(false);
  });
});

describe('sectionsFor', () => {
  it('splits Open into For You and Everything Else when both have rows', () => {
    const rows = rowsFor('open', 'all', [comment('c', 5)], [action('mine', 1, 'open', true)]);
    expect(sectionsFor('open', rows).map((s) => s.label)).toEqual(['For You', 'Everything Else']);
  });

  it('uses no headings for a single group or the Resolved side', () => {
    const onlyOthers = rowsFor('open', 'all', [comment('c', 5)], []);
    expect(sectionsFor('open', onlyOthers).map((s) => s.label)).toEqual([null]);
    const resolved = rowsFor('resolved', 'all', [], [action('mine', 1, 'done', true)]);
    expect(sectionsFor('resolved', resolved).map((s) => s.label)).toEqual([null]);
  });
});

describe('emptyCopy', () => {
  it('has a Title Case heading and a line for every view', () => {
    for (const side of ['open', 'resolved'] as const)
      for (const kind of ['all', 'comments', 'actions'] as const) {
        const { heading, line } = emptyCopy(side, kind);
        expect(
          heading.split(' ').every((w) => /^[A-Z]/.test(w)),
          heading,
        ).toBe(true);
        expect(line.length).toBeGreaterThan(0);
        expect(`${heading}${line}`).not.toContain(String.fromCharCode(0x2014));
      }
    expect(emptyCopy('open', 'all').heading).toBe('All Caught Up');
  });
});

describe('firstName', () => {
  it('takes the first word of a name', () => {
    expect(firstName('Priya Shah')).toBe('Priya');
    expect(firstName('  Sam ')).toBe('Sam');
    expect(firstName('')).toBe('');
  });
});
