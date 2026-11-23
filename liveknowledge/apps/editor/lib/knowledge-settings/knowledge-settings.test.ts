import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/knowledge', () => ({
  apiSetReviewPeriod: vi.fn(),
  apiPreviewReviewPeriod: vi.fn(),
}));
vi.mock('@/lib/offline/offline-store', () => ({ offlineSaveDocumentMeta: vi.fn() }));

import type { ReviewEvery } from '@liveknowledge/knowledge';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { createSummaryCache } from '@/lib/knowledge-home/home-data';
import { createKnowledgeSettingsStore } from './knowledge-settings-store';
import {
  applyPeriod,
  countDuePages,
  previewPeriod,
  type PeriodTarget,
  type ReviewPeriodDoors,
} from './review-period-change';
import {
  REVIEW_PERIOD_OPTIONS,
  isShorterPeriod,
  pagesDueText,
  periodAppliedText,
  periodFailureText,
  reviewPeriodLabel,
} from './review-period-words';

// The knowledgebase's Review Period in the editor (docs/specs/030-knowledgebase/verification.md "The Review
// Period"): the store every state reads it from, its words, and the one optimistic change.
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20, 12);
const who = { ownerId: 'u1', shareCode: null };
const pages = [
  { knowledge: { verifiedAt: NOW - 100 * DAY } },
  { knowledge: { verifiedAt: NOW - 40 * DAY } },
  { knowledge: { verifiedAt: NOW - 5 * DAY } },
  { knowledge: { owner: 'u1' } },
  {},
];

function doorsOf(over: Partial<ReviewPeriodDoors> = {}): ReviewPeriodDoors {
  return {
    set: vi.fn(async (_who: unknown, _id: string, every: ReviewEvery) => every),
    preview: vi.fn(async (_who, _id, reviewEvery) => ({
      reviewEvery,
      reviewDue: 12,
      reviewDueNow: 3,
    })),
    saveOffline: vi.fn(async () => {}),
    store: createKnowledgeSettingsStore(),
    ...over,
  };
}
const target = (over: Partial<PeriodTarget> = {}): PeriodTarget => ({
  who,
  documentId: 'd1',
  offline: false,
  pages: () => pages,
  ...over,
});

describe('the settings store', () => {
  it('reads every 90 days until told, and takes what a read or the room says, forgivingly', () => {
    const store = createKnowledgeSettingsStore();
    const heard = vi.fn();
    store.subscribe(heard);
    expect(store.reviewEveryOf('d1')).toBe(90);
    expect(store.reviewEveryOf(null)).toBe(90);
    expect(store.take('d1', { reviewEvery: 30 })).toBe(true);
    expect(store.reviewEveryOf('d1')).toBe(30);
    expect(store.reviewEveryOf('d2')).toBe(90);
    // The same again changes nothing and tells nobody.
    expect(store.take('d1', { reviewEvery: 30 })).toBe(false);
    expect(heard).toHaveBeenCalledTimes(1);
    const version = store.version();
    // Nonsense reads as the default.
    expect(store.take('d1', { reviewEvery: 'weekly' })).toBe(true);
    expect(store.reviewEveryOf('d1')).toBe(90);
    expect(store.version()).toBe(version + 1);
    expect(store.take('d3', undefined)).toBe(false);
  });

  it("holds the knowledgebase's labels beside its period, one list until they change", () => {
    const store = createKnowledgeSettingsStore();
    const labels = [{ id: 'lbl_a', name: 'Alpha', colour: 'blue' }];
    expect(store.labelsOf('d1')).toEqual([]);
    expect(store.labelsOf(null)).toBe(store.labelsOf('d9'));
    expect(store.take('d1', { reviewEvery: 90, labels: [...labels, { id: 'bad id' }] })).toBe(true);
    const held = store.labelsOf('d1');
    expect(held).toEqual(labels);
    expect(store.take('d1', { reviewEvery: 90, labels })).toBe(false);
    expect(store.labelsOf('d1')).toBe(held);
    expect(store.setLabels('d1', [{ ...labels[0]!, name: 'Beta' }])).toBe(true);
    expect(store.take('d1', { reviewEvery: 30 })).toBe(true);
    expect([store.reviewEveryOf('d1'), store.labelsOf('d1')]).toEqual([30, []]);
  });

  it('stops telling a reader that left', () => {
    const store = createKnowledgeSettingsStore();
    const heard = vi.fn();
    store.subscribe(heard)();
    store.set('d1', 'never');
    expect(heard).not.toHaveBeenCalled();
  });
});

describe('the words', () => {
  it('names the five periods in Title Case, shortest first, Never last', () => {
    expect(REVIEW_PERIOD_OPTIONS.map((o) => o.label)).toEqual([
      'Every 30 Days',
      'Every 90 Days',
      'Every 180 Days',
      'Every Year',
      'Never',
    ]);
    expect(reviewPeriodLabel(365)).toBe('Every Year');
  });

  it('knows a shorter period: only one that brings reviews forward', () => {
    expect(isShorterPeriod(30, 90)).toBe(true);
    expect(isShorterPeriod(365, 'never')).toBe(true);
    expect(isShorterPeriod(180, 90)).toBe(false);
    expect(isShorterPeriod(90, 90)).toBe(false);
    expect(isShorterPeriod('never', 30)).toBe(false);
    expect(isShorterPeriod('never', 'never')).toBe(false);
  });

  it('says how many pages come due, what was applied, and a refusal, in words', () => {
    expect(pagesDueText(12)).toBe('12 pages will be due for review');
    expect(pagesDueText(1)).toBe('1 page will be due for review');
    expect(pagesDueText(1234)).toBe('1,234 pages will be due for review');
    expect(pagesDueText(0)).toBe('No page will be due for review.');
    expect(periodAppliedText(30)).toBe('Pages are now reviewed every 30 days.');
    expect(periodAppliedText(365)).toBe('Pages are now reviewed every year.');
    expect(periodAppliedText('never')).toBe(
      'Pages in this knowledgebase no longer come due for review.',
    );
    for (const status of [403, 404, 410, 500, null]) {
      const text = periodFailureText(status);
      expect(text).not.toMatch(/\d{3}|error|—/i);
      expect(text.length).toBeGreaterThan(20);
    }
    expect(periodFailureText(403)).toContain('Only an Editor');
    expect(periodFailureText(null)).toContain('back as it was');
  });
});

describe('counting the pages a period makes due', () => {
  it('counts verified pages past the period, from the fields alone', () => {
    expect(countDuePages(pages, 30, NOW)).toBe(2);
    expect(countDuePages(pages, 90, NOW)).toBe(1);
    expect(countDuePages(pages, 365, NOW)).toBe(0);
    expect(countDuePages(pages, 'never', NOW)).toBe(0);
    expect(countDuePages([], 30, NOW)).toBe(0);
  });

  it('asks the api, and counts for itself when the knowledgebase is Offline or the request fails', async () => {
    const doors = doorsOf();
    expect(await previewPeriod(target(), 30, NOW, doors)).toEqual({
      reviewDue: 12,
      reviewDueNow: 3,
    });
    expect(doors.preview).toHaveBeenCalledWith(who, 'd1', 30, undefined);
    const offline = doorsOf();
    expect(await previewPeriod(target({ offline: true }), 30, NOW, offline)).toEqual({
      reviewDue: 2,
      reviewDueNow: 1,
    });
    expect(offline.preview).not.toHaveBeenCalled();
    const down = doorsOf({ preview: vi.fn().mockRejectedValue(new Error('down')) });
    expect(await previewPeriod(target(), 30, NOW, down)).toEqual({ reviewDue: 2, reviewDueNow: 1 });
  });

  it('gives up, without a count, when the ask was ended', async () => {
    const control = new AbortController();
    const doors = doorsOf({
      preview: vi.fn(async () => {
        control.abort();
        throw new Error('aborted');
      }),
    });
    await expect(previewPeriod(target(), 30, NOW, doors, control.signal)).rejects.toThrow();
  });
});

describe('applying a period', () => {
  it('shows it at once, stores it, and answers what it replaced', async () => {
    let seenWhileSending: unknown;
    const doors = doorsOf();
    doors.set = vi.fn(async (_who: unknown, _id: string, every: ReviewEvery) => {
      seenWhileSending = doors.store.reviewEveryOf('d1');
      return every;
    });
    expect(await applyPeriod(target(), 30, NOW, doors)).toBe(90);
    expect(seenWhileSending).toBe(30);
    expect(doors.set).toHaveBeenCalledWith(who, 'd1', 30);
    expect(doors.store.reviewEveryOf('d1')).toBe(30);
    expect(doors.saveOffline).not.toHaveBeenCalled();
  });

  it('puts the period back when the server refuses, and throws the refusal', async () => {
    const refusal = new ApiError('set review period', 403, 'forbidden');
    const doors = doorsOf({ set: vi.fn().mockRejectedValue(refusal) });
    doors.store.set('d1', 180);
    await expect(applyPeriod(target(), 30, NOW, doors)).rejects.toBe(refusal);
    expect(doors.store.reviewEveryOf('d1')).toBe(180);
  });

  it('leaves a newer choice alone when an older write fails', async () => {
    const doors = doorsOf();
    let fail: (err: Error) => void = () => {};
    doors.set = vi.fn(() => new Promise<never>((_resolve, reject) => (fail = reject)));
    const first = applyPeriod(target(), 30, NOW, doors);
    doors.store.set('d1', 365);
    fail(new Error('down'));
    await expect(first).rejects.toThrow('down');
    expect(doors.store.reviewEveryOf('d1')).toBe(365);
  });

  it('writes a knowledgebase kept Offline to its record, and asks no server', async () => {
    const doors = doorsOf();
    await applyPeriod(target({ offline: true }), 'never', NOW, doors);
    expect(doors.saveOffline).toHaveBeenCalledWith(
      'd1',
      { knowledgeSettings: { reviewEvery: 'never' } },
      NOW,
    );
    expect(doors.set).not.toHaveBeenCalled();
    expect(doors.store.reviewEveryOf('d1')).toBe('never');
  });

  it('has Home read the knowledgebase again, past the summary it kept', async () => {
    const read = vi.fn(async () => ({}) as never);
    const cache = createSummaryCache(read, () => NOW);
    await cache.get('home-1');
    await cache.get('home-1');
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenLastCalledWith('home-1', false);
    await applyPeriod(target({ documentId: 'home-1' }), 30, NOW, doorsOf());
    await cache.get('home-1');
    expect(read).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenLastCalledWith('home-1', true);
    // Once: the fresh copy is kept as any other.
    await cache.get('home-1');
    expect(read).toHaveBeenCalledTimes(2);
  });
});
