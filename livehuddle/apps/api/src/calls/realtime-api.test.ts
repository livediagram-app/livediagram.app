import { describe, expect, it } from 'vitest';
import {
  closeTracks,
  newTracks,
  RealtimeError,
  simulcastFor,
  turnIceServers,
  updateTracks,
} from './realtime-api';

// What the calls mint route keeps of Realtime's answers (docs/specs/012-collaboration/proximity-audio.md "The mint
// route"): the known fields only, and nothing malformed.
const env = {
  REALTIME_APP_ID: 'app',
  REALTIME_APP_TOKEN: 'secret',
  TURN_KEY_ID: 'turn',
  TURN_KEY_API_TOKEN: 'turn-secret',
};
const answering = (body: unknown) => async () => Response.json(body);

describe('the Realtime answers the route keeps', () => {
  it('reads an empty or malformed tracks answer as no description and no tracks', async () => {
    for (const body of [
      null,
      {},
      { sessionDescription: { type: 'pranswer', sdp: 'x' }, tracks: 'no' },
    ]) {
      expect(await newTracks(env, 's', { tracks: [] }, answering(body))).toEqual({
        requiresImmediateRenegotiation: false,
        tracks: [],
      });
    }
    expect(
      await closeTracks(
        env,
        's',
        ['1'],
        undefined,
        answering({ sessionDescription: { type: 'answer' } }),
      ),
    ).toEqual({ requiresImmediateRenegotiation: false, tracks: [] });
    expect(
      (await newTracks(env, 's', { tracks: [] }, answering({ tracks: [null] }))).tracks,
    ).toEqual([{}]);
  });

  it('keeps ICE servers with a string url and no credential, and drops the rest', async () => {
    expect(
      await turnIceServers(env, answering({ iceServers: [{ urls: 'stun:a' }, { urls: 7 }] })),
    ).toEqual([{ urls: 'stun:a' }]);
    expect(await turnIceServers(env, answering(null))).toEqual([]);
    expect(await turnIceServers(env, answering({ iceServers: 'none' }))).toEqual([]);
  });

  it('names the operation and status that failed', () => {
    const error = new RealtimeError('turn', 401);
    expect(error.message).toBe('realtime turn failed (401)');
  });

  it('picks a layer: the large falls back to the small, the small never steps up', () => {
    expect(simulcastFor('f')).toEqual({
      preferredRid: 'f',
      priorityOrdering: 'asciibetical',
      ridNotAvailable: 'asciibetical',
    });
    expect(simulcastFor('h')).toEqual({
      preferredRid: 'h',
      priorityOrdering: 'none',
      ridNotAvailable: 'none',
    });
  });

  it('updates remote tracks with tracks/update, as the simulcast docs shape it', async () => {
    const seen: { url: string; method?: string; body: unknown }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      seen.push({ url, method: init.method, body: JSON.parse(init.body as string) });
      return Response.json({ requiresImmediateRenegotiation: false, tracks: [{ mid: '3' }] });
    }) as typeof fetch;
    const track = {
      location: 'remote' as const,
      mid: '3',
      sessionId: 'pub',
      trackName: 'cam',
      simulcast: simulcastFor('f'),
    };
    expect(await updateTracks(env, 's 1', [track], fetcher)).toEqual({
      requiresImmediateRenegotiation: false,
      tracks: [{ mid: '3' }],
    });
    expect(seen).toEqual([
      {
        url: 'https://rtc.live.cloudflare.com/v1/apps/app/sessions/s%201/tracks/update',
        method: 'PUT',
        body: { tracks: [track] },
      },
    ]);
  });
});
