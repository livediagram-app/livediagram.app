// @vitest-environment jsdom

// The Inbox (docs/specs/013-workspace/inbox.md §1): three sections of rows, each row a link into the editor; and
// the loading, failed and empty states kept apart.

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActivityAction, ActivityThread } from '@livepages/api-schema';
import type { ThreadRow, ActivityFeed } from '@/app/explorer/useActivityFeed';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/app/explorer/views', () => ({ SkeletonRows: () => <div>loading rows</div> }));

import { ActivityPane } from './ActivityPane';

const place = {
  documentId: 'd1',
  documentName: 'Payments',
  teamId: 'tm',
  via: 'team' as const,
  shareCode: null,
  tabId: 't1',
  tabName: 'Flow',
  elementLabel: 'Checkout',
};

const action = (id: string, mine: boolean): ActivityAction => ({
  ...place,
  elementId: `e-${id}`,
  id,
  name: `Action ${id}`,
  description: mine ? 'Do it' : '',
  assignee: { userId: mine ? 'me' : 'u2', name: mine ? 'Me' : 'Priya' },
  assigner: { id: 'u9', name: null },
  createdAt: 1,
  updatedAt: 2,
  assignedToMe: mine,
  createdByMe: !mine,
});

const thread = (over: Partial<ActivityThread> = {}): ThreadRow => ({
  kind: 'thread',
  ...place,
  elementId: 'e9',
  commentCount: 2,
  latest: { text: 'Any news?', authorName: 'Priya', authorColor: '#336699', at: 4 },
  firstAt: 1,
  youCommented: false,
  onYourDocument: true,
  mentionsYou: false,
  ...over,
});

const feed = (over: Partial<ActivityFeed> = {}): ActivityFeed => ({
  assignedToMe: [],
  youAssigned: [],
  threads: [],
  loading: false,
  error: false,
  retry: vi.fn(),
  ...over,
});

const linkTo = (text: string) => screen.getByText(text).closest('a')!;

describe('ActivityPane', () => {
  it('lists an action under Assigned to You, linking to it on its element', () => {
    render(
      <ActivityPane feed={feed({ assignedToMe: [{ kind: 'action', ...action('a1', true) }] })} />,
    );
    expect(screen.getByText('Assigned to You')).toBeTruthy();
    expect(linkTo('Action a1').getAttribute('href')).toBe('/document/d1#t=t1&el=e-a1&open=action');
    fireEvent.click(linkTo('Action a1'));
    expect(track).toHaveBeenCalledWith('Activity', 'Selected', 'Action');
  });

  it('lists actions you assigned and the threads you are in, with their hints', () => {
    render(
      <ActivityPane
        feed={feed({
          youAssigned: [action('a2', false)],
          threads: [thread(), thread({ elementId: 'e8', mentionsYou: true, elementLabel: 'Pay' })],
        })}
      />,
    );
    expect(screen.getByText('You Assigned')).toBeTruthy();
    expect(screen.getByText('Open Comment Threads')).toBeTruthy();
    expect(screen.getByText('Your document')).toBeTruthy();
    expect(screen.getByText('Mentioned You')).toBeTruthy();
    fireEvent.click(linkTo('Pay'));
    expect(track).toHaveBeenCalledWith('Activity', 'Selected', 'Thread');
  });

  // docs/specs/013-workspace/inbox.md §1, §2.6: a row from a document saved only in this browser says so, as a
  // label inside the row's link; a cloud row carries no pill.
  it('marks a row in This Browser with the This Browser pill, and no other row', () => {
    render(
      <ActivityPane
        feed={feed({
          assignedToMe: [
            { kind: 'action', ...action('local', true), documentName: 'Retro', local: true },
            { kind: 'action', ...action('cloud', true) },
          ],
        })}
      />,
    );
    const local = linkTo('Action local');
    expect(local.textContent).toContain('This Browser');
    expect(local.querySelector('a')).toBeNull();
    expect(local.getAttribute('href')).toBe('/document/d1#t=t1&el=e-local&open=action');
    expect(linkTo('Action cloud').textContent).not.toContain('This Browser');
    expect(screen.getAllByText('This Browser')).toHaveLength(1);
  });

  it('keeps loading, failed and empty apart', () => {
    const retry = vi.fn();
    const { rerender } = render(<ActivityPane feed={feed({ loading: true })} />);
    expect(screen.getByText('loading rows')).toBeTruthy();
    rerender(<ActivityPane feed={feed({ error: true, retry })} />);
    fireEvent.click(screen.getByText('Try again'));
    expect(retry).toHaveBeenCalled();
    rerender(<ActivityPane feed={feed()} />);
    expect(screen.getByText('Nothing waiting on you')).toBeTruthy();
  });
});
