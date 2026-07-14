import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The engine only touches window / document / navigator / fetch inside
// its functions (all typeof-guarded), so plain node + stubbed globals
// cover it without a DOM environment. Event targets are hand-rolled so
// the tests can fire visibilitychange / pagehide / error deliberately.

function makeTarget() {
  const handlers: Record<string, Array<() => void>> = {};
  return {
    addEventListener: (type: string, fn: () => void) => {
      (handlers[type] ??= []).push(fn);
    },
    fire(type: string) {
      for (const fn of handlers[type] ?? []) fn();
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
  it('maps uncaught errors and rejections to their fixed kind tokens', () => {
    const track = vi.fn();
    mod.installClientErrorTracking(track);
    windowTarget.fire('error');
    windowTarget.fire('unhandledrejection');
    expect(track.mock.calls).toEqual([
      ['Error', 'Client', 'Uncaught'],
      ['Error', 'Client', 'UnhandledRejection'],
    ]);
  });

  it('caps each kind per page load so an error storm cannot flood', () => {
    const track = vi.fn();
    mod.installClientErrorTracking(track);
    for (let i = 0; i < 25; i++) windowTarget.fire('error');
    expect(track).toHaveBeenCalledTimes(10);
    // The cap is per kind: rejections still get through.
    windowTarget.fire('unhandledrejection');
    expect(track).toHaveBeenCalledTimes(11);
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
