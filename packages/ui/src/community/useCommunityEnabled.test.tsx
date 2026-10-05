// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProductNav } from '../ProductNav';
import { SiteFooter } from '../SiteFooter';
import { fetchCommunityEnabled, resetCommunityEnabledForTests } from './useCommunityEnabled';

// docs/specs/025-community/community.md "Turning the Community off".

function stubCapabilities(answer: () => Promise<Response>) {
  const fetchMock = vi.fn(answer);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  resetCommunityEnabledForTests();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchCommunityEnabled', () => {
  it('is off only on an explicit false, and asks once per api base', async () => {
    const fetchMock = stubCapabilities(async () => Response.json({ communityEnabled: false }));
    expect(await fetchCommunityEnabled()).toBe(false);
    expect(await fetchCommunityEnabled()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/capabilities');
  });

  it('assumes on when the answer omits it, fails, or cannot be fetched', async () => {
    stubCapabilities(async () => Response.json({ aiEnabled: false }));
    expect(await fetchCommunityEnabled('/a')).toBe(true);
    stubCapabilities(async () => new Response(null, { status: 500 }));
    expect(await fetchCommunityEnabled('/b')).toBe(true);
    stubCapabilities(async () => {
      throw new TypeError('offline');
    });
    expect(await fetchCommunityEnabled('/c')).toBe(true);
  });
});

// Renders the menu and footer, waits for the answer, and opens the menu so its links are there to count.
async function renderOpened(fetchMock: ReturnType<typeof stubCapabilities>) {
  render(
    <>
      <ProductNav current="home" />
      <SiteFooter />
    </>,
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 0));
  fireEvent.click(screen.getByRole('button', { name: /Welcome/ }));
}

describe('the apps menu and footer', () => {
  it('drop their Community links while it is switched off', async () => {
    await renderOpened(stubCapabilities(async () => Response.json({ communityEnabled: false })));
    expect(screen.getByRole('menuitem', { name: /Explorer/ })).toBeTruthy();
    expect(screen.queryAllByRole('menuitem', { name: /Community/ })).toHaveLength(0);
    expect(screen.queryAllByRole('link', { name: 'Community' })).toHaveLength(0);
  });

  it('keep them while it is on', async () => {
    await renderOpened(stubCapabilities(async () => Response.json({ communityEnabled: true })));
    expect(screen.getAllByRole('menuitem', { name: /Community/ })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Community' })).toHaveLength(1);
  });
});
