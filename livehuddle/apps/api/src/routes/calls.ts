// /api/documents/<id>/calls/*: proximity audio's mint route (docs/specs/012-collaboration/proximity-audio.md "The
// mint route"), with the camera and a shared screen beside the microphone (docs/specs/012-collaboration/
// video-and-screen-bubbles.md "The mint route"). The browser never holds the Realtime secret or the TURN key: every session, track, renegotiation and
// close is made here, after the grant on the Space, the calls gate, and the session's own token. The calls kill switch
// (docs/specs/016-platform/calls-kill-switch.md "The mint route") checks every session and track against its mode.
import {
  CALL_SCREEN_TRACK_NAME,
  CALL_TRACK_NAME,
  CALL_VIDEO_TRACK_NAME,
  isCallLayer,
  isCallTrackName,
  levelAtLeast,
  parseCallTrackLocator,
  type AccessLevel,
  type CallLayer,
  type CallSessionResponse,
  type CallSubscribeLocator,
  type CallsErrorCode,
} from '@livehuddle/api-schema';
import { callsGate } from '../calls/calls-gate';
import { callsModeAllows, callTrackKind, type CallsMode } from '../calls/calls-mode';
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
  simulcastFor,
  turnIceServers,
  updateTracks,
  type RealtimeEnv,
  type RealtimeRemoteTrack,
} from '../calls/realtime-api';
import type { HearingAnswer, HearingAsk } from '../calls/room-calls';
import { splitByHearing, withRefusals } from '../calls/subscribe-hearing';
import { documentRoom } from '../document-client';
import { documentTrashed, forbidden, json, notFound } from '../responses';
import { isCommunityCode } from './community-link';
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

/**
 * The refusal for a track the switch's mode does not allow (a video or screen track while calls are audio only), or
 * null when every one is allowed. `off` never reaches here: the gate pauses the whole route first. A name no call
 * publishes is refused too, though the locator parser and the publish path only ever name the microphone.
 */
export function mediaRefused(
  mode: Exclude<CallsMode, 'off'>,
  trackNames: readonly string[],
): Response | null {
  for (const name of trackNames) {
    const kind = callTrackKind(name);
    if (kind && callsModeAllows(mode, kind)) continue;
    console.warn('[calls] mode', mode, name);
    return refuse(503, 'calls_off', { reason: 'audio-only' });
  }
  return null;
}

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

/**
 * Calls the Realtime API, answering 410 `calls_session_gone` when Realtime says the session is gone (it expired before
 * anyone connected to it: the browser renews it, proximity-audio.md "A session that expires") and 502 for any other
 * failure.
 */
async function upstream<T>(
  work: () => Promise<T>,
  done: (value: T) => Response,
): Promise<Response> {
  try {
    return done(await work());
  } catch (error) {
    if (!(error instanceof RealtimeError)) throw error;
    console.warn('[calls] upstream', error.operation, error.status);
    if (error.status === 410) return refuse(410, 'calls_session_gone');
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

// Every locator well formed, or null; and which of them are not signed for this Space. A camera's carries the layer
// asked for (the small one when absent); any other track's may not ask for one. A locator whose token fails is
// answered on its own (`track_refused`) rather than failing the batch: a peer's forged `call-track` would otherwise
// silence everyone asked for beside it, and the browser would ask again on every step.
async function provenLocators(
  env: RealtimeEnv,
  documentId: string,
  raw: unknown,
): Promise<{ locators: CallSubscribeLocator[]; forged: Set<number> } | null> {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SUBSCRIBE_BATCH) return null;
  const locators: CallSubscribeLocator[] = [];
  const forged = new Set<number>();
  for (const entry of raw) {
    const locator = parseCallTrackLocator(entry);
    if (!locator) return null;
    const layer = (entry as { layer?: unknown }).layer;
    if (
      layer !== undefined &&
      (locator.trackName !== CALL_VIDEO_TRACK_NAME || !isCallLayer(layer))
    ) {
      return null;
    }
    if (
      !(await trackTokenHolds(env.REALTIME_APP_TOKEN, documentId, locator.sessionId, locator.token))
    ) {
      console.warn('[calls] token', 'track');
      forged.add(locators.length);
    }
    locators.push(layer === undefined ? locator : { ...locator, layer });
  }
  return { locators, forged };
}

// What Realtime is asked for one subscription: a camera's with its simulcast layer.
function remoteTrack(locator: CallSubscribeLocator): RealtimeRemoteTrack {
  const track: RealtimeRemoteTrack = {
    location: 'remote',
    sessionId: locator.sessionId,
    trackName: locator.trackName,
  };
  if (locator.trackName === CALL_VIDEO_TRACK_NAME)
    track.simulcast = simulcastFor(locator.layer ?? 'h');
  return track;
}

/**
 * Who may publish a track (video-and-screen-bubbles.md "Share roles"): the microphone and the camera are taking part,
 * an Editor's or a Participant's; a shared screen is an Editor's alone.
 */
export function publishRefused(
  trackName: string,
  level: AccessLevel,
  role: CallRole,
): Response | null {
  if (!levelAtLeast(level, 'participate') || role !== 's') return refuse(403, 'calls_listen_only');
  if (trackName === CALL_SCREEN_TRACK_NAME && !levelAtLeast(level, 'edit')) {
    return refuse(403, 'calls_editor_only');
  }
  return null;
}

async function mintSession(
  env: RealtimeEnv,
  documentId: string,
  canSpeak: boolean,
  mode: Exclude<CallsMode, 'off'>,
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
        mode,
      };
      return answer;
    },
    (answer) => json(answer),
  );
}

/** Asks the Space's room which tracks a call session may hear (calls/room-calls.ts). */
type Hearing = (subscriberSession: string, asks: HearingAsk[]) => Promise<HearingAnswer[]>;

async function tracks(
  env: RealtimeEnv,
  documentId: string,
  body: Record<string, unknown>,
  level: AccessLevel,
  mode: Exclude<CallsMode, 'off'>,
  hearing: Hearing,
): Promise<Response> {
  const session = await provenSession(env, documentId, body);
  if (!session) return invalid();
  const publish = body.publish as { sdp?: unknown; mid?: unknown; trackName?: unknown } | undefined;
  if (publish !== undefined && body.subscribe === undefined) {
    if (
      typeof publish !== 'object' ||
      publish === null ||
      !isSdp(publish.sdp) ||
      !isMid(publish.mid) ||
      (publish.trackName !== undefined && !isCallTrackName(publish.trackName))
    ) {
      return invalid();
    }
    const trackName = publish.trackName ?? CALL_TRACK_NAME;
    // A listener's session stays one, even if its grant has since grown.
    const refused = publishRefused(trackName, level, session.role);
    if (refused) return refused;
    const paused = mediaRefused(mode, [trackName]);
    if (paused) return paused;
    const offer = { type: 'offer' as const, sdp: publish.sdp };
    const tracks = [{ location: 'local' as const, mid: publish.mid, trackName }];
    return upstream(
      () => newTracks(env, session.sessionId, { sessionDescription: offer, tracks }),
      (answer) => json(answer),
    );
  }
  if (body.subscribe !== undefined && publish === undefined) {
    const proven = await provenLocators(env, documentId, body.subscribe);
    if (!proven) return invalid();
    const { locators, forged } = proven;
    const paused = mediaRefused(
      mode,
      locators.map((l) => l.trackName),
    );
    if (paused) return paused;
    // The room says which of them this session may hear now (#483); the rest are answered `not_heard`.
    const { refused } = await splitByHearing(locators, (asks) => hearing(session.sessionId, asks));
    const allowed = locators.filter((_, i) => !refused.has(i) && !forged.has(i));
    if (allowed.length === 0) return json(withRefusals(locators, refused, null, forged));
    const tracks = allowed.map(remoteTrack);
    return upstream(
      () => newTracks(env, session.sessionId, { tracks }),
      (answer) => json(withRefusals(locators, refused, answer, forged)),
    );
  }
  return invalid();
}

// `layer`: switch this session's camera subscriptions between the small and the large layer (a maximise or a
// restore), with Realtime's `tracks/update`. Camera tracks only: nothing else is published in layers.
async function layer(
  env: RealtimeEnv,
  documentId: string,
  body: Record<string, unknown>,
  mode: Exclude<CallsMode, 'off'>,
): Promise<Response> {
  const session = await provenSession(env, documentId, body);
  if (!session) return invalid();
  const raw = body.tracks;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SUBSCRIBE_BATCH) return invalid();
  const tracks: (RealtimeRemoteTrack & { mid: string })[] = [];
  for (const entry of raw as unknown[]) {
    const t = entry as {
      mid?: unknown;
      sessionId?: unknown;
      trackName?: unknown;
      layer?: unknown;
    } | null;
    if (
      !t ||
      !isMid(t.mid) ||
      !isId(t.sessionId) ||
      t.trackName !== CALL_VIDEO_TRACK_NAME ||
      !isCallLayer(t.layer)
    ) {
      return invalid();
    }
    const chosen: CallLayer = t.layer;
    tracks.push({
      location: 'remote',
      mid: t.mid,
      sessionId: t.sessionId,
      trackName: t.trackName,
      simulcast: simulcastFor(chosen),
    });
  }
  const paused = mediaRefused(mode, [CALL_VIDEO_TRACK_NAME]);
  if (paused) return paused;
  return upstream(
    () => updateTracks(env, session.sessionId, tracks),
    (answer) => json(answer),
  );
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
    (segments[4] === 'layer' && method === 'PUT') ||
    (segments[4] === 'close' && method === 'PUT');
  if (!known) return notFound();
  const documentId = segments[2]!;
  const grant = await resolveDocumentGrant(ctx, documentId);
  if (grant instanceof Response) return grant;
  if (!grant) return notFound();
  if (grant.trashed) return documentTrashed();
  // A Community post's link is a content-only pass (docs/specs/025-community/community.md): its visitors never join
  // the room, so they never call in it, and learn nothing of whether calls are on.
  if (await isCommunityCode(env, documentId, grant.shareCode)) return forbidden('community_link');
  const gate = await callsGate(env);
  // Closing never costs, so a browser may still close its tracks while the kill switch alone pauses calls.
  const closingWhilePaused = !gate.open && gate.reason === 'paused' && segments[4] === 'close';
  if (!gate.open && !closingWhilePaused) {
    console.warn('[calls] gate', gate.reason);
    return refuse(503, 'calls_off', { reason: gate.reason });
  }
  // Past the production flag and the secrets: the four secrets are set.
  const realtime = env as RealtimeEnv;
  // Speaking is taking part (docs/specs/012-collaboration/proximity-audio.md "Share roles"): an Editor's or a
  // Participant's, a guest's included; a Viewer listens.
  const canSpeak = levelAtLeast(grant.level, 'participate');
  if (gate.open && segments[4] === 'session') {
    return mintSession(realtime, documentId, canSpeak, gate.mode);
  }
  const body = await bodyOf(request);
  if (!body) return invalid();
  if (gate.open && segments[4] === 'tracks') {
    return tracks(realtime, documentId, body, grant.level, gate.mode, (subscriber, asks) =>
      documentRoom(env, documentId).callsHearing(subscriber, asks),
    );
  }
  if (gate.open && segments[4] === 'layer') return layer(realtime, documentId, body, gate.mode);
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
