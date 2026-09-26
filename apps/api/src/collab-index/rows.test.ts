import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/diagram';
import { collabIndexRowsFromElements } from './rows';

// The pure projection every tab write feeds the collaboration index
// with (docs/specs/013-workspace/activity-page.md §2.1). What it gets wrong, the Activity page shows
// wrong for every reader, so the shapes are pinned here.

const shape = (id: string, label: string, extra: Record<string, unknown> = {}): Element =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    label,
    ...extra,
  }) as never;

const comment = (id: string, at: number, authorId?: string, text = `c-${id}`) => ({
  id,
  text,
  createdAt: at,
  authorName: `Author ${id}`,
  authorColor: `#${id}`,
  ...(authorId ? { authorId } : {}),
});

const action = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  name: 'Confirm the retry budget',
  description: '',
  assignee: { userId: 'user_b', name: 'Priya' },
  teamId: 'team-1',
  assignerId: 'user_a',
  assignerName: 'Sam',
  status: 'open',
  createdAt: 100,
  updatedAt: 150,
  ...over,
});

describe('collabIndexRowsFromElements', () => {
  it('yields nothing for a tab with no actions or threads', () => {
    expect(collabIndexRowsFromElements([shape('s1', 'Plain')])).toEqual({
      actions: [],
      threads: [],
    });
  });

  it('projects an action with its element label and identities', () => {
    const { actions } = collabIndexRowsFromElements([
      shape('s1', ' Retry ', {
        action: action({ assignee: { userId: null, memberId: 'm-9', name: 'Ana' } }),
      }),
    ]);
    expect(actions).toEqual([
      {
        elementId: 's1',
        actionId: 'a1',
        elementLabel: 'Retry',
        name: 'Confirm the retry budget',
        description: '',
        status: 'open',
        assigneeUserId: null,
        assigneeMemberId: 'm-9',
        assigneeName: 'Ana',
        assignerId: 'user_a',
        assignerName: 'Sam',
        teamId: 'team-1',
        createdAt: 100,
        updatedAt: 150,
      },
    ]);
  });

  it('keeps done actions (the read filters on status)', () => {
    const { actions } = collabIndexRowsFromElements([
      shape('s1', 'x', { action: action({ status: 'done' }) }),
    ]);
    expect(actions[0]!.status).toBe('done');
  });

  it('projects a thread: latest by timestamp, distinct participants, first/latest times', () => {
    const { threads } = collabIndexRowsFromElements([
      shape('s1', 'Checkout', {
        commentThread: {
          resolved: false,
          comments: [
            comment('1', 10, 'guest-1'),
            comment('2', 30, 'user_b', 'newest'),
            comment('3', 20, 'guest-1'),
            comment('4', 5), // pre-authorId comment: counted, not attributed
          ],
        },
      }),
    ]);
    expect(threads).toEqual([
      {
        elementId: 's1',
        elementLabel: 'Checkout',
        resolved: false,
        commentCount: 4,
        participantIds: ['guest-1', 'user_b'],
        latestText: 'newest',
        latestAuthorName: 'Author 2',
        latestAuthorColor: '#2',
        firstAt: 5,
        latestAt: 30,
      },
    ]);
  });

  it('skips an empty thread and flags a resolved one', () => {
    const { threads } = collabIndexRowsFromElements([
      shape('s1', 'a', { commentThread: { resolved: false, comments: [] } }),
      shape('s2', 'b', { commentThread: { resolved: true, comments: [comment('1', 1, 'u')] } }),
    ]);
    expect(threads.map((t) => [t.elementId, t.resolved])).toEqual([['s2', true]]);
  });

  it('ignores arrows even if a stray field is present', () => {
    const arrow = {
      id: 'ar',
      type: 'arrow',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
      action: action(),
    } as never;
    expect(collabIndexRowsFromElements([arrow]).actions).toEqual([]);
  });

  it('can carry both an action and a thread on one element', () => {
    const rows = collabIndexRowsFromElements([
      shape('s1', 'Both', {
        action: action(),
        commentThread: { resolved: false, comments: [comment('1', 1, 'u')] },
      }),
    ]);
    expect(rows.actions).toHaveLength(1);
    expect(rows.threads).toHaveLength(1);
  });
});
