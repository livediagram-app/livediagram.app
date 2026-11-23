// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The open knowledgebase's bound, fed where every page add reads it (docs/specs/030-knowledgebase/tiers.md "The
// editor asks first"): only once the owner's usage is known, so a pick never weighs pages against a guess.

const tier = vi.hoisted(() => ({
  info: null as null | {
    pagesMax: number;
    pagesLimit?: number;
    historyDays: number;
    owner?: string;
  },
  view: { settled: true, voice: { whose: 'yours' } } as {
    settled: boolean;
    voice: { whose: 'yours' | 'team' | 'owner' };
  },
  usage: null as null | { used: number; limit: number },
}));

vi.mock('./use-knowledge-tier', () => ({ useOpenKnowledgeTier: () => tier.info }));
vi.mock('@liveworkspace/subscription-ui/item-tier', () => ({
  useItemTier: () => tier.view,
  tierUsage: () => tier.usage,
}));

const { useFeedOpenPagesBound } = await import('./use-pages-bound');
const { forgetKnowledgeTiersForTests, openPagesBound, setKnowledgeTier } =
  await import('./knowledge-tier');

afterEach(() => {
  forgetKnowledgeTiersForTests();
  tier.info = null;
  tier.view = { settled: true, voice: { whose: 'yours' } };
  tier.usage = null;
});

const open = (info: NonNullable<typeof tier.info>) => {
  tier.info = info;
  setKnowledgeTier('kb', info);
};

describe('useFeedOpenPagesBound', () => {
  it('feeds the room the owner’s Knowledgebase Pages leave, once their usage has come', () => {
    open({ pagesMax: 500, pagesLimit: 500, historyDays: 30, owner: 'p:me' });
    const { rerender } = renderHook(({ n }) => useFeedOpenPagesBound(n), {
      initialProps: { n: 10 },
    });
    expect(openPagesBound()).toBeNull();
    tier.usage = { used: 498, limit: 500 };
    rerender({ n: 10 });
    expect(openPagesBound()).toEqual({ max: 12, account: { limit: 500, whose: 'yours' } });
  });

  it('waits while the owner view is still loading', () => {
    open({ pagesMax: 500, pagesLimit: 500, historyDays: 30, owner: 'p:me' });
    tier.view = { settled: false, voice: { whose: 'owner' } };
    renderHook(() => useFeedOpenPagesBound(1));
    expect(openPagesBound()).toBeNull();
  });

  it('feeds the fixed bound where the owner’s usage is not this person’s, and nothing with Pro off', () => {
    open({ pagesMax: 500, pagesLimit: 500, historyDays: 30, owner: 'p:them' });
    tier.view = { settled: true, voice: { whose: 'owner' } };
    renderHook(() => useFeedOpenPagesBound(4));
    expect(openPagesBound()).toEqual({ max: 500, account: null });

    forgetKnowledgeTiersForTests();
    tier.info = null;
    renderHook(() => useFeedOpenPagesBound(4));
    expect(openPagesBound()).toBeNull();
  });
});
