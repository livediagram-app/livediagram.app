import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The engine only touches window / document / navigator / fetch inside
// its functions (all typeof-guarded), so plain node + stubbed globals
// cover it without a DOM environment. Event targets are hand-rolled so
// the tests can fire visibilitychange / pagehide / error deliberately.

function makeTarget() {
  const handlers: Record<string, Array<(ev?: unknown) => void>> = {};
  return {
    addEventListener: (type: string, fn: (ev?: unknown) => void) => {
      (handlers[type] ??= []).push(fn);
    },
    fire(type: string, ev?: unknown) {
      for (const fn of handlers[type] ?? []) fn(ev);
    },
    count(type: string) {
      return (handlers[type] ?? []).length;
    },
  };
}

type Emitter = typeof import('./index');

let windowTarget: ReturnType<typeof makeTarget>;
let documentTarget: ReturnType<typeof makeTarget> & { visibilityState: string };
let fetchMock: ReturnType<typeof vi.fn>;
let sendBeacon: ReturnType<typeof vi.fn>;
let mod: Emitter;

beforeEach(async () => {
  vi.useFakeTimers();
  windowTarget = makeTarget();
  documentTarget = Object.assign(makeTarget(), { visibilityState: 'visible' });
  fetchMock = vi.fn(() => Promise.resolve());
  sendBeacon = vi.fn(() => true);
  vi.stubGlobal('window', windowTarget);
  vi.stubGlobal('document', documentTarget);
  vi.stubGlobal('navigator', { sendBeacon });
  vi.stubGlobal('fetch', fetchMock);
  // Fresh module per test: installClientErrorTracking is one-shot via a
  // module-level flag, so each test needs its own instance.
  vi.resetModules();
  mod = await import('./index');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const makeEmitter = (over: Partial<Parameters<Emitter['createTelemetryEmitter']>[0]> = {}) =>
  mod.createTelemetryEmitter({ apiBase: '/api', enabled: true, isOptedIn: () => true, ...over });

const sentEvents = (call: unknown[]) =>
  (JSON.parse((call[1] as { body: string }).body) as { events: unknown[] }).events;

describe('createTelemetryEmitter', () => {
  it('batches events and flushes them once on the timer', () => {
    const emitter = makeEmitter();
    emitter.track('UI', 'Opened', 'Settings');
    emitter.track('UI', 'Closed');
    expect(fetchMock).not.toHaveBeenCalled(); // buffered, not sent per-call
    vi.advanceTimersByTime(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/events');
    expect((init as { keepalive: boolean }).keepalive).toBe(true);
    expect(sentEvents(fetchMock.mock.calls[0]!)).toEqual([
      { category: 'UI', action: 'Opened', type: 'Settings' },
      { category: 'UI', action: 'Closed', type: null }, // missing type -> null
    ]);
    // The flush drained the buffer: nothing further on later timers.
    vi.advanceTimersByTime(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('flushes immediately when the buffer hits its cap', () => {
    const emitter = makeEmitter();
    for (let i = 0; i < 25; i++) emitter.track('UI', 'Opened');
    expect(fetchMock).toHaveBeenCalledTimes(1); // no timer needed
    expect(sentEvents(fetchMock.mock.calls[0]!)).toHaveLength(25);
  });

  it('is a permanent no-op when the build-time gate is off', () => {
    const emitter = makeEmitter({ enabled: false });
    emitter.track('UI', 'Opened');
    vi.advanceTimersByTime(60_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('consults the opt-in on every call, not once', () => {
    let optedIn = true;
    const emitter = makeEmitter({ isOptedIn: () => optedIn });
    emitter.track('UI', 'Opened');
    optedIn = false;
    emitter.track('UI', 'Closed'); // dropped: user opted out between calls
    vi.advanceTimersByTime(10_000);
    expect(sentEvents(fetchMock.mock.calls[0]!)).toHaveLength(1);
  });

  it('flushes pending events through sendBeacon when the page hides', () => {
    const emitter = makeEmitter();
    emitter.track('UI', 'Opened');
    documentTarget.visibilityState = 'hidden';
    documentTarget.fire('visibilitychange');
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0]![0]).toBe('/api/events');
    // The beacon drained the buffer; the pending timer sends nothing.
    vi.advanceTimersByTime(10_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('flushes on pagehide too (the beacon iteration-9 conversions rely on)', () => {
    const emitter = makeEmitter();
    emitter.track('Diagram', 'Moved', 'SavedToCloud');
    windowTarget.fire('pagehide');
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  // --- Retry on a failed flush (spec/22, issue #37) ---------------------
  //
  // Emitting is fire-and-forget, so a dropped batch is invisible. The losses
  // also aren't evenly spread: they concentrate in flaky-network sessions,
  // which biases the data rather than just thinning it.

  it('retries a batch once after a network rejection', async () => {
    const reject = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', reject);
    const emitter = makeEmitter();
    emitter.track('UI', 'Opened');
    vi.advanceTimersByTime(10_000);
    await Promise.resolve();
    expect(reject).toHaveBeenCalledTimes(1);

    // The failure arms a fresh timer even with nothing new tracked, so the
    // retry happens on its own rather than waiting for the next event.
    const ok = vi.fn(() => Promise.resolve());
    vi.stubGlobal('fetch', ok);
    vi.advanceTimersByTime(10_000);
    expect(ok).toHaveBeenCalledTimes(1);
    expect(sentEvents(ok.mock.calls[0]!)).toEqual([
      { category: 'UI', action: 'Opened', type: null },
    ]);
  });

  it('gives up after the one retry rather than looping forever', async () => {
    const reject = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', reject);
    const emitter = makeEmitter();
    emitter.track('UI', 'Opened');
    vi.advanceTimersByTime(10_000);
    await Promise.resolve();
    // The retry, which also fails.
    vi.advanceTimersByTime(10_000);
    await Promise.resolve();
    expect(reject).toHaveBeenCalledTimes(2);

    const ok = vi.fn(() => Promise.resolve());
    vi.stubGlobal('fetch', ok);
    vi.advanceTimersByTime(60_000);
    expect(ok).not.toHaveBeenCalled();
  });

  it('puts retried events at the front, ahead of newer ones', async () => {
    const reject = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', reject);
    const emitter = makeEmitter();
    emitter.track('UI', 'Opened');
    vi.advanceTimersByTime(10_000);
    await Promise.resolve();

    const ok = vi.fn(() => Promise.resolve());
    vi.stubGlobal('fetch', ok);
    emitter.track('UI', 'Closed');
    vi.advanceTimersByTime(10_000);
    expect(sentEvents(ok.mock.calls[0]!)).toEqual([
      { category: 'UI', action: 'Opened', type: null },
      { category: 'UI', action: 'Closed', type: null },
    ]);
  });

  // A non-2xx means the server ANSWERED, so re-sending risks duplicating
  // something it already stored — and retrying a 429 would only make the
  // thing it is complaining about worse.
  it('does not retry when the server responded', async () => {
    const ok = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
    vi.stubGlobal('fetch', ok);
    const emitter = makeEmitter();
    emitter.track('UI', 'Opened');
    vi.advanceTimersByTime(10_000);
    await Promise.resolve();
    vi.advanceTimersByTime(60_000);
    expect(ok).toHaveBeenCalledTimes(1);
  });

  // We are unloading: there is no later to retry in, and a requeue would
  // just hold the events until they're discarded with the page.
  it('does not retry the beacon path', async () => {
    sendBeacon.mockReturnValue(false);
    const fetchAfterBeacon = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchAfterBeacon);
    const emitter = makeEmitter();
    emitter.track('UI', 'Opened');
    windowTarget.fire('pagehide');
    await Promise.resolve();
    // The beacon refused, so it fell through to the keepalive fetch...
    expect(fetchAfterBeacon).toHaveBeenCalledTimes(1);
    // ...but that failing does NOT arm a retry.
    vi.advanceTimersByTime(60_000);
    expect(fetchAfterBeacon).toHaveBeenCalledTimes(1);
  });

  // sendBeacon returns false when the UA's queue is full. That used to be
  // ignored, losing the batch silently at exactly the moment it mattered.
  it('falls through to keepalive fetch when the beacon is refused', () => {
    sendBeacon.mockReturnValue(false);
    const emitter = makeEmitter();
    emitter.track('UI', 'Opened');
    windowTarget.fire('pagehide');
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentEvents(fetchMock.mock.calls[0]!)).toEqual([
      { category: 'UI', action: 'Opened', type: null },
    ]);
  });

  it('caps the retry buffer so a dead network cannot grow it', async () => {
    const reject = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', reject);
    const emitter = makeEmitter();
    // Two full batches fail back-to-back; the requeue must stay bounded.
    for (let i = 0; i < 50; i++) emitter.track('UI', 'Opened');
    expect(reject).toHaveBeenCalledTimes(2);
    // Let both rejection handlers run before inspecting what was requeued.
    await vi.waitFor(() => expect(reject.mock.settledResults.length).toBe(2));

    const ok = vi.fn(() => Promise.resolve());
    vi.stubGlobal('fetch', ok);
    vi.advanceTimersByTime(10_000);
    expect(ok).toHaveBeenCalledTimes(1);
    // 50 events failed, but only one buffer's worth is ever held.
    expect(sentEvents(ok.mock.calls[0]!)).toHaveLength(25);
  });

  it('never throws into the host app when the transport fails', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('offline');
      }),
    );
    const emitter = makeEmitter();
    emitter.track('UI', 'Opened');
    expect(() => vi.advanceTimersByTime(10_000)).not.toThrow();
  });
});

describe('installClientErrorTracking', () => {
  const at = (pathname: string) => Object.assign(windowTarget, { location: { pathname } });

  it('names the kind, the page, and the error constructor', () => {
    const track = vi.fn();
    at('/diagram/0b7c5f9e-1111-4222-8333-944445555666');
    mod.installClientErrorTracking(track);
    windowTarget.fire('error', { error: new TypeError('x is undefined') });
    windowTarget.fire('unhandledrejection', { reason: new RangeError('bad') });
    expect(track.mock.calls).toEqual([
      ['Error', 'Client', 'Uncaught.Diagram.TypeError'],
      ['Error', 'Client', 'UnhandledRejection.Diagram.RangeError'],
    ]);
  });

  it('never forwards a message, id, or custom error name', () => {
    const track = vi.fn();
    at('/explorer/team/abc123def456ghi789');
    mod.installClientErrorTracking(track);
    const odd = new Error('secret diagram name');
    odd.name = 'MyCustomError';
    windowTarget.fire('error', { error: odd });
    windowTarget.fire('unhandledrejection', { reason: 'a string' });
    expect(track.mock.calls).toEqual([
      ['Error', 'Client', 'Uncaught.Explorer.Other'],
      ['Error', 'Client', 'UnhandledRejection.Explorer.NonError'],
    ]);
  });

  it('still reports when the page or error is unknown', () => {
    const track = vi.fn();
    mod.installClientErrorTracking(track);
    windowTarget.fire('error');
    expect(track.mock.calls).toEqual([['Error', 'Client', 'Uncaught.NonError']]);
  });

  it('caps each distinct type per page load so an error storm cannot flood', () => {
    const track = vi.fn();
    at('/diagram');
    mod.installClientErrorTracking(track);
    for (let i = 0; i < 25; i++) windowTarget.fire('error', { error: new TypeError('x') });
    expect(track).toHaveBeenCalledTimes(10);
    // The cap is per type: a different error, or a rejection, still gets through.
    windowTarget.fire('error', { error: new RangeError('x') });
    windowTarget.fire('unhandledrejection', { reason: new TypeError('x') });
    expect(track).toHaveBeenCalledTimes(12);
  });

  it('installs once: a second call must not double-count events', () => {
    const track = vi.fn();
    mod.installClientErrorTracking(track);
    mod.installClientErrorTracking(track);
    windowTarget.fire('error');
    expect(track).toHaveBeenCalledTimes(1);
    expect(windowTarget.count('error')).toBe(1);
  });

  it('swallows a throwing track (telemetry IS the error path here)', () => {
    mod.installClientErrorTracking(() => {
      throw new Error('boom');
    });
    expect(() => windowTarget.fire('error')).not.toThrow();
  });
});

describe('telemetry opt-out contract', () => {
  it('keeps the storage key both apps read byte-identical', async () => {
    // The whole point of the shared constant. If this string changes, it must
    // change for the editor AND the help centre in the same commit, or an
    // opt-out made in one stops being visible to the other.
    const { USER_PREFERENCES_STORAGE_KEY } = await import('./index');
    expect(USER_PREFERENCES_STORAGE_KEY).toBe('livediagram:user-preferences:v1');
  });

  it('is on by default and off only on an explicit false', async () => {
    const { telemetryOptInFromRaw } = await import('./index');
    // Off: the one shape that means opted out.
    expect(telemetryOptInFromRaw('{"telemetryEnabled":false}')).toBe(false);
    // On: nothing stored, field absent, explicitly true.
    expect(telemetryOptInFromRaw(null)).toBe(true);
    expect(telemetryOptInFromRaw('')).toBe(true);
    expect(telemetryOptInFromRaw('{}')).toBe(true);
    expect(telemetryOptInFromRaw('{"otherFlag":true}')).toBe(true);
    expect(telemetryOptInFromRaw('{"telemetryEnabled":true}')).toBe(true);
  });

  it('treats a corrupted blob as on rather than silently disabling collection', async () => {
    const { telemetryOptInFromRaw } = await import('./index');
    expect(telemetryOptInFromRaw('not json')).toBe(true);
    expect(telemetryOptInFromRaw('null')).toBe(true);
  });

  it('reads the opt-out through the shared key', async () => {
    const { readTelemetryOptIn, USER_PREFERENCES_STORAGE_KEY } = await import('./index');
    const store: Record<string, string> = {
      [USER_PREFERENCES_STORAGE_KEY]: '{"telemetryEnabled":false}',
    };
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => store[k] ?? null },
    });
    expect(readTelemetryOptIn()).toBe(false);
    // A different key must not be mistaken for the preferences blob.
    delete store[USER_PREFERENCES_STORAGE_KEY];
    store['livediagram:user-preferences:v2'] = '{"telemetryEnabled":false}';
    expect(readTelemetryOptIn()).toBe(true);
  });
});

describe('createLazyTrack', () => {
  const withPrefs = (raw: string | null) =>
    Object.assign(windowTarget, { localStorage: { getItem: () => raw } });

  it('sends through the shared engine when enabled and opted in', () => {
    withPrefs(null);
    const track = mod.createLazyTrack({ apiBase: '/api', enabled: true });
    track('Page', 'View', '/faq');
    vi.advanceTimersByTime(10_000);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(sentEvents(fetchMock.mock.calls[0]!)).toEqual([
      { category: 'Page', action: 'View', type: '/faq' },
    ]);
  });

  it('honours the stored opt-out and the build gate', () => {
    withPrefs(JSON.stringify({ telemetryEnabled: false }));
    mod.createLazyTrack({ apiBase: '/api', enabled: true })('Page', 'View', '/');
    withPrefs(null);
    mod.createLazyTrack({ apiBase: '/api', enabled: false })('Page', 'View', '/');
    vi.advanceTimersByTime(10_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
