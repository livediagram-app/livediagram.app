import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  flushServerEvents,
  flushServerEventsAfter,
  reportServerEvent,
  TELEMETRY_TIMEOUT_MS,
  waitingServerEvents,
} from './telemetry.ts';

const env = {
  TELEMETRY_URL: 'https://liveworkspace.app/api/telemetry/',
  TELEMETRY_KEY_LIVEDIAGRAM: 'ld-key',
  TELEMETRY_KEY_LIVEPLANNER: 'lp-key',
};

type Sent = { url: string; key: string | null; body: { app: string; events: unknown[] } };

function service(
  answer: (request: Request) => Promise<Response> = async () => new Response(null, { status: 204 }),
) {
  const sent: Sent[] = [];
  const fetcher = {
    fetch: async (request: Request) => {
      sent.push({
        url: request.url,
        key: request.headers.get('X-Telemetry-Key'),
        body: (await request.clone().json()) as Sent['body'],
      });
      return answer(request);
    },
  } as unknown as Fetcher;
  return { sent, fetcher };
}

afterEach(async () => {
  await flushServerEvents({});
  vi.restoreAllMocks();
});

describe('server events', () => {
  it('sends what waited as one batch per app, with that app’s key', async () => {
    const { sent, fetcher } = service();
    for (let i = 0; i < 3; i++)
      reportServerEvent(env, 'Email', 'Sent', 'Welcome', 'livediagram.app');
    reportServerEvent(env, 'Email', 'Sent', 'Week1', 'liveplanner.app');
    await flushServerEvents({ ...env, TELEMETRY: fetcher });
    expect(sent).toHaveLength(2);
    const diagram = sent.find((s) => s.body.app === 'livediagram.app')!;
    expect(diagram.url).toBe('https://liveworkspace.app/api/telemetry/events');
    expect(diagram.key).toBe('ld-key');
    expect(diagram.body.events).toEqual([
      { category: 'Email', action: 'Sent', type: 'Welcome' },
      { category: 'Email', action: 'Sent', type: 'Welcome' },
      { category: 'Email', action: 'Sent', type: 'Welcome' },
    ]);
    expect(sent.find((s) => s.body.app === 'liveplanner.app')!.key).toBe('lp-key');
    expect(waitingServerEvents()).toHaveLength(0);
  });

  it('splits a long run into the service’s batch size', async () => {
    const { sent, fetcher } = service();
    for (let i = 0; i < 250; i++)
      reportServerEvent(env, 'Email', 'Sent', 'Week2', 'livediagram.app');
    await flushServerEvents({ ...env, TELEMETRY: fetcher });
    expect(sent.map((s) => s.body.events.length)).toEqual([100, 100, 50]);
  });

  it('skips an app with no key, and holds nothing with no service configured', async () => {
    const { sent, fetcher } = service();
    reportServerEvent(env, 'Email', 'Sent', 'Welcome', 'livedesign.app');
    await flushServerEvents({ ...env, TELEMETRY: fetcher });
    expect(sent).toHaveLength(0);
    reportServerEvent({}, 'Email', 'Sent', 'Welcome', 'livediagram.app');
    expect(waitingServerEvents()).toHaveLength(0);
  });

  it('never throws, and gives up on a service that doesn’t answer', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = service(async () => {
      throw new Error('down');
    });
    reportServerEvent(env, 'Email', 'Sent', 'Welcome', 'livediagram.app');
    await expect(
      flushServerEvents({ ...env, TELEMETRY: failing.fetcher }),
    ).resolves.toBeUndefined();

    vi.useFakeTimers();
    try {
      const hung = {
        fetch: (request: Request) =>
          new Promise<Response>((_, reject) =>
            request.signal.addEventListener('abort', () => reject(request.signal.reason)),
          ),
      } as unknown as Fetcher;
      reportServerEvent(env, 'Email', 'Sent', 'Welcome', 'livediagram.app');
      const flushing = flushServerEvents({ ...env, TELEMETRY: hung });
      await vi.advanceTimersByTimeAsync(TELEMETRY_TIMEOUT_MS + 1);
      await expect(flushing).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes after a response only when something waits', async () => {
    const { sent, fetcher } = service();
    const later: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => void later.push(p) };
    flushServerEventsAfter({ ...env, TELEMETRY: fetcher }, ctx);
    expect(later).toHaveLength(0);
    reportServerEvent(env, 'Email', 'Sent', 'TeamInvite', 'livediagram.app');
    flushServerEventsAfter({ ...env, TELEMETRY: fetcher }, ctx);
    expect(later).toHaveLength(1);
    await Promise.all(later);
    expect(sent.map((s) => s.body.events)).toEqual([
      [{ category: 'Email', action: 'Sent', type: 'TeamInvite' }],
    ]);
  });

  it('holds a bounded number between flushes', () => {
    for (let i = 0; i < 5_000; i++)
      reportServerEvent(env, 'Email', 'Sent', 'Welcome', 'livediagram.app');
    expect(waitingServerEvents()).toHaveLength(1_000);
  });

  it('finds an app given as a lookup when the batch goes, and leaves out someone with none', async () => {
    const { sent, fetcher } = service();
    let looked = 0;
    const lookup = (app: 'liveplanner.app' | null) => async () => {
      looked++;
      return app;
    };
    reportServerEvent(env, 'Team', 'Created', null, lookup('liveplanner.app'));
    reportServerEvent(env, 'Team', 'Changed', 'Role', lookup(null));
    reportServerEvent(env, 'Token', 'Removed', null, async () => {
      throw new Error('db down');
    });
    // Nothing is looked up until the flush.
    expect(looked).toBe(0);
    await flushServerEvents({ ...env, TELEMETRY: fetcher });
    expect(looked).toBe(2);
    expect(sent.map((s) => [s.body.app, s.body.events])).toEqual([
      ['liveplanner.app', [{ category: 'Team', action: 'Created' }]],
    ]);
  });
});
