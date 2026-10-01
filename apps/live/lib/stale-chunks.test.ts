import { describe, expect, it, vi } from 'vitest';
import {
  NAVIGATION_INTENT_MS,
  STALE_CHUNK_RELOAD_WINDOW_MS,
  claimChunkReload,
  createNavigationIntents,
  isChunkLoadError,
  recoverFromChunkError,
} from './stale-chunks';

// docs/specs/016-platform/stale-builds.md "The safety net".

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

const named = (name: string, message = 'x') => Object.assign(new Error(message), { name });

describe('isChunkLoadError', () => {
  it.each([
    [named('ChunkLoadError', 'Loading chunk 123 failed.'), true],
    [new Error('Loading chunk 7 failed.\n(error: https://x/_next/static/chunks/7.js)'), true],
    [new Error('Loading CSS chunk app failed'), true],
    [new Error('Failed to load chunk /_next/static/chunks/abc.js from module 1'), true],
    [new TypeError('Failed to fetch dynamically imported module: https://x/a.js'), true],
    [new TypeError('Importing a module script failed.'), true],
    [new TypeError('error loading dynamically imported module: https://x/a.js'), true],
    [new TypeError('x is undefined'), false],
    [new Error('Failed to fetch'), false],
    ['ChunkLoadError', false],
    [null, false],
  ])('reads %s as %s', (error, expected) => {
    expect(isChunkLoadError(error)).toBe(expected);
  });
});

describe('claimChunkReload', () => {
  it('allows one reload per destination within the window', () => {
    const storage = memoryStorage();
    expect(claimChunkReload('/explorer/unsorted', storage, 1_000)).toBe(true);
    expect(claimChunkReload('/explorer/unsorted', storage, 2_000)).toBe(false);
    expect(claimChunkReload('/explorer/recent', storage, 2_000)).toBe(true);
    expect(
      claimChunkReload('/explorer/unsorted', storage, 1_000 + STALE_CHUNK_RELOAD_WINDOW_MS + 1),
    ).toBe(true);
  });

  it('survives unreadable storage by refusing, never looping', () => {
    const broken = memoryStorage();
    broken.setItem('livediagram:stale-chunk-reloads', '{not json');
    expect(claimChunkReload('/a', broken, 1)).toBe(true);
    const throwing = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error('denied');
      },
    } as Storage;
    expect(claimChunkReload('/a', throwing, 1)).toBe(false);
  });

  it('is short: one minute', () => {
    expect(STALE_CHUNK_RELOAD_WINDOW_MS).toBe(60_000);
  });
});

describe('navigation intents', () => {
  it('names the destination being navigated to while it is fresh, else the current page', () => {
    const intents = createNavigationIntents();
    expect(intents.destination(0, '/document/a')).toBe('/document/a');
    intents.note('/explorer/unsorted', 1_000);
    expect(intents.destination(1_500, '/document/a')).toBe('/explorer/unsorted');
    expect(intents.destination(1_000 + NAVIGATION_INTENT_MS + 1, '/document/a')).toBe(
      '/document/a',
    );
  });
});

describe('recoverFromChunkError', () => {
  const deps = (over: Partial<Parameters<typeof recoverFromChunkError>[1]> = {}) => ({
    storage: memoryStorage(),
    now: () => 5_000,
    destination: () => '/explorer/unsorted',
    hasUnsavedChanges: () => false,
    load: vi.fn(),
    track: vi.fn(),
    ...over,
  });

  it('loads the destination in full, and counts the recovery', async () => {
    const d = deps();
    await expect(recoverFromChunkError(named('ChunkLoadError'), d)).resolves.toBe('reloading');
    expect(d.load).toHaveBeenCalledWith('/explorer/unsorted');
    expect(d.track).toHaveBeenCalledWith('Error', 'Client', 'StaleChunkReload');
  });

  it('leaves any other error alone', async () => {
    const d = deps();
    await expect(recoverFromChunkError(new TypeError('x'), d)).resolves.toBe('not-a-chunk-error');
    expect(d.load).not.toHaveBeenCalled();
  });

  it('gives up on a second failure in the window, so the normal error shows', async () => {
    const load = vi.fn();
    const d = deps({ load });
    await recoverFromChunkError(named('ChunkLoadError'), d);
    load.mockClear();
    await expect(recoverFromChunkError(named('ChunkLoadError'), d)).resolves.toBe('gave-up');
    expect(load).not.toHaveBeenCalled();
  });

  it('waits for unsaved changes, and never loads over them', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const d = deps({ hasUnsavedChanges: () => true });
    const outcome = recoverFromChunkError(named('ChunkLoadError'), d);
    await vi.advanceTimersByTimeAsync(11_000);
    await expect(outcome).resolves.toBe('unsaved');
    expect(d.load).not.toHaveBeenCalled();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('recovers once per error, however many places report it', async () => {
    const d = deps();
    const error = named('ChunkLoadError');
    const [a, b] = await Promise.all([
      recoverFromChunkError(error, d),
      recoverFromChunkError(error, d),
    ]);
    expect([a, b].sort()).toEqual(['already-recovering', 'reloading']);
    expect(d.load).toHaveBeenCalledTimes(1);
  });
});
