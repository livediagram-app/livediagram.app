// Proximity audio's wire (docs/specs/012-collaboration/proximity-audio.md "The wire" and "The mint route"): the two
// presence ops a call adds to the room, their field-by-field parsers (shared by the room's gate and the editor), and
// the calls mint routes' bodies. Never audio: a level and a locator are all that ride the room.

/** How loudly a speaker is talking: 0 is stopped, 1 to 4 the quantised level. */
export type VoiceLevel = 0 | 1 | 2 | 3 | 4;
export const VOICE_LEVEL_MAX = 4;

/** The microphone's track name: the one every speaker publishes. */
export const CALL_TRACK_NAME = 'mic';
/** The camera's (docs/specs/012-collaboration/video-and-screen-bubbles.md "The camera"). */
export const CALL_VIDEO_TRACK_NAME = 'cam';
/** A shared screen's (docs/specs/012-collaboration/video-and-screen-bubbles.md "The screen share"). */
export const CALL_SCREEN_TRACK_NAME = 'screen';
export type CallTrackName =
  typeof CALL_TRACK_NAME | typeof CALL_VIDEO_TRACK_NAME | typeof CALL_SCREEN_TRACK_NAME;
export const CALL_TRACK_NAMES: readonly CallTrackName[] = [
  CALL_TRACK_NAME,
  CALL_VIDEO_TRACK_NAME,
  CALL_SCREEN_TRACK_NAME,
];
export const isCallTrackName = (v: unknown): v is CallTrackName =>
  (CALL_TRACK_NAMES as readonly unknown[]).includes(v);

/** The camera's two simulcast encodings: `h` the small layer every bubble takes, `f` the large one a maximise asks. */
export type CallLayer = 'h' | 'f';
export const isCallLayer = (v: unknown): v is CallLayer => v === 'h' || v === 'f';
/** The longest a locator field may be (a Realtime session id is 32 hex; a token 43 base64url). */
export const CALL_LOCATOR_MAX = 128;
// The room's other id bound (MAX_TAB_ID_LEN).
const TAB_ID_MAX = 64;

/** Where a listener asks the mint route for a speaker's microphone. */
export type CallTrackLocator = { sessionId: string; trackName: string; token: string };

export type AvatarVoiceOp = { kind: 'avatar-voice'; tabId: string; level: VoiceLevel };
/**
 * Where a speaker's media is: `track` the microphone, `video` the camera and `screen` a shared screen, each null while
 * off. `video` and `screen` are absent from an op that predates them, which reads as off.
 */
export type CallTrackOp = {
  kind: 'call-track';
  tabId: string;
  track: CallTrackLocator | null;
  video?: CallTrackLocator | null;
  screen?: CallTrackLocator | null;
};

const isTabId = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= TAB_ID_MAX;
const isField = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= CALL_LOCATOR_MAX;

/** A level, or null for anything that is not an integer 0 to 4. */
export function parseVoiceLevel(v: unknown): VoiceLevel | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= VOICE_LEVEL_MAX
    ? (v as VoiceLevel)
    : null;
}

/** An `avatar-voice` op as sent, or null. */
export function parseAvatarVoice(op: unknown): AvatarVoiceOp | null {
  const o = op as { kind?: unknown; tabId?: unknown; level?: unknown } | null;
  if (!o || o.kind !== 'avatar-voice' || !isTabId(o.tabId)) return null;
  const level = parseVoiceLevel(o.level);
  return level === null ? null : { kind: 'avatar-voice', tabId: o.tabId, level };
}

/**
 * A locator, or null for anything malformed. `name` holds it to one track (the slot it came in); absent, any track a
 * call publishes.
 */
export function parseCallTrackLocator(v: unknown, name?: CallTrackName): CallTrackLocator | null {
  const t = v as Partial<Record<keyof CallTrackLocator, unknown>> | null;
  if (typeof t !== 'object' || t === null) return null;
  const named = name === undefined ? isCallTrackName(t.trackName) : t.trackName === name;
  if (!isField(t.sessionId) || !named || !isField(t.token)) return null;
  return { sessionId: t.sessionId, trackName: t.trackName as string, token: t.token };
}

// One slot of a `call-track` op: a locator for its own track, null for off, undefined for a malformed one.
function slotOf(v: unknown, name: CallTrackName): CallTrackLocator | null | undefined {
  if (v === null) return null;
  return parseCallTrackLocator(v, name) ?? undefined;
}

/** A `call-track` op as sent, or null. Each slot's locator must name its own track. */
export function parseCallTrack(op: unknown): CallTrackOp | null {
  const o = op as {
    kind?: unknown;
    tabId?: unknown;
    track?: unknown;
    video?: unknown;
    screen?: unknown;
  } | null;
  if (!o || o.kind !== 'call-track' || !isTabId(o.tabId)) return null;
  const track = slotOf(o.track, CALL_TRACK_NAME);
  if (track === undefined) return null;
  const parsed: CallTrackOp = { kind: 'call-track', tabId: o.tabId, track };
  if (o.video !== undefined) {
    const video = slotOf(o.video, CALL_VIDEO_TRACK_NAME);
    if (video === undefined) return null;
    parsed.video = video;
  }
  if (o.screen !== undefined) {
    const screen = slotOf(o.screen, CALL_SCREEN_TRACK_NAME);
    if (screen === undefined) return null;
    parsed.screen = screen;
  }
  return parsed;
}

// --- The mint routes (apps/api/src/routes/calls.ts) ---------------------------------------------------------------

/** An ICE server as RTCPeerConnection takes it. */
export type CallIceServer = { urls: string | string[]; username?: string; credential?: string };

/** POST /api/documents/:id/calls/session */
export type CallSessionResponse = {
  sessionId: string;
  // Private: proves the session is this caller's on every later route. Never shared.
  sessionToken: string;
  // Public: a speaker's locator token, shared in its `call-track` op. Absent for a listener.
  trackToken?: string;
  iceServers: CallIceServer[];
  canSpeak: boolean;
  // The calls kill switch's mode as the session was minted (never `off`: that refuses the session).
  mode: 'on' | 'audio-only';
};

export type CallSessionDescription = { type: 'offer' | 'answer'; sdp: string };

type CallSessionProof = { sessionId: string; sessionToken: string };

/** A subscription asked for: a locator, and for a camera the layer to receive (the small one when absent). */
export type CallSubscribeLocator = CallTrackLocator & { layer?: CallLayer };

/**
 * POST /api/documents/:id/calls/tracks: publish one of this browser's tracks (the microphone when `trackName` is
 * absent), or subscribe to other people's.
 */
export type CallTracksRequest = CallSessionProof &
  (
    | { publish: { sdp: string; mid: string; trackName?: CallTrackName }; subscribe?: undefined }
    | { subscribe: CallSubscribeLocator[]; publish?: undefined }
  );

/** PUT /api/documents/:id/calls/layer: switch camera subscriptions between the small and the large layer. */
export type CallLayerRequest = CallSessionProof & {
  tracks: { mid: string; sessionId: string; trackName: string; layer: CallLayer }[];
};

/** One track's result, as Realtime answers it (an error per track, never for the whole batch). */
export type CallTrackResult = {
  mid?: string;
  trackName?: string;
  sessionId?: string;
  errorCode?: string;
};

export type CallTracksResponse = {
  sessionDescription?: CallSessionDescription;
  requiresImmediateRenegotiation: boolean;
  tracks: CallTrackResult[];
};

/** PUT /api/documents/:id/calls/renegotiate */
export type CallRenegotiateRequest = CallSessionProof & { sdp: string };

/** PUT /api/documents/:id/calls/close: with an offer it negotiates; without one it forces the close. */
export type CallCloseRequest = CallSessionProof & { mids: string[]; sdp?: string };

/** Why the calls routes refuse: off (and why), a listener publishing, a malformed request, Realtime failing. */
export type CallsErrorCode =
  | 'calls_off'
  | 'calls_listen_only'
  | 'calls_editor_only'
  | 'invalid_call_request'
  | 'calls_upstream';
// `paused` and `audio-only` are the calls kill switch's (docs/specs/016-platform/calls-kill-switch.md "The mint
// route"): everything is paused, or this track's media is while calls are audio only.
export type CallsOffReason = 'production' | 'unconfigured' | 'paused' | 'audio-only';
