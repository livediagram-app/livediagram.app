// /api/documents/<id>/calls/*: proximity audio's mint route (docs/specs/012-collaboration/proximity-audio.md "The
// mint route"). The browser never holds the Realtime secret or the TURN key: every session, track, renegotiation and
// close is made here, after the grant on the Space, the calls gate, and the session's own token.
import {
  CALL_TRACK_NAME,
  levelAtLeast,
  parseCallTrackLocator,
  type CallSessionResponse,
  type CallTrackLocator,
  type CallsErrorCode,
} from '@livehuddle/api-schema';
import { callsGate } from '../calls/calls-gate';
import {
  openSessionToken,
  sealSessionToken,
  sealTrackToken,
  trackTokenHolds,
  type CallRole,
} from '../calls/call-tokens';
import {
  closeTracks,
  newSession,
  newTracks,
  RealtimeError,
  renegotiate,
  turnIceServers,
  type RealtimeEnv,
} from '../calls/realtime-api';
import { documentTrashed, json, notFound } from '../responses';
import type { RouteContext } from './context';
import { resolveDocumentGrant } from './document-grant';

/** The most speakers one subscribe asks for: a crowd arrives over a few steps, never in one request. */
export const MAX_SUBSCRIBE_BATCH = 16;
// The longest SDP the routes pass on (a browser's offer for one audio track is a few KiB).
const SDP_MAX = 64 * 1024;
const MID_MAX = 16;

const refuse = (status: number, error: CallsErrorCode, extra: Record<string, unknown> = {}) =>
  json({ error, ...extra }, { status });
const invalid = () => refuse(400, 'invalid_call_request');

const isSdp = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= SDP_MAX;
const isMid = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= MID_MAX;
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128;

async function bodyOf(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Calls the Realtime API, answering 502 when it fails. */
async function upstream<T>(
  work: () => Promise<T>,
  done: (value: T) => Response,
): Promise<Response> {
  try {
    return done(await work());
  } catch (error) {
    if (!(error instanceof RealtimeError)) throw error;
    console.warn('[calls] upstream', error.operation, error.status);
    return refuse(502, 'calls_upstream');
  }
}

// The session the body names, and the role its token was minted for; null when either is missing or forged.
async function provenSession(
  env: RealtimeEnv,
  documentId: string,
  body: Record<string, unknown>,
): Promise<{ sessionId: string; role: CallRole } | null> {
  if (!isId(body.sessionId)) return null;
  const role = await openSessionToken(
    env.REALTIME_APP_TOKEN,
    documentId,
    body.sessionId,
    body.sessionToken,
  );
  if (!role) {
    console.warn('[calls] token', 'session');
    return null;
  }
  return { sessionId: body.sessionId, role };
}

// Every locator well formed and signed for this Space, or null.
async function provenLocators(
  env: RealtimeEnv,
  documentId: string,
  raw: unknown,
): Promise<CallTrackLocator[] | null> {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SUBSCRIBE_BATCH) return null;
  const locators: CallTrackLocator[] = [];
  for (const entry of raw) {
    const locator = parseCallTrackLocator(entry);
    if (!locator) return null;
    if (
      !(await trackTokenHolds(env.REALTIME_APP_TOKEN, documentId, locator.sessionId, locator.token))
    ) {
      console.warn('[calls] token', 'track');
      return null;
    }
    locators.push(locator);
  }
  return locators;
}

async function mintSession(
  env: RealtimeEnv,
  documentId: string,
  canSpeak: boolean,
): Promise<Response> {
  return upstream(
    async () => {
      const [sessionId, iceServers] = await Promise.all([newSession(env), turnIceServers(env)]);
      const role: CallRole = canSpeak ? 's' : 'l';
      const answer: CallSessionResponse = {
        sessionId,
        sessionToken: await sealSessionToken(env.REALTIME_APP_TOKEN, documentId, sessionId, role),
        ...(canSpeak
          ? { trackToken: await sealTrackToken(env.REALTIME_APP_TOKEN, documentId, sessionId) }
          : {}),
        iceServers,
        canSpeak,
      };
      return answer;
    },
    (answer) => json(answer),
  );
}

async function tracks(
  env: RealtimeEnv,
  documentId: string,
  body: Record<string, unknown>,
  canSpeak: boolean,
): Promise<Response> {
  const session = await provenSession(env, documentId, body);
  if (!session) return invalid();
  const publish = body.publish as { sdp?: unknown; mid?: unknown } | undefined;
  if (publish !== undefined && body.subscribe === undefined) {
    // A listener's session stays one, even if its grant has since grown.
    if (!canSpeak || session.role !== 's') return refuse(403, 'calls_listen_only');
    if (
      typeof publish !== 'object' ||
      publish === null ||
      !isSdp(publish.sdp) ||
      !isMid(publish.mid)
    ) {
      return invalid();
    }
    const offer = { type: 'offer' as const, sdp: publish.sdp };
    const tracks = [{ location: 'local' as const, mid: publish.mid, trackName: CALL_TRACK_NAME }];
    return upstream(
      () => newTracks(env, session.sessionId, { sessionDescription: offer, tracks }),
      (answer) => json(answer),
    );
  }
  if (body.subscribe !== undefined && publish === undefined) {
    const locators = await provenLocators(env, documentId, body.subscribe);
    if (!locators) return invalid();
    const tracks = locators.map((l) => ({
      location: 'remote' as const,
      sessionId: l.sessionId,
      trackName: l.trackName,
    }));
    return upstream(
      () => newTracks(env, session.sessionId, { tracks }),
      (answer) => json(answer),
    );
  }
  return invalid();
}

/**
 * The calls routes, or null when the request is not one. The grant comes first (no Space, no answer), then the
 * gate, so nobody learns whether calls are on for a Space they cannot open.
 */
export async function handleCallRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (segments.length !== 5 || segments[1] !== 'documents' || segments[3] !== 'calls') return null;
  // Compared as `segments[4]`, never through an alias, so the route-parity probe sees every literal.
  const method = request.method;
  const known =
    (segments[4] === 'session' && method === 'POST') ||
    (segments[4] === 'tracks' && method === 'POST') ||
    (segments[4] === 'renegotiate' && method === 'PUT') ||
    (segments[4] === 'close' && method === 'PUT');
  if (!known) return notFound();
  const documentId = segments[2]!;
  const grant = await resolveDocumentGrant(ctx, documentId);
  if (grant instanceof Response) return grant;
  if (!grant) return notFound();
  if (grant.trashed) return documentTrashed();
  const gate = await callsGate(env);
  if (!gate.open) {
    console.warn('[calls] gate', gate.reason);
    return refuse(503, 'calls_off', { reason: gate.reason });
  }
  // The gate's open: the four secrets are set.
  const realtime = env as RealtimeEnv;
  // Speaking is taking part (docs/specs/012-collaboration/proximity-audio.md "Share roles"): an Editor's or a
  // Participant's, a guest's included; a Viewer listens.
  const canSpeak = levelAtLeast(grant.level, 'participate');
  if (segments[4] === 'session') return mintSession(realtime, documentId, canSpeak);
  const body = await bodyOf(request);
  if (!body) return invalid();
  if (segments[4] === 'tracks') return tracks(realtime, documentId, body, canSpeak);
  const session = await provenSession(realtime, documentId, body);
  if (!session) return invalid();
  if (segments[4] === 'renegotiate') {
    if (!isSdp(body.sdp)) return invalid();
    const sdp = body.sdp;
    return upstream(
      () => renegotiate(realtime, session.sessionId, sdp),
      () => json({ ok: true }),
    );
  }
  // close
  const mids = body.mids;
  if (
    !Array.isArray(mids) ||
    mids.length === 0 ||
    mids.length > MAX_SUBSCRIBE_BATCH ||
    !mids.every(isMid)
  ) {
    return invalid();
  }
  if (body.sdp !== undefined && !isSdp(body.sdp)) return invalid();
  const sdp = body.sdp;
  return upstream(
    () => closeTracks(realtime, session.sessionId, mids, sdp),
    (answer) => json(answer),
  );
}
