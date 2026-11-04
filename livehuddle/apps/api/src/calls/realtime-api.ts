// Cloudflare Realtime, as the calls mint route reaches it (docs/specs/012-collaboration/proximity-audio.md "The mint
// route"): the SFU's session and track operations and TURN's credential mint, each one HTTPS call with this Worker's
// secret. Only the fields the editor needs come back, so nothing else Realtime answers ever reaches a browser.
import type {
  CallIceServer,
  CallSessionDescription,
  CallTrackResult,
  CallTracksResponse,
} from '@livehuddle/api-schema';
import type { Env } from '../types';

export const REALTIME_BASE = 'https://rtc.live.cloudflare.com/v1';
// TURN credentials outlive any likely session; a browser that stays longer joins again.
export const TURN_TTL_S = 4 * 60 * 60;

export type RealtimeEnv = Required<
  Pick<Env, 'REALTIME_APP_ID' | 'REALTIME_APP_TOKEN' | 'TURN_KEY_ID' | 'TURN_KEY_API_TOKEN'>
>;

/** Realtime answered with an error, or not at all. */
export class RealtimeError extends Error {
  readonly operation: string;
  readonly status: number;
  constructor(operation: string, status: number) {
    super(`realtime ${operation} failed (${status})`);
    this.operation = operation;
    this.status = status;
  }
}

type Fetcher = typeof fetch;

async function call(
  fetcher: Fetcher,
  operation: string,
  url: string,
  token: string,
  method: 'POST' | 'PUT',
  body?: unknown,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetcher(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new RealtimeError(operation, 0);
  }
  if (!res.ok) throw new RealtimeError(operation, res.status);
  try {
    return await res.json();
  } catch {
    throw new RealtimeError(operation, res.status);
  }
}

const sfu = (env: RealtimeEnv, path: string) =>
  `${REALTIME_BASE}/apps/${encodeURIComponent(env.REALTIME_APP_ID)}/sessions/${path}`;

function sessionDescriptionOf(v: unknown): CallSessionDescription | undefined {
  const d = v as { type?: unknown; sdp?: unknown } | null | undefined;
  if (!d || (d.type !== 'offer' && d.type !== 'answer') || typeof d.sdp !== 'string')
    return undefined;
  return { type: d.type, sdp: d.sdp };
}

function trackResultOf(v: unknown): CallTrackResult {
  const t = (v ?? {}) as Record<string, unknown>;
  const out: CallTrackResult = {};
  for (const key of ['mid', 'trackName', 'sessionId', 'errorCode'] as const) {
    if (typeof t[key] === 'string') out[key] = t[key];
  }
  return out;
}

function tracksResponseOf(v: unknown): CallTracksResponse {
  const r = (v ?? {}) as {
    sessionDescription?: unknown;
    requiresImmediateRenegotiation?: unknown;
    tracks?: unknown;
  };
  const sessionDescription = sessionDescriptionOf(r.sessionDescription);
  return {
    ...(sessionDescription ? { sessionDescription } : {}),
    requiresImmediateRenegotiation: r.requiresImmediateRenegotiation === true,
    tracks: Array.isArray(r.tracks) ? r.tracks.map(trackResultOf) : [],
  };
}

/** A new SFU session, with no tracks yet. */
export async function newSession(env: RealtimeEnv, fetcher: Fetcher = fetch): Promise<string> {
  const r = (await call(fetcher, 'session', sfu(env, 'new'), env.REALTIME_APP_TOKEN, 'POST')) as {
    sessionId?: unknown;
  } | null;
  if (typeof r?.sessionId !== 'string' || r.sessionId.length === 0) {
    throw new RealtimeError('session', 200);
  }
  return r.sessionId;
}

/** `tracks/new`: publish local tracks with the browser's offer, or ask for remote ones. */
export async function newTracks(
  env: RealtimeEnv,
  sessionId: string,
  body:
    | {
        sessionDescription: CallSessionDescription;
        tracks: { location: 'local'; mid: string; trackName: string }[];
      }
    | { tracks: { location: 'remote'; sessionId: string; trackName: string }[] },
  fetcher: Fetcher = fetch,
): Promise<CallTracksResponse> {
  const url = sfu(env, `${encodeURIComponent(sessionId)}/tracks/new`);
  return tracksResponseOf(await call(fetcher, 'tracks', url, env.REALTIME_APP_TOKEN, 'POST', body));
}

/** `renegotiate`: the browser's answer to an offer the SFU made. */
export async function renegotiate(
  env: RealtimeEnv,
  sessionId: string,
  sdp: string,
  fetcher: Fetcher = fetch,
): Promise<void> {
  const url = sfu(env, `${encodeURIComponent(sessionId)}/renegotiate`);
  await call(fetcher, 'renegotiate', url, env.REALTIME_APP_TOKEN, 'PUT', {
    sessionDescription: { type: 'answer', sdp },
  });
}

/** `tracks/close`: with the browser's offer it negotiates; without one it forces the close. */
export async function closeTracks(
  env: RealtimeEnv,
  sessionId: string,
  mids: string[],
  sdp: string | undefined,
  fetcher: Fetcher = fetch,
): Promise<CallTracksResponse> {
  const url = sfu(env, `${encodeURIComponent(sessionId)}/tracks/close`);
  const body = {
    tracks: mids.map((mid) => ({ mid })),
    ...(sdp ? { sessionDescription: { type: 'offer', sdp }, force: false } : { force: true }),
  };
  return tracksResponseOf(await call(fetcher, 'close', url, env.REALTIME_APP_TOKEN, 'PUT', body));
}

function iceServerOf(v: unknown): CallIceServer | null {
  const s = v as { urls?: unknown; username?: unknown; credential?: unknown } | null;
  if (!s) return null;
  const urls = Array.isArray(s.urls)
    ? s.urls.filter((u): u is string => typeof u === 'string' && !u.includes(':53?'))
    : typeof s.urls === 'string'
      ? s.urls
      : null;
  if (urls === null || urls.length === 0) return null;
  return {
    urls,
    ...(typeof s.username === 'string' ? { username: s.username } : {}),
    ...(typeof s.credential === 'string' ? { credential: s.credential } : {}),
  };
}

/** Short-lived TURN credentials, as ICE servers. Port 53, which browsers block, is left out. */
export async function turnIceServers(
  env: RealtimeEnv,
  fetcher: Fetcher = fetch,
): Promise<CallIceServer[]> {
  const url = `${REALTIME_BASE}/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`;
  const r = (await call(fetcher, 'turn', url, env.TURN_KEY_API_TOKEN, 'POST', {
    ttl: TURN_TTL_S,
  })) as {
    iceServers?: unknown;
  } | null;
  const servers = Array.isArray(r?.iceServers) ? r.iceServers.map(iceServerOf) : [];
  return servers.filter((s): s is CallIceServer => s !== null);
}
