// The My Work feed's events (docs/specs/026-plan/calendar-feed.md "The My Work feed"): the index's cards as all-day
// events, titled, placed and linked, one per card, capped nearest today.
import { DAY_MS } from '@liveplanner/items';
import type { CalendarCard, CollabCard } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { FEED_EVENTS_MAX } from './feed-span';
import { myWorkEventsOf } from './my-work-events';

const NOW = Date.UTC(2026, 10, 15, 12);
const TODAY = Math.floor(NOW / DAY_MS);
const iso = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

const row = (cardId: string, card: Partial<CollabCard>, itemId = 'P'): CalendarCard => ({
  itemId,
  itemTitle: 'Relaunch',
  cardId,
  card: { key: 1, type: 'task', typeLabel: 'Task', title: 'Card', board: null, ...card },
  updatedAt: 7,
});

describe('myWorkEventsOf', () => {
  it('makes one all-day event per dated card: Start to Due, Due alone, Start alone', () => {
    const read = myWorkEventsOf(
      [
        row('span', {
          key: 1,
          title: 'Build',
          start: iso(TODAY),
          due: iso(TODAY + 2),
          board: { tabId: 't', elementId: 'b', title: 'Kanban', tabName: 'Board' },
          column: { name: 'Doing', done: false },
        }),
        row('start', { key: 2, title: 'Kick off', start: iso(TODAY + 1) }),
        row('none', { key: 3, title: 'Undated' }),
        row('untitled', { key: null, title: '', due: iso(TODAY + 4) }),
        // Listed twice (two fields name the person): one event.
        row('span', { key: 1, title: 'Build', start: iso(TODAY), due: iso(TODAY + 2) }),
      ],
      'https://plan.test',
      NOW,
    );
    expect(read.name).toBe('My Work');
    expect(read.truncated).toBe(false);
    expect(read.events.map((e) => [e.summary, e.startDay - TODAY, e.endDay - TODAY])).toEqual([
      ['#1 Build', 0, 2],
      ['Starts: #2 Kick off', 1, 1],
      ['Untitled', 4, 4],
    ]);
    expect(read.events[0]).toEqual({
      uid: 'span.P.my-work@liveplanner.app',
      summary: '#1 Build',
      url: 'https://plan.test/project/P#item=span',
      description: 'Relaunch · Kanban · Doing\nhttps://plan.test/project/P#item=span',
      startDay: TODAY,
      endDay: TODAY + 2,
      stamp: 7,
      sequence: 0,
    });
  });

  // Card prefixes across plans (docs/specs/026-plan/item-types.md "Card number prefixes" "Across plans").
  it('titles a card by the prefixed ref its plan pushed, #N for one pushed before', () => {
    const read = myWorkEventsOf(
      [
        row('wi', { key: 100, ref: 'WI-100', title: 'Fix login', due: iso(TODAY) }),
        row('old', { key: 7, title: 'Old card', due: iso(TODAY + 1) }),
      ],
      'https://plan.test',
      NOW,
    );
    expect(read.events.map((e) => e.summary)).toEqual(['WI-100 Fix login', '#7 Old card']);
  });

  it('describes a card on a plan with no title by its link alone', () => {
    const read = myWorkEventsOf(
      [{ ...row('c', { due: iso(TODAY) }), itemTitle: '' }],
      'https://plan.test',
      NOW,
    );
    expect(read.events[0]!.description).toBe('https://plan.test/project/P#item=c');
  });

  it(`caps the feed at ${FEED_EVENTS_MAX}, keeping the nearest today`, () => {
    const rows: CalendarCard[] = [];
    for (let i = 0; i < 300; i++) rows.push(row(`far${i}`, { due: iso(TODAY + 1000 + i) }));
    for (let i = 0; i < 300; i++) rows.push(row(`near${i}`, { due: iso(TODAY + i - 150) }));
    const read = myWorkEventsOf(rows, 'https://plan.test', NOW);
    expect(read.truncated).toBe(true);
    expect(read.events).toHaveLength(FEED_EVENTS_MAX);
    expect(read.events.filter((e) => e.uid.startsWith('near'))).toHaveLength(300);
  });
});
