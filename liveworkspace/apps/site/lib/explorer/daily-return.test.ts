// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TELEMETRY_FLUSH_DELAY_MS } from '@liveworkspace/telemetry/emitter';

const KEY = 'liveplanner:v2:last-active-day';
const host = vi.hoisted(() => ({ app: 'liveplanner' as string | null }));
vi.mock('./page-app', () => ({
  pageApp: () => host.app,
  workspaceOrigin: () => 'https://liveworkspace.app',
}));

let fetchMock: ReturnType<typeof vi.fn>;
let telemetry: typeof import('./telemetry');
let dailyReturn: typeof import('./daily-return');

const sent = () =>
  fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    ...(JSON.parse((init as { body: string }).body) as { app: string; events: unknown[] }),
  }));

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 9, 26, 9));
  vi.stubEnv('NEXT_PUBLIC_TELEMETRY_ENABLED', 'true');
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
  host.app = 'liveplanner';
  vi.resetModules();
  telemetry = await import('./telemetry');
  dailyReturn = await import('./daily-return');
  telemetry.setExplorerConsent(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the Explorer's daily return on an app's address", () => {
  it("counts the app's return from its own origin, once a day, on the editor's key", () => {
    localStorage.setItem(KEY, '2026-10-24');
    dailyReturn.trackExplorerDailyReturn(false);
    dailyReturn.trackExplorerDailyReturn(false);
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(sent()).toEqual([
      {
        url: 'https://liveworkspace.app/api/telemetry/events',
        app: 'liveplanner.app',
        events: [{ category: 'Participant', action: 'Returned', type: 'Anonymous' }],
      },
    ]);
    expect(localStorage.getItem(KEY)).toBe('2026-10-26');
  });

  it('counts nothing when the editor already counted today, or on the first day seen', () => {
    localStorage.setItem(KEY, '2026-10-26');
    dailyReturn.trackExplorerDailyReturn(true);
    localStorage.removeItem(KEY);
    dailyReturn.trackExplorerDailyReturn(true);
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe('2026-10-26');
  });

  it('types a signed-in return Authenticated', () => {
    localStorage.setItem(KEY, '2026-10-01');
    dailyReturn.trackExplorerDailyReturn(true);
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(sent()[0]?.events).toEqual([
      { category: 'Participant', action: 'Returned', type: 'Authenticated' },
    ]);
  });

  it('sends nothing on liveworkspace.app, in no app’s name, and touches no key', () => {
    host.app = null;
    localStorage.setItem(KEY, '2026-10-01');
    dailyReturn.trackExplorerDailyReturn(false);
    telemetry.trackAppEvent('Participant', 'Returned', 'Anonymous');
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe('2026-10-01');
  });

  it('honours the person’s choice', () => {
    telemetry.setExplorerConsent(false);
    localStorage.setItem(KEY, '2026-10-01');
    dailyReturn.trackExplorerDailyReturn(true);
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
