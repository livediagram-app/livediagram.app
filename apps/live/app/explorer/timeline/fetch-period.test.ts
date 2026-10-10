import { describe, expect, it, vi } from 'vitest';
import type { TimelineEvent } from '@livediagram/ui';
import { TIMELINE_PERIOD_PAGES_MAX, fetchPeriod } from './fetch-period';

// The calendar's period fetch follows a busy month's cursor to its end
// (docs/specs/013-workspace/timeline.md §2.2), within a named bound.

const ev = (id: string) => ({ id, occurredAt: 1 }) as TimelineEvent;

describe('fetchPeriod', () => {
  it('follows the cursor through every page of the month', async () => {
    const pages = [
      { events: [ev('a')], nextCursor: 'c1' },
      { events: [ev('b')], nextCursor: 'c2' },
      { events: [ev('c')] },
    ];
    const fetchPage = vi.fn(async (_cursor: string | undefined) => pages.shift()!);
    const got: string[] = [];
    const outcome = await fetchPeriod(
      fetchPage,
      (events) => got.push(...events.map((e) => e.id)),
      () => false,
    );
    expect(outcome).toBe('complete');
    expect(got).toEqual(['a', 'b', 'c']);
    expect(fetchPage.mock.calls.map(([cursor]) => cursor)).toEqual([undefined, 'c1', 'c2']);
  });

  it('stops at the page bound for a cursor that never ends', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchPage = vi.fn(async () => ({ events: [ev('x')], nextCursor: 'again' }));
    expect(
      await fetchPeriod(
        fetchPage,
        () => {},
        () => false,
      ),
    ).toBe('capped');
    expect(fetchPage).toHaveBeenCalledTimes(TIMELINE_PERIOD_PAGES_MAX);
  });

  it('reports a failed page, keeping the pages before it', async () => {
    const pages = [{ events: [ev('a')], nextCursor: 'c1' }, null];
    const got: string[] = [];
    const outcome = await fetchPeriod(
      async () => pages.shift()!,
      (events) => got.push(...events.map((e) => e.id)),
      () => false,
    );
    expect(outcome).toBe('failed');
    expect(got).toEqual(['a']);
  });

  it('stops without merging once cancelled', async () => {
    const onPage = vi.fn();
    let cancelled = false;
    const outcome = await fetchPeriod(
      async () => {
        cancelled = true;
        return { events: [ev('a')], nextCursor: 'c1' };
      },
      onPage,
      () => cancelled,
    );
    expect(outcome).toBe('cancelled');
    expect(onPage).not.toHaveBeenCalled();
  });
});
