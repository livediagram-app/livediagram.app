// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SubscriptionProvider } from '@liveworkspace/subscription-ui';
import {
  ME,
  meResponse,
  ownerView,
  serviceFetch,
  setProForTests,
  summary,
  tokenOf,
} from '@liveworkspace/subscription-ui/testing';
import { forgetKnowledgeTiersForTests, setKnowledgeTier } from '@/lib/knowledge-tier';
import { PageTreeLimit } from './PageTreeLimit';

// Knowledgebase Pages at the tree's foot (docs/specs/030-knowledgebase/tiers.md): the owner's pages over every
// knowledgebase they own, to the owner, metered from 80% with the notice at the limit; the fixed bound of one
// knowledgebase to anyone; nothing with Pro off.

beforeEach(() => setProForTests(true));
afterEach(() => {
  cleanup();
  setProForTests(null);
  forgetKnowledgeTiersForTests();
});

const OTHER = 'p:user_bo';
const tabs = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));
// The tree of `n` pages, for the owner (who has used `used` pages over all their knowledgebases) or another person.
const shown = (n: number, used: number, owner = ME) => {
  const { fetcher } = serviceFetch({
    me: meResponse({ personal: summary(ME, 'free', { usage: { pages: { used } } }) }),
    owners: { [owner]: ownerView(owner, owner === ME ? 'upgrade' : 'none') },
  });
  return render(
    <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher}>
      <PageTreeLimit tabs={tabs(n)} />
    </SubscriptionProvider>,
  );
};
const open = (owner = ME) =>
  act(() => setKnowledgeTier('kb', { pagesMax: 500, pagesLimit: 500, historyDays: 30, owner }));

describe('PageTreeLimit', () => {
  it('draws nothing with Pro off, or under 80%', async () => {
    expect(shown(450, 450).container.innerHTML).toBe('');
    cleanup();
    open();
    shown(10, 300);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector('[data-page-tree-limit]')).toBeNull();
  });

  it('meters the owner’s pages over every knowledgebase from 80%, and says the limit at it', async () => {
    open();
    shown(10, 420);
    expect((await screen.findByText('420 of 500')).textContent).toBe('420 of 500');
    expect(screen.getByRole('meter', { name: 'Knowledgebase Pages' })).toBeTruthy();
    cleanup();
    shown(20, 500);
    expect(
      await screen.findByText(
        'You have 500 pages, the most Free holds across your Knowledgebases. Pro holds 10,000.',
        { exact: false },
      ),
    ).toBeTruthy();
  });

  it('shows anyone else this knowledgebase’s fixed bound alone, with no offer', async () => {
    open(OTHER);
    shown(399, 0, OTHER);
    expect(document.querySelector('[data-page-tree-limit]')).toBeNull();
    cleanup();
    shown(420, 0, OTHER);
    expect(screen.getByText('420 of 500')).toBeTruthy();
    cleanup();
    shown(500, 0, OTHER);
    await waitFor(() =>
      expect(
        screen.getByText('This Knowledgebase holds 500 pages, the most one can.'),
      ).toBeTruthy(),
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
