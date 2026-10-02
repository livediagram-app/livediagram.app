import { describe, expect, it, vi } from 'vitest';
import { STALE_HTML_GUARD_SCRIPT, STALE_HTML_RELOAD_WINDOW_MS } from './stale-html-guard';

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
} = {}) {
  const listeners: Record<string, Listener[]> = {};
  const docListeners: Record<string, Listener[]> = {};
  const reload = vi.fn();
  const info = vi.fn();
  const warn = vi.fn();
  const fetchSpy = vi.fn(() =>
    Promise.resolve({
      headers: { get: (h: string) => (h === 'X-Livediagram-Build' ? liveBuild : null) },
    }),
  );
  const win = {
    addEventListener: (type: string, fn: Listener) => (listeners[type] ??= []).push(fn),
  };
  const sessionStorage = {
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
  )(
    win,
    document,
    location,
    sessionStorage,
    performance,
    fetchSpy,
    { now: () => now },
    { info, warn },
  );
  const fire = (type: string, event: Record<string, unknown>) =>
    (listeners[type] ?? []).forEach((fn) => fn(event));
  const fireDoc = (type: string) => (docListeners[type] ?? []).forEach((fn) => fn({}));
  return { fire, fireDoc, reload, fetchSpy, storage, info, warn };
}

const failed = (tagName: string, url: string) => ({
  target: tagName === 'SCRIPT' ? { tagName, src: url } : { tagName, href: url, rel: 'stylesheet' },
});

describe('the stale HTML guard', () => {
  it('reloads once when a build script or stylesheet fails to load', () => {
    const h = harness();
    h.fire('error', failed('SCRIPT', 'https://x/live/_next/static/chunks/old.js'));
    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(h.info).toHaveBeenCalledWith(
      '[stale-html] a build asset failed to load; reloading',
      'https://x/live/_next/static/chunks/old.js',
    );
    const css = harness();
    css.fire('error', failed('LINK', 'https://x/live/_next/static/css/old.css'));
    expect(css.reload).toHaveBeenCalledTimes(1);
  });

  it('reloads once for a page whose assets fail together, without warning about the rest', () => {
    const h = harness();
    h.fire('error', failed('LINK', 'https://x/live/_next/static/css/old.css'));
    h.fire('error', failed('SCRIPT', 'https://x/live/_next/static/chunks/a.js'));
    h.fire('error', failed('SCRIPT', 'https://x/live/_next/static/chunks/b.js'));
    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(h.warn).not.toHaveBeenCalled();
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
    const second = harness({ storage, now: 1_000 + STALE_HTML_RELOAD_WINDOW_MS - 1 });
    second.fire('error', failed('SCRIPT', 'https://x/live/_next/static/chunks/old.js'));
    expect(second.reload).not.toHaveBeenCalled();
    expect(second.warn).toHaveBeenCalled();
    const later = harness({ storage, now: 1_000 + STALE_HTML_RELOAD_WINDOW_MS + 1 });
    later.fire('error', failed('SCRIPT', 'https://x/live/_next/static/chunks/old.js'));
    expect(later.reload).toHaveBeenCalledTimes(1);
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
