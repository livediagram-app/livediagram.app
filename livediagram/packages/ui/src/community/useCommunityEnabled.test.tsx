// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { ProductNavLinks } from '../ProductNav';
import { SiteFooter } from '../SiteFooter';
import { renderHook } from '@testing-library/react';
import {
  fetchCommunityEnabled,
  resetCommunityEnabledForTests,
  useCommunityEnabled,
} from './useCommunityEnabled';

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

// Renders the Explorer's footer links, and waits for the answer.
async function renderLinks(fetchMock: ReturnType<typeof stubCapabilities>) {
  render(<ProductNavLinks current="editor" />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('the Explorer footer links', () => {
  it('drop their Community link while it is switched off', async () => {
    await renderLinks(stubCapabilities(async () => Response.json({ communityEnabled: false })));
    expect(screen.getByRole('link', { name: /Explorer/ })).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryAllByRole('link', { name: /Community/ })).toHaveLength(0),
    );
  });

  it('keep it while it is on', async () => {
    await renderLinks(stubCapabilities(async () => Response.json({ communityEnabled: true })));
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Community/ })).toHaveLength(1));
  });
});

describe('asking only when it matters', () => {
  it('leaves the footer link unasked until the footer comes near', async () => {
    const observers: { callback: IntersectionObserverCallback }[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          observers.push({ callback });
        }
        observe() {}
        disconnect() {}
      },
    );
    const fetchMock = stubCapabilities(async () => Response.json({ communityEnabled: true }));
    render(<SiteFooter />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    act(() =>
      observers[0]!.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    vi.unstubAllGlobals();
  });
});

describe('useCommunityEnabled', () => {
  it('asks nothing, and answers on, while told not to ask', async () => {
    const fetchMock = stubCapabilities(async () => Response.json({ communityEnabled: false }));
    const { result, rerender } = renderHook(({ ask }) => useCommunityEnabled('/api', ask), {
      initialProps: { ask: false },
    });
    expect(result.current).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    rerender({ ask: true });
    await waitFor(() => expect(result.current).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
