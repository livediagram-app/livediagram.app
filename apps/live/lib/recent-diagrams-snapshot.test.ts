// @vitest-environment jsdom

// The editor's half of the returning visitor (docs/specs/019-marketing/returning-visitor.md, "The
// recent-diagrams snapshot"): the note it leaves, the thumbnails it caches beside it, and forgetting
// both on sign-out.

import {
  RECENT_DIAGRAMS_KEY,
  RECENT_THUMBS_CACHE,
  parseRecentDiagrams,
  recentThumbPath,
  type DocumentSummary,
} from '@livediagram/api-schema';
import { USER_PREFERENCES_STORAGE_KEY } from '@livediagram/telemetry-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A Cache Storage stand-in: jsdom has none. One map of url → Response per named cache.
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      keys: async () => [...store.keys()].map((url) => new Request(url)),
      match: async (url: string) => store.get(url)?.clone(),
      put: async (url: string, res: Response) => void store.set(url, res),
      delete: async (req: Request | string) =>
        store.delete(typeof req === 'string' ? req : req.url),
    };
  };
  return {
    stores,
    api: { open, delete: async (name: string) => stores.delete(name) },
  };
}

const doc = (id: string, savedAt: number, extra: Partial<DocumentSummary> = {}): DocumentSummary =>
  ({
    id,
    name: `Doc ${id}`,
    savedAt,
    empty: false,
    opensIn: 'diagram',
    ...extra,
  }) as DocumentSummary;

const thumbUrl = (id: string, savedAt: number) =>
  new URL(recentThumbPath(id, savedAt), location.origin).href;

const note = () => parseRecentDiagrams(localStorage.getItem(RECENT_DIAGRAMS_KEY));

// Another tab's write, as the browser reports it: a `storage` event naming the key. Built as a plain
// event with `key` set, which is all the listener reads.
function storageEvent(key: string): Event {
  return Object.defineProperty(new Event('storage'), 'key', { value: key });
}

let caches: ReturnType<typeof fakeCaches>;

// The module keeps per-page state (forgotten, the latest list, its listeners), so each test loads a
// fresh copy.
async function load() {
  vi.resetModules();
  return import('./recent-diagrams-snapshot');
}

// The thumbnail sync runs on idle (a timer here): wait until the cache settles to what is expected.
async function settled(check: () => void) {
  await vi.waitFor(check, { timeout: 1000, interval: 5 });
}

beforeEach(() => {
  localStorage.clear();
  caches = fakeCaches();
  vi.stubGlobal('caches', caches.api);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('rememberRecentDiagrams', () => {
  it('notes the six newest saves, leaving out empty documents and those hidden from Recent', async () => {
    localStorage.setItem(
      USER_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ recentExcludedIds: ['d7'] }),
    );
    const { rememberRecentDiagrams } = await load();
    const docs = [
      ...Array.from({ length: 8 }, (_, i) => doc(`d${i}`, i)),
      doc('blank', 99, { empty: true }),
    ];

    rememberRecentDiagrams(docs, async () => '<svg/>');

    expect(note().map((d) => d.id)).toEqual(['d6', 'd5', 'd4', 'd3', 'd2', 'd1']);
  });

  it('removes the note when nothing is left to show', async () => {
    const { rememberRecentDiagrams } = await load();
    rememberRecentDiagrams([doc('a', 1)], async () => null);
    expect(note()).toHaveLength(1);

    rememberRecentDiagrams([doc('a', 1, { empty: true })], async () => null);

    expect(localStorage.getItem(RECENT_DIAGRAMS_KEY)).toBeNull();
  });

  it('reads a malformed preferences blob as nothing hidden', async () => {
    localStorage.setItem(USER_PREFERENCES_STORAGE_KEY, '{not json');
    const { rememberRecentDiagrams } = await load();

    rememberRecentDiagrams([doc('a', 1)], async () => null);

    expect(note().map((d) => d.id)).toEqual(['a']);
  });

  it('caches each snapshot, remembers one the server has none for, and prunes the rest', async () => {
    const { rememberRecentDiagrams } = await load();
    const fetchSvg = vi.fn(async (id: string) => (id === 'none' ? null : `<svg id="${id}"/>`));
    const thumbs = await caches.api.open(RECENT_THUMBS_CACHE);
    await thumbs.put(thumbUrl('gone', 1), new Response('<svg/>'));

    rememberRecentDiagrams([doc('a', 2), doc('none', 1)], fetchSvg);

    await settled(() => expect(caches.stores.get(RECENT_THUMBS_CACHE)?.size).toBe(2));
    expect(await (await thumbs.match(thumbUrl('a', 2)))?.text()).toBe('<svg id="a"/>');
    expect((await thumbs.match(thumbUrl('none', 1)))?.status).toBe(404);
    expect(await thumbs.match(thumbUrl('gone', 1))).toBeUndefined();
  });

  it('asks again next time for a snapshot whose request failed, and not for one already cached', async () => {
    const { rememberRecentDiagrams } = await load();
    let online = false;
    const fetchSvg = vi.fn(async () => {
      if (!online) throw new Error('offline');
      return '<svg/>';
    });

    rememberRecentDiagrams([doc('a', 1)], fetchSvg);
    await settled(() => expect(fetchSvg).toHaveBeenCalledTimes(1));
    expect(caches.stores.get(RECENT_THUMBS_CACHE)?.size ?? 0).toBe(0);

    online = true;
    rememberRecentDiagrams([doc('a', 1)], fetchSvg);
    await settled(() => expect(caches.stores.get(RECENT_THUMBS_CACHE)?.size).toBe(1));

    rememberRecentDiagrams([doc('a', 1)], fetchSvg);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchSvg).toHaveBeenCalledTimes(2);
  });

  it('runs one sync at a time, then one more pass for a list that landed meanwhile', async () => {
    const { rememberRecentDiagrams } = await load();
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const fetchSvg = vi.fn(async (id: string) => {
      if (id === 'a') await gate;
      return `<svg id="${id}"/>`;
    });

    rememberRecentDiagrams([doc('a', 1)], fetchSvg);
    await settled(() => expect(fetchSvg).toHaveBeenCalledWith('a', 1));
    rememberRecentDiagrams([doc('b', 2), doc('a', 1)], fetchSvg);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchSvg).not.toHaveBeenCalledWith('b', 2);

    release();

    await settled(() => expect(caches.stores.get(RECENT_THUMBS_CACHE)?.size).toBe(2));
    expect(fetchSvg).toHaveBeenCalledWith('b', 2);
  });

  it('writes only the note where the browser has no Cache Storage', async () => {
    vi.stubGlobal('caches', undefined);
    Reflect.deleteProperty(window, 'caches');
    const { rememberRecentDiagrams } = await load();
    const fetchSvg = vi.fn(async () => '<svg/>');

    rememberRecentDiagrams([doc('a', 1)], fetchSvg);
    await new Promise((r) => setTimeout(r, 20));

    expect(note()).toHaveLength(1);
    expect(fetchSvg).not.toHaveBeenCalled();
  });
});

describe('hiding from Recent', () => {
  it('takes a diagram off the note at once, in this tab or another', async () => {
    const { rememberRecentDiagrams } = await load();
    rememberRecentDiagrams([doc('a', 2), doc('b', 1)], async () => null);

    localStorage.setItem(
      USER_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ recentExcludedIds: ['a'] }),
    );
    window.dispatchEvent(new Event('livediagram:preferences-changed'));
    expect(note().map((d) => d.id)).toEqual(['b']);

    localStorage.setItem(
      USER_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ recentExcludedIds: ['b'] }),
    );
    window.dispatchEvent(storageEvent(USER_PREFERENCES_STORAGE_KEY));
    expect(note().map((d) => d.id)).toEqual(['a']);

    // Another key changing is not a preference change.
    localStorage.setItem(USER_PREFERENCES_STORAGE_KEY, '{}');
    window.dispatchEvent(storageEvent('something-else'));
    expect(note().map((d) => d.id)).toEqual(['a']);
  });
});

describe('forgetRecentDiagrams', () => {
  it('clears the note and the thumbnails, and nothing in flight writes them back', async () => {
    const { forgetRecentDiagrams, rememberRecentDiagrams } = await load();
    rememberRecentDiagrams([doc('a', 1)], async () => '<svg/>');
    await settled(() => expect(caches.stores.get(RECENT_THUMBS_CACHE)?.size).toBe(1));

    await forgetRecentDiagrams();
    rememberRecentDiagrams([doc('b', 2)], async () => '<svg/>');
    await new Promise((r) => setTimeout(r, 20));

    expect(localStorage.getItem(RECENT_DIAGRAMS_KEY)).toBeNull();
    expect(caches.stores.has(RECENT_THUMBS_CACHE)).toBe(false);
  });

  it('stops a sync that is under way', async () => {
    const { forgetRecentDiagrams, rememberRecentDiagrams } = await load();
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const fetchSvg = vi.fn(async () => {
      await gate;
      return '<svg/>';
    });
    rememberRecentDiagrams([doc('a', 1)], fetchSvg);
    await settled(() => expect(fetchSvg).toHaveBeenCalled());

    await forgetRecentDiagrams();
    release();
    await new Promise((r) => setTimeout(r, 20));

    expect(caches.stores.has(RECENT_THUMBS_CACHE)).toBe(false);
  });
});
