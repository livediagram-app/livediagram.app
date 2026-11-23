// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

// subscription.md "Price": development and staging take `?currency=`, so a page opened with it hands it on.

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
  window.history.replaceState(null, '', '/');
});

describe('looking at another currency while developing', () => {
  it('hands the page’s currency on with each request to the service, and nothing without one', async () => {
    const sent = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', sent);
    const { subscriptionFetch } = await import('./subscription');
    await subscriptionFetch!('/api/subscription/prices');
    expect(sent).toHaveBeenLastCalledWith('/api/subscription/prices', undefined);

    window.history.replaceState(null, '', '/pricing?currency=USD');
    await subscriptionFetch!('/api/subscription/me', { method: 'GET' });
    expect(sent).toHaveBeenLastCalledWith(
      `${window.location.origin}/api/subscription/me?currency=USD`,
      { method: 'GET' },
    );
    // A request that is not an address is left alone.
    const request = new Request(`${window.location.origin}/api/subscription/me`);
    await subscriptionFetch!(request);
    expect(sent).toHaveBeenLastCalledWith(request, undefined);
  });

  it('is not there in a production build, where the service ignores the word anyway', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { subscriptionFetch } = await import('./subscription');
    expect(subscriptionFetch).toBeUndefined();
  });
});
