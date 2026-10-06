// @vitest-environment jsdom

// The Activity page (docs/specs/013-workspace/activity-page.md §1): three sections of rows, Plan cards
// beside actions under Assigned to You (§2.4), each row a link into the editor; and the loading, failed
// and empty states kept apart.

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActivityAction, ActivityCard, ActivityThread } from '@livediagram/api-schema';
import type { ActivityFeed } from '@/app/explorer/useActivityFeed';

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

const card = (over: Partial<ActivityCard> = {}): ActivityCard => ({
  documentId: 'd2',
  documentName: 'Roadmap',
  teamId: null,
  via: 'own',
  shareCode: null,
  board: { tabId: 'tp', tabName: 'Plan', elementId: 'b1', title: 'Sprint 14' },
  id: 'it1',
  key: 12,
  type: 'task',
  title: 'Wire the form',
  status: 'todo',
  updatedAt: 3,
  ...over,
});

const thread = (over: Partial<ActivityThread> = {}): ActivityThread => ({
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
  it('lists a Plan card under Assigned to You, linking to it on its board', () => {
    render(
      <ActivityPane
        feed={feed({
          assignedToMe: [
            { kind: 'card', ...card() },
            { kind: 'action', ...action('a1', true) },
            {
              kind: 'card',
              ...card({ id: 'it2', key: 3, type: 'custom-x', title: 'Loose', board: null }),
            },
          ],
        })}
      />,
    );
    expect(screen.getByText('Assigned to You')).toBeTruthy();
    expect(linkTo('#12 Wire the form').getAttribute('href')).toBe(
      '/document/d2#t=tp&el=b1&item=it1',
    );
    expect(screen.getByText('Task')).toBeTruthy();
    expect(screen.getByText('Sprint 14 · Plan')).toBeTruthy();
    // A type the document added reads as a plain card, and a card no board shows says so.
    expect(screen.getByText('Card')).toBeTruthy();
    expect(screen.getByText('Not on a board')).toBeTruthy();
    expect(linkTo('#3 Loose').getAttribute('href')).toBe('/document/d2#item=it2');
    expect(linkTo('Action a1').getAttribute('href')).toBe('/document/d1#t=t1&el=e-a1&open=action');

    fireEvent.click(linkTo('#12 Wire the form'));
    expect(track).toHaveBeenCalledWith('Activity', 'Selected', 'Card');
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
