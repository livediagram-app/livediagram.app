// Tests for the lib/telemetry emitter (spec/22). The module-level
// ENABLED constant is captured from process.env at import time, so
// each test that needs a specific ENABLED value uses vi.resetModules
// + vi.stubEnv to re-import a fresh copy with the new env, instead
// of trying to mutate a captured const. titleCaseType is import-
// independent so it lives in its own block at the top.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./user-preferences', () => ({
  readUserPreferences: vi.fn(() => ({})),
  PREFERENCES_CHANGED_EVENT: 'livediagram:preferences-changed',
  STORAGE_KEY: 'livediagram:user-preferences:v1',
}));

import { readUserPreferences } from './user-preferences';
const mockedReadPrefs = vi.mocked(readUserPreferences);

// Capture fetch + sendBeacon so we can assert (or not assert) that
// they fire. window + document + navigator are stubbed per test so
// the module's "is the browser there?" guards see what we want.
const fetchMock = vi.fn();
const sendBeaconMock = vi.fn();

function setUpBrowser(): {
  fireEvent: (type: string, data?: { key?: string }) => void;
  setVisibility: (state: 'visible' | 'hidden') => void;
} {
  const listeners = new Map<string, Set<(e: Event) => void>>();
  const addListener = (type: string, cb: (e: Event) => void) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(cb);
  };
  const removeListener = (type: string, cb: (e: Event) => void) => {
    listeners.get(type)?.delete(cb);
  };
  let visibility: 'visible' | 'hidden' = 'visible';
  vi.stubGlobal('window', {
    addEventListener: addListener,
    removeEventListener: removeListener,
    dispatchEvent: (e: Event) => {
      listeners.get(e.type)?.forEach((cb) => cb(e));
      return true;
    },
  });
  vi.stubGlobal('document', {
    addEventListener: addListener,
    removeEventListener: removeListener,
    get visibilityState() {
      return visibility;
    },
  });
  vi.stubGlobal('navigator', { sendBeacon: sendBeaconMock });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal(
    'Event',
    class StubEvent {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    },
  );
  return {
    fireEvent: (type, data) => {
      const event = { type, ...(data ?? {}) } as unknown as Event;
      listeners.get(type)?.forEach((cb) => cb(event));
    },
    setVisibility: (s) => {
      visibility = s;
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  mockedReadPrefs.mockReset();
  mockedReadPrefs.mockReturnValue({});
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  sendBeaconMock.mockReset();
  sendBeaconMock.mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function importWithEnv(enabled: boolean) {
  vi.stubEnv('NEXT_PUBLIC_TELEMETRY_ENABLED', enabled ? 'true' : '');
  return import('./telemetry');
}

describe('titleCaseType', () => {
  // No env / module-state dependence, so import once outside the
  // resetModules dance. Keeps these cases fast + obvious.
  it('uppercases the first character', async () => {
    const { titleCaseType } = await importWithEnv(false);
    expect(titleCaseType('square')).toBe('Square');
    expect(titleCaseType('arrow')).toBe('Arrow');
  });

  it('leaves already-capitalised input alone', async () => {
    const { titleCaseType } = await importWithEnv(false);
    expect(titleCaseType('Square')).toBe('Square');
  });

  it('returns empty string unchanged (no out-of-bounds access)', async () => {
    const { titleCaseType } = await importWithEnv(false);
    expect(titleCaseType('')).toBe('');
  });

  it('does not touch characters past the first', async () => {
    const { titleCaseType } = await importWithEnv(false);
    expect(titleCaseType('iPhone')).toBe('IPhone'); // i -> I, P stays P
  });
});

describe('track gate', () => {
  it('is a no-op when NEXT_PUBLIC_TELEMETRY_ENABLED is unset (self-host default)', async () => {
    setUpBrowser();
    const { track } = await importWithEnv(false);
    track('Element', 'Added', 'Square');
    // No buffering, no flush attempts, no opt-in read.
    expect(mockedReadPrefs).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  it('is a no-op when the user opted out via Settings (telemetryEnabled: false)', async () => {
    setUpBrowser();
    mockedReadPrefs.mockReturnValue({ telemetryEnabled: false });
    const { track } = await importWithEnv(true);
    track('Element', 'Added', 'Square');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  it('treats missing telemetryEnabled key as opted-IN (default on)', async () => {
    // Important: never-touched-settings users should still emit, that's
    // the spec/20 + spec/22 default. Negative coverage on this branch
    // is exactly the "telemetry silently disappeared" bug class.
    setUpBrowser();
    mockedReadPrefs.mockReturnValue({}); // no telemetryEnabled key
    vi.useFakeTimers();
    const { track } = await importWithEnv(true);
    track('Element', 'Added', 'Square');
    // The event sits in the buffer; the timer-driven flush fires it.
    vi.advanceTimersByTime(10_001);
    await vi.runAllTimersAsync();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/events',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          events: [{ category: 'Element', action: 'Added', type: 'Square' }],
        }),
      }),
    );
  });

  it('flushes immediately when the buffer fills past MAX_BUFFER (25)', async () => {
    setUpBrowser();
    vi.useFakeTimers();
    const { track } = await importWithEnv(true);
    // 25 events fills the buffer exactly; the 25th call triggers a
    // synchronous flush rather than waiting for the 10s timer.
    for (let i = 0; i < 25; i++) {
      track('Element', 'Added', 'Square');
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('emits null `type` when track is called without one (zero-arity events)', async () => {
    setUpBrowser();
    vi.useFakeTimers();
    const { track } = await importWithEnv(true);
    track('Session', 'Joined');
    vi.advanceTimersByTime(10_001);
    await vi.runAllTimersAsync();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/events',
      expect.objectContaining({
        body: JSON.stringify({
          events: [{ category: 'Session', action: 'Joined', type: null }],
        }),
      }),
    );
  });

  it('invalidates the opt-in cache on the preferences-changed window event', async () => {
    // First call reads prefs and caches the opt-in flag. A later
    // preferences change must invalidate the cache so the next
    // track call re-reads the (possibly flipped) value.
    setUpBrowser();
    vi.useFakeTimers();
    mockedReadPrefs.mockReturnValue({}); // start opted in
    const { track } = await importWithEnv(true);
    track('Element', 'Added', 'Square');
    expect(mockedReadPrefs).toHaveBeenCalledTimes(1);
    // Flip the preferences and dispatch the same-tab event.
    mockedReadPrefs.mockReturnValue({ telemetryEnabled: false });
    window.dispatchEvent(new Event('livediagram:preferences-changed'));
    track('Element', 'Added', 'Circle');
    // Cache was invalidated, so readPrefs fired a second time and
    // saw the flip. The flush for the FIRST batch still goes through
    // (it was already buffered), but no NEW events join it.
    expect(mockedReadPrefs).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(10_001);
    await vi.runAllTimersAsync();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0]![1] as { body: string };
    const sent = JSON.parse(firstCall.body) as {
      events: { type: string | null }[];
    };
    expect(sent.events).toHaveLength(1); // only the pre-opt-out event
    expect(sent.events[0]!.type).toBe('Square');
  });
});
