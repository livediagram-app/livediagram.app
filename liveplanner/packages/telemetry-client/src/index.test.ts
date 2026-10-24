import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The binding's own facts. The engine, opt-out rule, error cap and timing watch are tested in
// @liveworkspace/telemetry-client; here, that liveplanner's values reach them.

type Binding = typeof import('./index');
let mod: Binding;

beforeEach(async () => {
  // Fresh module per test: client error tracking installs once per module instance.
  vi.resetModules();
  mod = await import('./index');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('liveplanner telemetry binding', () => {
  it('keeps the storage key both apps read byte-identical', () => {
    // People's saved preferences and telemetry opt-out live under this key. If it changes, they
    // reset, and the editor and the help centre must change it in the same commit.
    expect(mod.USER_PREFERENCES_STORAGE_KEY).toBe('liveplanner:user-preferences:v1');
  });

  it('reports as liveplanner.app', () => {
    expect(mod.TELEMETRY_APP).toBe('liveplanner.app');
  });

  it('reads the opt-out under its own key', () => {
    const store: Record<string, string> = {
      'liveplanner:user-preferences:v1': '{"telemetryEnabled":false}',
    };
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => store[k] ?? null } });
    expect(mod.readTelemetryOptIn()).toBe(false);
    delete store['liveplanner:user-preferences:v1'];
    expect(mod.readTelemetryOptIn()).toBe(true);
  });

  it("names a client error by this product's pages", () => {
    const handlers: Record<string, (ev: unknown) => void> = {};
    vi.stubGlobal('window', {
      location: { pathname: '/project/0b7c5f9e-1111-4222-8333-944445555666', href: '' },
      addEventListener: (type: string, fn: (ev: unknown) => void) => (handlers[type] = fn),
    });
    const track = vi.fn();
    mod.installClientErrorTracking(track);
    handlers.error!({ error: new TypeError('x') });
    expect(track).toHaveBeenCalledWith('Error', 'Client', 'Uncaught.Project.TypeError');
  });

  it("buckets a timing on this product's metrics", () => {
    const track = vi.fn();
    mod.reportTiming(track, 'ProjectLoad', 1500);
    mod.reportTiming(track, 'NotAMetric', 1500);
    expect(track.mock.calls).toEqual([['Timing', 'Measured', 'ProjectLoad.Under2000ms']]);
  });
});
