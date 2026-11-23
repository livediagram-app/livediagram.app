// @vitest-environment jsdom
// What the person's own tier keeps, on the Library's pages with Pro on (liveworkspace/docs/specs/006-media/media.md
// "With Pro on", walkthroughs.md "The Explorer's Walkthroughs"): the meter, the line on each upload, the ProNote on
// Free alone, and nothing with Pro off or from a list with no limits.
import { render, screen, waitFor } from '@testing-library/react';
import { SubscriptionProvider } from '@liveworkspace/subscription-ui';
import {
  ME,
  ownerView,
  serviceFetch,
  setProForTests,
  tokenOf,
} from '@liveworkspace/subscription-ui/testing';
import type { Tier } from '@liveworkspace/subscription';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Explorer } from '../explorer/Explorer';
import { createFakeIndex } from '../test/fakeClient';
import { appLibraryHosts, walkthroughUsageOf } from './http';
import { minutesOf, usageWords } from './LibraryUsage';
import type { WalkthroughUsage, WalkthroughsHost } from './types';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const LIMITS = { maxMs: 300_000, stored: 3, storedLimit: 5, owner: ME, storedOwner: ME };
const FREE_USAGE: WalkthroughUsage = { stored: 3, storedLimit: 5, maxMs: 300_000, owner: ME };

beforeEach(() => setProForTests(true));
afterEach(() => {
  setProForTests(null);
  vi.unstubAllGlobals();
});

describe('walkthroughUsageOf', () => {
  it('reads the list’s limits, the stored owner first', () => {
    expect(walkthroughUsageOf(LIMITS)).toEqual(FREE_USAGE);
    expect(walkthroughUsageOf({ ...LIMITS, storedLimit: null, storedOwner: undefined })).toEqual({
      ...FREE_USAGE,
      storedLimit: null,
    });
  });

  it('answers null for none or anything malformed', () => {
    for (const bad of [
      undefined,
      null,
      'x',
      { ...LIMITS, stored: -1 },
      { ...LIMITS, maxMs: 'long' },
      { ...LIMITS, storedLimit: '5' },
    ])
      expect(walkthroughUsageOf(bad)).toBeNull();
    expect(
      walkthroughUsageOf({ ...LIMITS, owner: 'nobody', storedOwner: 'nobody' })?.owner,
    ).toBeNull();
  });
});

describe('the walkthroughs host', () => {
  it('keeps the usage the list answered, and none from a list without it', async () => {
    const answers = [json({ walkthroughs: [], limits: LIMITS }), json({ walkthroughs: [] })];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => answers.shift()!),
    );
    const walkthroughs = appLibraryHosts('livediagram', { token: async () => 'tok' }).walkthroughs!;
    expect(walkthroughs.usage!()).toBeNull();
    await walkthroughs.list();
    expect(walkthroughs.usage!()).toEqual(FREE_USAGE);
    await walkthroughs.list();
    expect(walkthroughs.usage!()).toBeNull();
  });
});

describe('the words', () => {
  it('says minutes', () => {
    expect(minutesOf(60_000)).toBe('1 minute');
    expect(minutesOf(1_800_000)).toBe('30 minutes');
    expect(minutesOf(0)).toBe('1 minute');
  });

  it('says what each tier keeps', () => {
    const base = { owner: ME, used: 0 } as const;
    expect(usageWords({ ...base, kind: 'images', limit: 500e6, maxImageBytes: 25e6 })).toEqual({
      each: 'Each image up to 25 MB. Your images in every app count here.',
      note: 'Free keeps 500 MB. Pro keeps 50 GB.',
    });
    expect(usageWords({ ...base, kind: 'walkthroughs', limit: 1, maxMs: 300_000 }).note).toBe(
      'Free keeps 1 walkthrough of up to 5 minutes. Pro keeps any number, up to 30 minutes.',
    );
    expect(
      usageWords({ ...base, kind: 'walkthroughs', limit: null, maxMs: 1_800_000 }).note,
    ).toContain('Free keeps any number of walkthroughs');
  });
});

const walkHost = (usage: WalkthroughUsage | null): WalkthroughsHost => ({
  list: async () => [],
  media: async () => new Blob(),
  remove: async () => {},
  usage: () => usage,
});

function page(walkthroughs: WalkthroughsHost, tier: Tier = 'free') {
  const { fetcher } = serviceFetch({ owners: { [ME]: ownerView(ME, 'upgrade', tier) } });
  return render(
    <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher}>
      <Explorer
        app="livediagram"
        client={createFakeIndex({}).client}
        view={{ kind: 'walkthroughs' }}
        onNavigate={vi.fn()}
        itemHref={(i) => `/d/${i.id}`}
        onCreate={vi.fn()}
        heroHidden
        walkthroughs={walkthroughs}
      />
    </SubscriptionProvider>,
  );
}

describe('the Walkthroughs page', () => {
  it('shows how many are kept, what each may be, and on Free what Pro keeps', async () => {
    page(walkHost(FREE_USAGE));
    const meter = await screen.findByRole('meter', { name: 'Stored' });
    expect(meter.getAttribute('aria-valuetext')).toBe('3 of 5');
    expect(screen.getByText(/Each up to 5 minutes\./)).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText(/Pro keeps any number, up to 30 minutes\./)).toBeTruthy(),
    );
    expect(screen.getByText('No walkthroughs yet')).toBeTruthy();
  });

  it('shows no ProNote on Pro', async () => {
    page(walkHost({ ...FREE_USAGE, storedLimit: null, maxMs: 1_800_000 }), 'pro');
    expect(await screen.findByText(/Each up to 30 minutes\./)).toBeTruthy();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/Pro keeps any number/)).toBeNull();
  });

  it('shows nothing with Pro off, or from a list with no limits', async () => {
    const { unmount } = page(walkHost(null));
    expect(await screen.findByText('No walkthroughs yet')).toBeTruthy();
    expect(document.querySelector('[data-library-usage]')).toBeNull();
    unmount();
    setProForTests(false);
    page(walkHost(FREE_USAGE));
    expect(await screen.findByText('No walkthroughs yet')).toBeTruthy();
    expect(document.querySelector('[data-library-usage]')).toBeNull();
  });
});
