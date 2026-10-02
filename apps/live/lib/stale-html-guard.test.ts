import { describe, expect, it, vi } from 'vitest';
import { STALE_HTML_GUARD_SCRIPT } from './stale-html-guard';
import {
  APP_RECOVERY_FLAG,
  RELOAD_GUARD_KEY,
  RELOAD_GUARD_WINDOW_MS,
  claimReload,
} from './reload-guard';

// docs/specs/016-platform/stale-builds.md "The pre-boot guard": the inline script, run against
// stub globals the way the browser would run it, first thing in the head.

type Listener = (event: Record<string, unknown>) => void;

function harness({
  now = 1_000,
  links = [] as { href: string; sheet: unknown }[],
  resources = [] as { name: string; responseStatus?: number }[],
  build = 'b1' as string | null,
  liveBuild = 'b1' as string | null,
  storage = new Map<string, string>(),
  storageThrows = false,
  appRecovery = false,
} = {}) {
  const listeners: Record<string, Listener[]> = {};
  const docListeners: Record<string, Listener[]> = {};
  const reload = vi.fn();
  const warn = vi.fn();
  const fetchSpy = vi.fn(() =>
    Promise.resolve({
      headers: { get: (h: string) => (h === 'X-Livediagram-Build' ? liveBuild : null) },
    }),
  );
  const win: Record<string, unknown> = {
    addEventListener: (type: string, fn: Listener) => (listeners[type] ??= []).push(fn),
  };
  if (appRecovery) win[APP_RECOVERY_FLAG] = true;
  const sessionStorage = {
    removeItem: (k: string) => storage.delete(k),
    getItem: (k: string) => {
      if (storageThrows) throw new Error('denied');
      return storage.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (storageThrows) throw new Error('denied');
      storage.set(k, v);
    },
  };
  const document = {
    addEventListener: (type: string, fn: Listener) => (docListeners[type] ??= []).push(fn),
    querySelector: (sel: string) =>
      sel === 'meta[name="livediagram-build"]' && build ? { content: build } : null,
    querySelectorAll: (sel: string) => (sel === 'link[rel="stylesheet"]' ? links : []),
  };
  const location = { pathname: '/explorer/unsorted', search: '?x=1', reload };
  const performance = { getEntriesByType: (t: string) => (t === 'resource' ? resources : []) };
  new Function(
    'window',
    'document',
    'location',
    'sessionStorage',
    'performance',
    'fetch',
    'Date',
    'console',
    STALE_HTML_GUARD_SCRIPT,
  )(win, document, location, sessionStorage, performance, fetchSpy, { now: () => now }, { warn });
  const fire = (type: string, event: Record<string, unknown>) =>
    (listeners[type] ?? []).forEach((fn) => fn(event));
  const fireDoc = (type: string) => (docListeners[type] ?? []).forEach((fn) => fn({}));
  return { fire, fireDoc, reload, fetchSpy, storage, warn };
}

const ALREADY = '[stale-html] already reloaded this page; leaving it';

const failed = (tagName: string, url: string) => ({
  target: tagName === 'SCRIPT' ? { tagName, src: url } : { tagName, href: url, rel: 'stylesheet' },
});

describe('the stale HTML guard', () => {
  it('reloads once when a build script or stylesheet fails to load', () => {
    const h = harness();
    h.fire('error', failed('SCRIPT', 'https://x/live/_next/static/chunks/old.js'));
    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(h.warn).toHaveBeenCalledWith(
      '[stale-html] a build asset failed to load; reloading',
      'https://x/live/_next/static/chunks/old.js',
    );
    const css = harness();
    css.fire('error', failed('LINK', 'https://x/live/_next/static/css/old.css'));
    expect(css.reload).toHaveBeenCalledTimes(1);
  });

  it('reloads once for a page whose assets fail together, warning once, not about the rest', () => {
    const h = harness();
    h.fire('error', failed('LINK', 'https://x/live/_next/static/css/old.css'));
    h.fire('error', failed('SCRIPT', 'https://x/live/_next/static/chunks/a.js'));
    h.fire('error', failed('SCRIPT', 'https://x/live/_next/static/chunks/b.js'));
    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(h.warn).toHaveBeenCalledTimes(1);
  });

  it('leaves other failures alone', () => {
    const h = harness();
    h.fire('error', failed('IMG', 'https://x/live/_next/static/media/a.png'));
    h.fire('error', failed('SCRIPT', 'https://x/other.js'));
    h.fire('error', { target: null });
    expect(h.reload).not.toHaveBeenCalled();
  });

  it('reloads at most once per URL within the window', () => {
    const storage = new Map<string, string>();
    const first = harness({ storage });
    first.fire('error', failed('SCRIPT', 'https://x/live/_next/static/chunks/old.js'));
    const second = harness({ storage, now: 1_000 + RELOAD_GUARD_WINDOW_MS - 1 });
    second.fire('error', failed('SCRIPT', 'https://x/live/_next/static/chunks/old.js'));
    expect(second.reload).not.toHaveBeenCalled();
    expect(second.warn).toHaveBeenCalledWith(ALREADY, expect.anything());
    const later = harness({ storage, now: 1_000 + RELOAD_GUARD_WINDOW_MS + 1 });
    later.fire('error', failed('SCRIPT', 'https://x/live/_next/static/chunks/old.js'));
    expect(later.reload).toHaveBeenCalledTimes(1);
  });

  it('shares one reload guard with the running app: a page it already reloaded stays', () => {
    // docs/specs/016-platform/stale-builds.md "One reload guard".
    const storage = new Map<string, string>();
    const asStorage = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
    } as unknown as Storage;
    expect(claimReload('/explorer/unsorted?x=1', asStorage, 1_000)).toBe(true);
    expect(storage.has(RELOAD_GUARD_KEY)).toBe(true);
    const h = harness({ storage, now: 2_000 });
    h.fire('error', failed('SCRIPT', 'https://x/live/_next/static/chunks/old.js'));
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.warn).toHaveBeenCalledWith(ALREADY, expect.anything());
  });

  it('stands down for failures once the running app recovers chunks itself', () => {
    const h = harness({ appRecovery: true });
    h.fire('error', failed('SCRIPT', 'https://x/live/_next/static/chunks/lazy.js'));
    expect(h.reload).not.toHaveBeenCalled();
  });

  it('never reloads when it cannot remember doing so', () => {
    const h = harness({ storageThrows: true });
    h.fire('error', failed('SCRIPT', 'https://x/live/_next/static/chunks/old.js'));
    expect(h.reload).not.toHaveBeenCalled();
  });

  it('catches, at DOMContentLoaded, a stylesheet or asset that failed before it ran', () => {
    const sheetless = harness({
      links: [{ href: 'https://x/live/_next/static/css/old.css', sheet: null }],
    });
    sheetless.fireDoc('DOMContentLoaded');
    expect(sheetless.reload).toHaveBeenCalledTimes(1);
    const timed = harness({
      resources: [{ name: 'https://x/live/_next/static/chunks/a.js', responseStatus: 404 }],
    });
    timed.fireDoc('DOMContentLoaded');
    expect(timed.reload).toHaveBeenCalledTimes(1);
    const healthy = harness({
      links: [{ href: 'https://x/live/_next/static/css/ok.css', sheet: {} }],
      resources: [{ name: 'https://x/live/_next/static/chunks/a.js', responseStatus: 200 }],
    });
    healthy.fireDoc('DOMContentLoaded');
    expect(healthy.reload).not.toHaveBeenCalled();
  });

  it('reloads a page restored from bfcache when a newer build is live', async () => {
    const h = harness({ build: 'b1', liveBuild: 'b2' });
    h.fire('pageshow', { persisted: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(h.fetchSpy).toHaveBeenCalledWith('/api/capabilities', { cache: 'no-store' });
    expect(h.reload).toHaveBeenCalledTimes(1);
  });

  it('keeps a restored page that is current, and asks nothing on a normal load', async () => {
    const same = harness({ build: 'b1', liveBuild: 'b1' });
    same.fire('pageshow', { persisted: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(same.reload).not.toHaveBeenCalled();
    const fresh = harness();
    fresh.fire('pageshow', { persisted: false });
    expect(fresh.fetchSpy).not.toHaveBeenCalled();
    const unbuilt = harness({ build: null });
    unbuilt.fire('pageshow', { persisted: true });
    expect(unbuilt.fetchSpy).not.toHaveBeenCalled();
  });
});
