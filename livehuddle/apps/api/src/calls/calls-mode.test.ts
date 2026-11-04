import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CALLS_MODE_CACHE_MS,
  CALLS_MODE_KEY,
  callsMode,
  callsModeAllows,
  parseCallsMode,
  resetCallsModeCache,
  stricterCallsMode,
  writeCallsMode,
} from './calls-mode';
import { fakeKv } from './fake-kv';

beforeEach(() => resetCallsModeCache());
afterEach(() => vi.restoreAllMocks());

describe('parseCallsMode', () => {
  it('reads no key, or an empty one, as on', () => {
    expect(parseCallsMode(null)).toBe('on');
    expect(parseCallsMode(undefined)).toBe('on');
    expect(parseCallsMode('  ')).toBe('on');
    expect(parseCallsMode(' ON ')).toBe('on');
  });

  it('accepts the spellings of audio only', () => {
    for (const raw of ['audio-only', 'audio_only', 'Audio', ' AUDIO-ONLY\n']) {
      expect(parseCallsMode(raw)).toBe('audio-only');
    }
  });

  it('reads off as off, and anything it does not know as off', () => {
    expect(parseCallsMode('off')).toBe('off');
    expect(parseCallsMode('of')).toBe('off');
    expect(parseCallsMode('true')).toBe('off');
  });
});

describe('stricterCallsMode', () => {
  it('picks whichever allows less', () => {
    expect(stricterCallsMode('on', 'audio-only')).toBe('audio-only');
    expect(stricterCallsMode('audio-only', 'on')).toBe('audio-only');
    expect(stricterCallsMode('off', 'audio-only')).toBe('off');
    expect(stricterCallsMode('audio-only', 'off')).toBe('off');
    expect(stricterCallsMode('on', 'on')).toBe('on');
  });
});

describe('callsModeAllows', () => {
  it('lets everything through when on', () => {
    for (const kind of ['session', 'audio', 'video', 'screen'] as const) {
      expect(callsModeAllows('on', kind)).toBe(true);
    }
  });

  it('lets only sessions and audio through when audio only', () => {
    expect(callsModeAllows('audio-only', 'session')).toBe(true);
    expect(callsModeAllows('audio-only', 'audio')).toBe(true);
    expect(callsModeAllows('audio-only', 'video')).toBe(false);
    expect(callsModeAllows('audio-only', 'screen')).toBe(false);
  });

  it('lets nothing through when off', () => {
    for (const kind of ['session', 'audio', 'video', 'screen'] as const) {
      expect(callsModeAllows('off', kind)).toBe(false);
    }
  });
});

describe('callsMode', () => {
  it('is on with no binding (a fork, local dev)', async () => {
    expect(await callsMode({})).toBe('on');
  });

  it('reads the key, then serves the cache for CALLS_MODE_CACHE_MS', async () => {
    const kv = fakeKv({ [CALLS_MODE_KEY]: 'audio-only' });
    expect(await callsMode({ CALLS_SWITCH: kv }, 1_000)).toBe('audio-only');
    kv.store.set(CALLS_MODE_KEY, 'off');
    expect(await callsMode({ CALLS_SWITCH: kv }, 1_000 + CALLS_MODE_CACHE_MS - 1)).toBe(
      'audio-only',
    );
    expect(kv.gets).toBe(1);
    expect(await callsMode({ CALLS_SWITCH: kv }, 1_000 + CALLS_MODE_CACHE_MS)).toBe('off');
    expect(kv.gets).toBe(2);
  });

  it('keeps the last answer when KV cannot be read', async () => {
    const kv = fakeKv({ [CALLS_MODE_KEY]: 'off' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await callsMode({ CALLS_SWITCH: kv }, 0)).toBe('off');
    kv.failGets = true;
    expect(await callsMode({ CALLS_SWITCH: kv }, CALLS_MODE_CACHE_MS * 2)).toBe('off');
  });

  it('is on when KV cannot be read and nothing was cached', async () => {
    const kv = fakeKv();
    kv.failGets = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await callsMode({ CALLS_SWITCH: kv }, 0)).toBe('on');
  });

  it('uses the clock when no time is given', async () => {
    const kv = fakeKv({ [CALLS_MODE_KEY]: 'off' });
    expect(await callsMode({ CALLS_SWITCH: kv })).toBe('off');
  });
});

describe('writeCallsMode', () => {
  it('writes the key and this isolate sees it at once', async () => {
    const kv = fakeKv({ [CALLS_MODE_KEY]: 'on' });
    expect(await callsMode({ CALLS_SWITCH: kv }, 0)).toBe('on');
    await writeCallsMode(kv, 'off', 10);
    expect(kv.store.get(CALLS_MODE_KEY)).toBe('off');
    expect(await callsMode({ CALLS_SWITCH: kv }, 20)).toBe('off');
    await writeCallsMode(kv, 'audio-only');
    expect(kv.store.get(CALLS_MODE_KEY)).toBe('audio-only');
  });
});
