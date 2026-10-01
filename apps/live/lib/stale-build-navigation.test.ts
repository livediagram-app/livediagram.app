// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  inAppDestination,
  installStaleBuildNavigation,
  navigateTo,
  navigationIntents,
  type NavigationDeps,
} from './stale-build-navigation';

// docs/specs/016-platform/stale-builds.md "Navigating while stale", "The safety net".

let cleanup: () => void = () => {};
afterEach(() => {
  cleanup();
  navigationIntents.clear();
  document.body.innerHTML = '';
  window.sessionStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

function setup(over: Partial<NavigationDeps> = {}) {
  const deps: NavigationDeps = {
    win: window,
    isStale: () => true,
    hasUnsavedChanges: () => false,
    load: vi.fn(),
    navigateClient: vi.fn(),
    now: () => Date.now(),
    storage: () => window.sessionStorage,
    track: vi.fn(),
    ...over,
  };
  cleanup = installStaleBuildNavigation(deps);
  return deps;
}

function link(href: string, attrs: Record<string, string> = {}) {
  const a = document.createElement('a');
  a.setAttribute('href', href);
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  a.textContent = 'go';
  document.body.append(a);
  return a;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('inAppDestination', () => {
  it('keeps path, query and hash on this origin, and nothing elsewhere', () => {
    expect(inAppDestination('/explorer/unsorted?x=1#a', window.location)).toBe(
      '/explorer/unsorted?x=1#a',
    );
    expect(inAppDestination('https://example.com/x', window.location)).toBeNull();
  });
});

describe('an in-app link while stale', () => {
  it('is a full page load, never reaching the app’s own handler', async () => {
    const deps = setup();
    const appHandler = vi.fn();
    const a = link('/explorer/unsorted');
    a.addEventListener('click', appHandler);
    a.click();
    await flush();
    expect(appHandler).not.toHaveBeenCalled();
    expect(deps.load).toHaveBeenCalledWith('/explorer/unsorted', false);
  });

  it('is left alone when fresh, modified, opening elsewhere, a download, or off-site', async () => {
    const deps = setup({ isStale: () => false });
    link('/explorer').click();
    cleanup();
    const stale = setup();
    for (const a of [
      link('/a', { target: '_blank' }),
      link('/b', { download: '' }),
      link('https://example.com/c'),
    ]) {
      a.click();
    }
    link('/d').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }),
    );
    await flush();
    expect(deps.load).not.toHaveBeenCalled();
    expect(stale.load).not.toHaveBeenCalled();
  });

  it('falls back to the client transition when unsaved work will not settle', async () => {
    vi.useFakeTimers();
    const deps = setup({ hasUnsavedChanges: () => true });
    link('/explorer/unsorted').click();
    await vi.advanceTimersByTimeAsync(11_000);
    expect(deps.load).not.toHaveBeenCalled();
    expect(deps.navigateClient).toHaveBeenCalledWith('/explorer/unsorted', false);
  });
});

describe('back and forward while stale', () => {
  it('loads the destination in full, before the client router hears it', async () => {
    const deps = setup();
    const router = vi.fn();
    window.addEventListener('popstate', router);
    window.history.pushState({}, '', '/explorer/unsorted');
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    await flush();
    window.removeEventListener('popstate', router);
    expect(router).not.toHaveBeenCalled();
    expect(deps.load).toHaveBeenCalledWith('/explorer/unsorted', true);
  });

  it('lets the client router have it when fresh', () => {
    const deps = setup({ isStale: () => false });
    const router = vi.fn();
    window.addEventListener('popstate', router);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    window.removeEventListener('popstate', router);
    expect(router).toHaveBeenCalledTimes(1);
    expect(deps.load).not.toHaveBeenCalled();
  });
});

describe('the app’s own navigations', () => {
  it('load in full while stale, and transition when fresh', async () => {
    const stale = setup();
    await navigateTo('/explorer/timeline', true, stale);
    expect(stale.load).toHaveBeenCalledWith('/explorer/timeline', true);
    expect(stale.navigateClient).not.toHaveBeenCalled();
    const fresh = { ...stale, isStale: () => false, load: vi.fn(), navigateClient: vi.fn() };
    await navigateTo('/explorer/timeline', false, fresh);
    expect(fresh.navigateClient).toHaveBeenCalledWith('/explorer/timeline', false);
    expect(fresh.load).not.toHaveBeenCalled();
  });
});

describe('a chunk that fails to load', () => {
  const chunkError = () =>
    Object.assign(new Error('Loading chunk 9 failed.'), { name: 'ChunkLoadError' });

  it('loads the page being navigated to in full, once, and counts it', async () => {
    window.history.replaceState({}, '', '/document/abc');
    const deps = setup({ isStale: () => false });
    link('/explorer/unsorted').click();
    window.dispatchEvent(new ErrorEvent('error', { error: chunkError() }));
    await flush();
    expect(deps.load).toHaveBeenCalledWith('/explorer/unsorted', false);
    expect(deps.track).toHaveBeenCalledWith('Error', 'Client', 'StaleChunkReload');
    window.dispatchEvent(new ErrorEvent('error', { error: chunkError() }));
    await flush();
    expect(deps.load).toHaveBeenCalledTimes(1);
  });

  it('recovers from an unhandled rejection the same way', async () => {
    window.history.replaceState({}, '', '/explorer/recent');
    const deps = setup({ isStale: () => false });
    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(event, 'reason', { value: chunkError() });
    window.dispatchEvent(event);
    await flush();
    expect(deps.load).toHaveBeenCalledWith('/explorer/recent', false);
  });
});
