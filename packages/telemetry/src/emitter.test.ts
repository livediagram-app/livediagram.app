// The engine's own behaviour (the timer, the beacon, the one retry) is covered through each app's
// telemetry-client, which wraps it. Here: what only a page speaking for several apps does.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTelemetryEngine, TELEMETRY_FLUSH_DELAY_MS, TELEMETRY_MAX_BUFFER } from './emitter';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const bodies = () =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as { body: string }).body));

describe('the telemetry engine', () => {
  it('sends one batch per app on each flush, never one request per event', () => {
    const engine = createTelemetryEngine({
      url: 'https://t.test',
      enabled: true,
      isOptedIn: () => true,
    });
    for (let i = 0; i < 6; i++)
      engine.track('liveplanner.app', 'UI', 'Toggled', 'ExplorerViewCard');
    engine.track('liveworkspace.app', 'Explorer', 'Selected', 'Text');
    engine.track('liveplanner.app', 'Timeline', 'Changed', 'Calendar');
    expect(fetchMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://t.test/events');
    const [planner, platform] = bodies();
    expect(planner.app).toBe('liveplanner.app');
    expect(planner.events).toHaveLength(7);
    expect(platform).toEqual({
      app: 'liveworkspace.app',
      events: [{ category: 'Explorer', action: 'Selected', type: 'Text' }],
    });
  });

  it('flushes early once the buffer is full', () => {
    const engine = createTelemetryEngine({
      url: 'https://t.test',
      enabled: true,
      isOptedIn: () => true,
    });
    for (let i = 0; i < TELEMETRY_MAX_BUFFER; i++)
      engine.track('livediagram.app', 'Home', 'Opened', 'Group');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when the build turned it off or the person opted out', () => {
    const off = createTelemetryEngine({
      url: 'https://t.test',
      enabled: false,
      isOptedIn: () => true,
    });
    const out = createTelemetryEngine({
      url: 'https://t.test',
      enabled: true,
      isOptedIn: () => false,
    });
    off.track('liveplanner.app', 'Home', 'Opened', 'Group');
    out.track('liveplanner.app', 'Home', 'Opened', 'Group');
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
