// Closing a call session at Cloudflare Realtime without its browser's say (docs/specs/012-collaboration/
// call-minutes.md "A client that goes silent"): what the room does to a session that no longer counts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionMids, severSession } from './realtime-api';

const env = {
  REALTIME_APP_ID: 'app',
  REALTIME_APP_TOKEN: 'secret',
  TURN_KEY_ID: 'turn',
  TURN_KEY_API_TOKEN: 'turn-secret',
};
type Sent = { url: string; method: string; body: unknown };

function realtime(state: unknown, status = 200) {
  const sent: Sent[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    sent.push({
      url,
      method: String(init.method),
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    if (init.method === 'GET') {
      return status === 200 ? Response.json(state) : new Response('gone', { status });
    }
    return Response.json({ tracks: [] });
  }) as unknown as typeof fetch;
  return { sent, fetcher };
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('closing a session at Realtime', () => {
  it('reads the mids the session holds, each once, and nothing malformed', async () => {
    const { fetcher, sent } = realtime({
      tracks: [{ mid: '0' }, { mid: '1' }, { mid: '0' }, { mid: '' }, { mid: 3 }, null],
    });
    expect(await sessionMids(env, 's 1', fetcher)).toEqual(['0', '1']);
    expect(sent).toEqual([
      {
        url: 'https://rtc.live.cloudflare.com/v1/apps/app/sessions/s%201',
        method: 'GET',
        body: undefined,
      },
    ]);
    expect(await sessionMids(env, 's', realtime(null).fetcher)).toEqual([]);
    expect(await sessionMids(env, 's', realtime({ tracks: 'no' }).fetcher)).toEqual([]);
  });

  it('forces every track closed, published and received', async () => {
    const { fetcher, sent } = realtime({ tracks: [{ mid: '0' }, { mid: '4' }] });
    await severSession(env, 'sess', fetcher);
    expect(sent[1]).toEqual({
      url: 'https://rtc.live.cloudflare.com/v1/apps/app/sessions/sess/tracks/close',
      method: 'PUT',
      body: { tracks: [{ mid: '0' }, { mid: '4' }], force: true },
    });
    expect(console.info).toHaveBeenCalledWith('[calls] severed', 2);
  });

  it('closes a crowded session in batches', async () => {
    const tracks = Array.from({ length: 70 }, (_, i) => ({ mid: String(i) }));
    const { fetcher, sent } = realtime({ tracks });
    await severSession(env, 'sess', fetcher);
    expect(
      sent
        .filter((s) => s.method === 'PUT')
        .map((s) => (s.body as { tracks: unknown[] }).tracks.length),
    ).toEqual([64, 6]);
  });

  it('asks for nothing more of a session with no tracks, or one already gone', async () => {
    const empty = realtime({ tracks: [] });
    await severSession(env, 'sess', empty.fetcher);
    expect(empty.sent).toHaveLength(1);
    for (const status of [404, 410]) {
      const gone = realtime(null, status);
      await severSession(env, 'sess', gone.fetcher);
      expect(gone.sent).toHaveLength(1);
    }
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('never throws: a failure is logged with its status', async () => {
    await severSession(env, 'sess', realtime(null, 500).fetcher);
    expect(console.warn).toHaveBeenCalledWith('[calls] sever failed', 500);
    const offline: typeof fetch = async () => {
      throw new TypeError('network');
    };
    await severSession(env, 'sess', offline);
    expect(console.warn).toHaveBeenCalledWith('[calls] sever failed', 0);
  });
});
