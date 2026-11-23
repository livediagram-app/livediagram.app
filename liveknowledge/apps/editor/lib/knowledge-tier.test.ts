import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  forgetKnowledgeTiersForTests,
  openPagesBound,
  openPagesMax,
  setKnowledgeTier,
  setOpenPagesBound,
  whenOpenPagesBound,
} from './knowledge-tier';

// The open knowledgebase's page bound (docs/specs/030-knowledgebase/tiers.md "Knowledgebase Pages", "The editor asks
// first"): the fixed bound, or less where the owner's limit over all their knowledgebases leaves less room.

afterEach(() => {
  forgetKnowledgeTiersForTests();
  vi.useRealTimers();
});

const ACCOUNT = { max: 12, account: { limit: 500, whose: 'yours' as const } };

describe('the open knowledgebase’s bound', () => {
  it('is the fixed bound until the owner’s usage is fed, then the room it leaves', () => {
    setKnowledgeTier('kb', { pagesMax: 500, pagesLimit: 500, historyDays: 30 });
    expect(openPagesMax()).toBe(500);
    expect(openPagesBound()).toBeNull();
    setOpenPagesBound('kb', ACCOUNT);
    expect(openPagesBound()).toEqual(ACCOUNT);
    expect(openPagesMax()).toBe(12);
  });

  it('never reads another knowledgebase’s bound, and forgets one fed as null', () => {
    setKnowledgeTier('kb', { pagesMax: 500, historyDays: 30 });
    setOpenPagesBound('other', ACCOUNT);
    expect(openPagesMax()).toBe(500);
    setOpenPagesBound('kb', ACCOUNT);
    setOpenPagesBound('kb', null);
    expect(openPagesBound()).toBeNull();
    setOpenPagesBound(null, ACCOUNT);
    expect(openPagesBound()).toBeNull();
  });

  it('a page add waits for the bound, or for a moment when it does not come', async () => {
    setKnowledgeTier('kb', { pagesMax: 500, historyDays: 30 });
    let landed = false;
    const waiting = whenOpenPagesBound(4000).then(() => (landed = true));
    await Promise.resolve();
    expect(landed).toBe(false);
    setOpenPagesBound('kb', ACCOUNT);
    await waiting;
    expect(landed).toBe(true);
    // Known already: at once.
    await whenOpenPagesBound(4000);

    forgetKnowledgeTiersForTests();
    vi.useFakeTimers();
    setKnowledgeTier('kb', { pagesMax: 500, historyDays: 30 });
    let timedOut = false;
    const late = whenOpenPagesBound(4000).then(() => (timedOut = true));
    await vi.advanceTimersByTimeAsync(4000);
    await late;
    expect(timedOut).toBe(true);
  });
});
