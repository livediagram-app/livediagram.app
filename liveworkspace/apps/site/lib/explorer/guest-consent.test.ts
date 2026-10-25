// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TELEMETRY_FLUSH_DELAY_MS } from '@liveworkspace/telemetry/emitter';

// A guest's own telemetry choice, kept by the app's editor in the app's storage, holds for the Explorer on the app's
// address (liveworkspace/docs/telemetry.md "The person's choice").
const PREFS = 'liveplanner:user-preferences:v1';
const host = vi.hoisted(() => ({ app: 'liveplanner' as string | null }));
vi.mock('./page-app', () => ({
  pageApp: () => host.app,
  workspaceOrigin: () => 'https://liveworkspace.app',
}));

let fetchMock: ReturnType<typeof vi.fn>;
let t: typeof import('./telemetry');

const sentSomething = () => {
  vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
  return fetchMock.mock.calls.length > 0;
};

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubEnv('NEXT_PUBLIC_TELEMETRY_ENABLED', 'true');
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
  host.app = 'liveplanner';
  vi.resetModules();
  t = await import('./telemetry');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a guest's telemetry choice in the Explorer", () => {
  it("sends nothing on the app's address once the guest turned it off in the app", () => {
    localStorage.setItem(PREFS, JSON.stringify({ telemetryEnabled: false }));
    t.trackHome('Opened', 'Group');
    t.setExplorerConsent(null);
    t.trackHome('Opened', 'Group');
    expect(sentSomething()).toBe(false);
  });

  it('sends when the guest left it on, or never chose', () => {
    t.setExplorerConsent(null);
    t.trackHome('Opened', 'Group');
    expect(sentSomething()).toBe(true);
  });

  it('reads an unreadable copy as on', () => {
    localStorage.setItem(PREFS, '{not json');
    t.setExplorerConsent(null);
    t.trackHome('Opened', 'Group');
    expect(sentSomething()).toBe(true);
  });

  it("follows a change made in another tab, and never another app's choice", () => {
    localStorage.setItem(
      'livediagram:user-preferences:v1',
      JSON.stringify({ telemetryEnabled: false }),
    );
    t.setExplorerConsent(null);
    localStorage.setItem(PREFS, JSON.stringify({ telemetryEnabled: false }));
    window.dispatchEvent(new StorageEvent('storage', { key: PREFS }));
    t.trackHome('Opened', 'Group');
    expect(sentSomething()).toBe(false);
  });

  it("on liveworkspace.app, which can't see the app's storage, follows the browser", () => {
    host.app = null;
    localStorage.setItem(PREFS, JSON.stringify({ telemetryEnabled: false }));
    t.setExplorerConsent(null);
    t.trackHome('Opened', 'Group');
    expect(sentSomething()).toBe(true);
  });

  it("a guest's Settings here turns it back on, but never past the browser's Do Not Track", () => {
    localStorage.setItem(PREFS, JSON.stringify({ telemetryEnabled: false }));
    t.setExplorerConsent(null);
    t.setGuestTelemetryChoice(true);
    t.trackHome('Opened', 'Group');
    expect(sentSomething()).toBe(true);

    fetchMock.mockClear();
    vi.stubGlobal('navigator', { ...navigator, doNotTrack: '1' });
    t.setGuestTelemetryChoice(true);
    t.trackHome('Opened', 'Group');
    expect(sentSomething()).toBe(false);
  });

  it('a signed-in person follows their account setting, not the browser copy', () => {
    // A guest who then signs in: the guest's listener is still there, and must not override the account.
    t.setExplorerConsent(null);
    localStorage.setItem(PREFS, JSON.stringify({ telemetryEnabled: false }));
    t.setExplorerConsent(true);
    window.dispatchEvent(new StorageEvent('storage', { key: PREFS }));
    t.trackHome('Opened', 'Group');
    expect(sentSomething()).toBe(true);
  });
});
