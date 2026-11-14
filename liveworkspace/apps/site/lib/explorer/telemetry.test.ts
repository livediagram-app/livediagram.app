// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveworkspace/index-client';
import { TELEMETRY_FLUSH_DELAY_MS } from '@liveworkspace/telemetry/emitter';

type Module = typeof import('./telemetry');
let t: Module;
let fetchMock: ReturnType<typeof vi.fn>;

const item = (app: string) => ({ id: 'i1', app }) as unknown as Item;
const batches = () =>
  fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    ...(JSON.parse((init as { body: string }).body) as { app: string; events: unknown[] }),
  }));

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubEnv('NEXT_PUBLIC_TELEMETRY_ENABLED', 'true');
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  t = await import('./telemetry');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the Explorer's telemetry on liveworkspace.app", () => {
  it('counts for the app the page shows, or liveworkspace.app for All Apps, in one batch each', () => {
    t.setExplorerConsent(true);
    t.setExplorerSender('liveplanner', 'app');
    t.trackViewToggled('ExplorerViewCard');
    t.trackHome('Loaded', 'Retry');
    t.trackLens('OpensIn');
    t.setExplorerSender('liveplanner', 'all');
    t.trackWelcomeOpened();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(batches()).toEqual([
      {
        url: '/api/telemetry/events',
        app: 'liveplanner.app',
        events: [
          { category: 'UI', action: 'Toggled', type: 'ExplorerViewCard' },
          { category: 'Home', action: 'Loaded', type: 'Retry' },
          { category: 'Explorer', action: 'Selected', type: 'OpensIn' },
        ],
      },
      {
        url: '/api/telemetry/events',
        app: 'liveworkspace.app',
        events: [{ category: 'Home', action: 'Opened', type: 'Welcome' }],
      },
    ]);
  });

  it('counts a Share dialog’s events for the item’s own app, a revoke under its noun', () => {
    t.setExplorerConsent(true);
    t.setExplorerSender('liveplanner', 'all');
    t.trackShare('Removed', 'ShareLink', item('liveplanner'));
    t.trackShare('Removed', 'ShareLink', item('livedesign'));
    t.trackShare('Copied', 'EmbedCode', item('livedesign'));
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(batches().map((b) => [b.app, b.events])).toEqual([
      ['liveplanner.app', [{ category: 'Project', action: 'Removed', type: 'ShareLink' }]],
      [
        'livedesign.app',
        [
          { category: 'Document', action: 'Removed', type: 'ShareLink' },
          { category: 'UI', action: 'Copied', type: 'EmbedCode' },
        ],
      ],
    ]);
  });

  it('sends the Inbox’s visit as Activity·Opened, even when it opens before the setting is read', () => {
    t.setExplorerSender('liveplanner', 'app');
    // Landing on /explorer/inbox: the Inbox reports its visit before the person's setting comes back.
    t.trackInbox('Opened');
    t.setExplorerConsent(true);
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(batches().map((b) => [b.app, b.events])).toEqual([
      ['liveplanner.app', [{ category: 'Activity', action: 'Opened', type: null }]],
    ]);
  });

  it('sends nothing but the Explorer’s own tokens', () => {
    t.setExplorerConsent(true);
    t.trackHome('Loaded', 'Someone typed this' as never);
    // Home's picks are Selected, never Loaded.
    t.trackHome('Loaded', 'MostUsed');
    // The retired Timeline's events are no longer the Explorer's to send.
    t.trackWelcome('SeeTimeline' as never);
    t.trackLens('NotAFacet' as never);
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends Home's picks as Home·Selected: Most Used, Recent and See More", () => {
    t.setExplorerConsent(true);
    t.setExplorerSender('livediagram', 'app');
    t.trackHome('Selected', 'MostUsed');
    t.trackHome('Selected', 'Recent');
    t.trackHome('Selected', 'SeeMore');
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(batches().flatMap((b) => b.events)).toEqual([
      { category: 'Home', action: 'Selected', type: 'MostUsed' },
      { category: 'Home', action: 'Selected', type: 'Recent' },
      { category: 'Home', action: 'Selected', type: 'SeeMore' },
    ]);
  });

  it('holds events until the setting is read, then sends them, or drops them when it is off', () => {
    t.trackInbox('Selected', 'Thread');
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(fetchMock).not.toHaveBeenCalled();
    t.setExplorerConsent(true);
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(batches()[0]!.events).toEqual([
      { category: 'Activity', action: 'Selected', type: 'Thread' },
    ]);

    fetchMock.mockClear();
    t.__resetExplorerTelemetry();
    t.trackInbox('Selected', 'Thread');
    t.setExplorerConsent(false);
    t.trackHomeBannerOff();
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('follows the browser for a guest: Global Privacy Control sends nothing', () => {
    vi.stubGlobal('navigator', { ...navigator, globalPrivacyControl: true });
    t.setExplorerConsent(null);
    t.trackHome('Loaded', 'Retry');
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps 1,000 events to a handful of requests', () => {
    t.setExplorerConsent(true);
    for (let i = 0; i < 1000; i++) t.trackViewToggled('ExplorerViewList');
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    // A full buffer (25) flushes at once: 40 batches for 1,000 rapid toggles, never one per event.
    expect(fetchMock.mock.calls.length).toBe(40);
  });
});
