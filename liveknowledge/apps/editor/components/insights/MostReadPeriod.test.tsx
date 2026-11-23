// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionProvider } from '@liveworkspace/subscription-ui';
import {
  ME,
  ownerView,
  serviceFetch,
  setProForTests,
  tokenOf,
} from '@liveworkspace/subscription-ui/testing';
import { MostReadPeriod, historySentence, periodWords } from './MostReadPeriod';

// Most Read's period with Pro on (docs/specs/030-knowledgebase/tiers.md "AI Knowledge History").

beforeEach(() => setProForTests(true));
afterEach(() => {
  cleanup();
  setProForTests(null);
});

function shown(keptDays: number, action: 'upgrade' | 'none' = 'upgrade') {
  const onPeriod = vi.fn();
  const { fetcher } = serviceFetch({ owners: { [ME]: ownerView(ME, action) } });
  render(
    <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher}>
      <MostReadPeriod history={{ keptDays, days: 30, owner: ME }} onPeriod={onPeriod} />
    </SubscriptionProvider>,
  );
  return onPeriod;
}

const period = (days: number) =>
  document.querySelector(`[data-period="${days}"]`) as HTMLButtonElement;

describe('MostReadPeriod', () => {
  it('changes to a kept period, and marks the rest Pro', async () => {
    const onPeriod = shown(365);
    fireEvent.click(period(90));
    expect(onPeriod).toHaveBeenCalledWith(90);
    fireEvent.click(period(30));
    expect(onPeriod).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(historySentence(365))).toBeNull();
  });

  it('keeps a period past the tier for the offer, and closes it to someone who cannot act', async () => {
    const onPeriod = shown(30, 'none');
    expect(period(90).disabled).toBe(true);
    fireEvent.click(period(90));
    expect(onPeriod).not.toHaveBeenCalled();
    // The note under the track, and the closed period's hover card, both say it.
    expect(
      (await screen.findAllByText('History here is kept for 30 days.')).length,
    ).toBeGreaterThan(0);
  });

  it('words its periods', () => {
    expect(periodWords(30)).toBe('30 days');
    expect(periodWords(365)).toBe('year');
    expect(historySentence(30)).toBe(
      'Free keeps 30 days of what agents read and asked. Pro keeps a year.',
    );
  });
});
