// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TELEMETRY_FLUSH_DELAY_MS } from '@liveworkspace/telemetry/emitter';

// The project kits' telemetry (liveworkspace/docs/specs/004-index/kits.md "Telemetry"): liveworkspace.app's own
// events, whatever the page's sender, never from an app's address, and only with the person's yes.
const host = vi.hoisted(() => ({ app: null as string | null }));
vi.mock('./page-app', () => ({
  pageApp: () => host.app,
  workspaceOrigin: () => 'https://liveworkspace.app',
}));

let fetchMock: ReturnType<typeof vi.fn>;
let telemetry: typeof import('./telemetry');

const sent = () =>
  fetchMock.mock.calls.map(
    ([, init]) => JSON.parse((init as { body: string }).body) as { app: string; events: unknown[] },
  );

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubEnv('NEXT_PUBLIC_TELEMETRY_ENABLED', 'true');
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal('fetch', fetchMock);
  host.app = null;
  vi.resetModules();
  telemetry = await import('./telemetry');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('a project kit’s steps', () => {
  it('count for liveworkspace.app itself, even while the page speaks for an app', () => {
    telemetry.setExplorerConsent(true);
    telemetry.setExplorerSender('liveplanner', 'app');
    telemetry.trackKit('Started', 'SoftwareProject');
    telemetry.trackKit('Retried', 'SoftwareProject');
    telemetry.trackKit('Completed', 'SoftwareProject');
    telemetry.trackKit('Removed', 'WebsiteBuild');
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(sent()).toEqual([
      {
        app: 'liveworkspace.app',
        events: [
          { category: 'Kit', action: 'Started', type: 'SoftwareProject' },
          { category: 'Kit', action: 'Retried', type: 'SoftwareProject' },
          { category: 'Kit', action: 'Completed', type: 'SoftwareProject' },
          { category: 'Kit', action: 'Removed', type: 'WebsiteBuild' },
        ],
      },
    ]);
  });

  it('wait for the person’s choice, and go nowhere on a no', () => {
    telemetry.trackKit('Started', 'TeamWorkshop');
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(fetchMock).not.toHaveBeenCalled();
    telemetry.setExplorerConsent(false);
    telemetry.trackKit('Completed', 'TeamWorkshop');
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('send nothing from an app’s own address', () => {
    host.app = 'liveplanner';
    telemetry.setExplorerConsent(true);
    telemetry.trackKit('Started', 'ProductLaunch');
    vi.advanceTimersByTime(TELEMETRY_FLUSH_DELAY_MS);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
