// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionProvider } from '@liveworkspace/subscription-ui';
import {
  ME,
  ownerView,
  serviceFetch,
  setProForTests,
  tokenOf,
} from '@liveworkspace/subscription-ui/testing';
import { forgetAiCreditsForTests, noteAiCredits, noteAiCreditsUsed } from '@/lib/knowledge-credits';
import { forgetKnowledgeTiersForTests, setKnowledgeTier } from '@/lib/knowledge-tier';
import { AiCreditsNotice, useAiCreditsLine, useAiCreditsUsedUp } from './AiCreditsNotice';

// Built-in AI on AI credits (docs/specs/030-knowledgebase/tiers.md): the line, and the notice once the month is used.

beforeEach(() => setProForTests(true));
afterEach(() => {
  cleanup();
  setProForTests(null);
  forgetKnowledgeTiersForTests();
  forgetAiCreditsForTests();
});

function Line() {
  const usedUp = useAiCreditsUsedUp('kb');
  return (
    <p data-testid="line" data-used-up={usedUp}>
      {useAiCreditsLine('kb') ?? 'none'}
    </p>
  );
}

function shown(action: 'upgrade' | 'none', onAddKey?: () => void) {
  const { fetcher } = serviceFetch({ owners: { [ME]: ownerView(ME, action) } });
  render(
    <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher}>
      <Line />
      <AiCreditsNotice documentId="kb" doing="ask" onAddKey={onAddKey} />
    </SubscriptionProvider>,
  );
}

describe('AiCreditsNotice', () => {
  it('says nothing with Pro off', () => {
    noteAiCreditsUsed('kb', 50, 50);
    shown('upgrade');
    expect(screen.getByTestId('line').textContent).toBe('none');
    expect(screen.getByTestId('line').dataset.usedUp).toBe('false');
    expect(document.querySelector('[data-ai-credits-used]')).toBeNull();
  });

  it('says the line, then the notice with its ways on when the month is used', async () => {
    setKnowledgeTier('kb', { pagesMax: 100, historyDays: 30, owner: ME });
    const addKey = vi.fn();
    shown('upgrade', addKey);
    expect(screen.getByTestId('line').textContent).toBe('Uses 1 AI credit');
    act(() => noteAiCredits('kb', { used: 47, limit: 50 }));
    expect(screen.getByTestId('line').textContent).toBe('Uses 1 AI credit · 3 left this month');
    act(() => noteAiCreditsUsed('kb', 50, 50));
    expect(await screen.findByText(/This month's AI credits are used/)).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy();
    // Add a Key sits in the notice, after the sentence; the line under the box goes.
    const notice = document.querySelector('[data-ai-credits-used]')!;
    expect(notice.querySelector('button')?.textContent).toBe('Add a Key');
    expect(screen.getByTestId('line').dataset.usedUp).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Add a Key' }));
    expect(addKey).toHaveBeenCalled();
  });

  it('makes Add a Key the notice’s button when there is no upgrade to offer', async () => {
    setKnowledgeTier('kb', { pagesMax: 100, historyDays: 30, owner: ME });
    noteAiCreditsUsed('kb', 50, 50);
    const addKey = vi.fn();
    shown('none', addKey);
    fireEvent.click(await screen.findByRole('button', { name: 'Add a Key' }));
    expect(addKey).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Upgrade to Pro' })).toBeNull();
  });

  it('tells someone who cannot act the plain fact', async () => {
    setKnowledgeTier('kb', { pagesMax: 100, historyDays: 30, owner: ME });
    noteAiCreditsUsed('kb', 50, 50);
    shown('none');
    expect(await screen.findByText("The owner's AI credits for this month are used.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a Key' })).toBeNull();
  });
});
