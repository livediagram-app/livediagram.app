// History with Snapshots in it (owner, 2026-11-17; liveworkspace/docs/specs/014-snapshots/snapshots.md "In History"):
// another tool's entries laid on the rail by time among the item's own events, and a block over the timeline.
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createFakeIndex, makeEvent, makeItem } from '../test/fakeClient';
import { buildHistory, pinHistory } from './history';
import type { HistoryPin } from './HistoryDialog';
import { ItemHistoryDialog } from './ItemHistoryDialog';

const NOW = new Date(2026, 10, 17, 12).getTime();
const HOUR = 3_600_000;

const pin = (key: string, at: number): HistoryPin => ({
  key,
  at,
  render: (last) => (
    <li data-pin={key} data-last={last ? 'yes' : 'no'}>
      Pinned {key}
    </li>
  ),
});

describe('pinHistory', () => {
  it('lays pins among the runs by time, newest first, and makes a day for a pin alone', () => {
    const events = [
      makeEvent(1, { id: 'a', occurredAt: NOW - HOUR, actorId: 'u1' }),
      makeEvent(2, { id: 'b', occurredAt: NOW - 3 * HOUR, actorId: 'u2' }),
    ];
    const days = buildHistory(events, NOW);
    const out = pinHistory(
      days,
      [pin('mid', NOW - 2 * HOUR), pin('old', NOW - 5 * 24 * HOUR)],
      NOW,
    );
    expect(out.map((d) => [d.count, d.pinned])).toEqual([
      [2, 1],
      [0, 1],
    ]);
    expect(out[0]!.entries.map((e) => (e.pin ? e.pin.key : e.run!.key))).toEqual([
      days[0]!.runs[0]!.key,
      'mid',
      days[0]!.runs[1]!.key,
    ]);
    expect(out[1]!.label).toBeTruthy();
  });

  it('lays five pins on 10,000 loaded events well inside a frame budget', () => {
    const events = Array.from({ length: 10_000 }, (_, i) =>
      makeEvent(1, { id: `e${i}`, actorId: `u${i % 4}`, occurredAt: NOW - i * 600_000 }),
    );
    const days = buildHistory(events, NOW);
    const pins = [1, 2, 3, 4, 5].map((i) => pin(`s${i}`, NOW - i * 3 * 24 * HOUR));
    let out: ReturnType<typeof pinHistory> = [];
    const ms = cpuMsOf(() => {
      out = pinHistory(days, pins, NOW);
    });
    expect(out.reduce((n, d) => n + d.pinned, 0)).toBe(5);
    expect(ms).toBeLessThan(cpuBudgetMs(20));
  });

  it('leaves days without pins as they were', () => {
    const days = buildHistory([makeEvent(1, { occurredAt: NOW - HOUR })], NOW);
    const out = pinHistory(days, [], NOW);
    expect(out[0]!.entries.map((e) => e.run)).toEqual(days[0]!.runs);
    expect(out[0]!.pinned).toBe(0);
  });
});

describe('History with pins', () => {
  // Pinned at noon, so nothing a few minutes old falls on yesterday.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  function open(events: ReturnType<typeof makeEvent>[], pins: HistoryPin[]) {
    const index = createFakeIndex({ items: [makeItem(1)], events });
    render(
      <ItemHistoryDialog
        app="liveplanner"
        client={index.client}
        itemHref={(i) => `/p/${i.id}`}
        viewerId="user_me"
        item={makeItem(1)}
        onClose={vi.fn()}
        extras={{ top: <p>Take Snapshot here</p>, pins }}
      />,
    );
    return screen.findByRole('dialog', { name: 'History of Item 1' });
  }

  it('draws the block over the timeline and the pins on it, counting them on their day', async () => {
    const at = Date.now();
    const dialog = await open(
      [
        makeEvent(1, { id: 'e1', itemId: 'item-1', type: 'edited', occurredAt: at - 60_000 }),
        makeEvent(2, { id: 'e2', itemId: 'item-1', type: 'renamed', occurredAt: at - 180_000 }),
      ],
      [pin('s1', at - 120_000)],
    );
    expect(within(dialog).getByText('Take Snapshot here')).toBeTruthy();
    await waitFor(() => expect(dialog.querySelector('[data-pin="s1"]')).toBeTruthy());
    expect(dialog.querySelector('[data-pin="s1"]')!.getAttribute('data-last')).toBe('no');
    expect(within(dialog).getByText('2 events · 1 snapshot')).toBeTruthy();
  });

  it('shows pins where the item has no events yet, in place of the empty state', async () => {
    const at = Date.now();
    const dialog = await open([], [pin('s1', at - 1000), pin('s2', at - 2000)]);
    await waitFor(() => expect(dialog.querySelectorAll('[data-pin]')).toHaveLength(2));
    expect(within(dialog).getByText('2 snapshots')).toBeTruthy();
    expect(dialog.querySelector('[data-pin="s2"]')!.getAttribute('data-last')).toBe('yes');
  });
});
