// Proximity audio's wire (docs/specs/012-collaboration/proximity-audio.md "The wire" and "The mint route"): the two
// presence ops a call adds to the room, their field-by-field parsers (shared by the room's gate and the editor), and
// the calls mint routes' bodies. Never audio: a level and a locator are all that ride the room.

/** How loudly a speaker is talking: 0 is stopped, 1 to 4 the quantised level. */
export type VoiceLevel = 0 | 1 | 2 | 3 | 4;
export const VOICE_LEVEL_MAX = 4;

/** The one track a browser publishes: its microphone. */
export const CALL_TRACK_NAME = 'mic';
/** The longest a locator field may be (a Realtime session id is 32 hex; a token 43 base64url). */
export const CALL_LOCATOR_MAX = 128;
// The room's other id bound (MAX_TAB_ID_LEN).
const TAB_ID_MAX = 64;

/** Where a listener asks the mint route for a speaker's microphone. */
export type CallTrackLocator = { sessionId: string; trackName: string; token: string };

export type AvatarVoiceOp = { kind: 'avatar-voice'; tabId: string; level: VoiceLevel };
export type CallTrackOp = { kind: 'call-track'; tabId: string; track: CallTrackLocator | null };

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

/** A locator, or null for anything malformed or naming a track other than the microphone. */
export function parseCallTrackLocator(v: unknown): CallTrackLocator | null {
  const t = v as Partial<Record<keyof CallTrackLocator, unknown>> | null;
  if (typeof t !== 'object' || t === null) return null;
  if (!isField(t.sessionId) || t.trackName !== CALL_TRACK_NAME || !isField(t.token)) return null;
  return { sessionId: t.sessionId, trackName: t.trackName, token: t.token };
}

/** A `call-track` op as sent, or null. */
export function parseCallTrack(op: unknown): CallTrackOp | null {
  const o = op as { kind?: unknown; tabId?: unknown; track?: unknown } | null;
  if (!o || o.kind !== 'call-track' || !isTabId(o.tabId)) return null;
  if (o.track === null) return { kind: 'call-track', tabId: o.tabId, track: null };
  const track = parseCallTrackLocator(o.track);
  return track ? { kind: 'call-track', tabId: o.tabId, track } : null;
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
};

export type CallSessionDescription = { type: 'offer' | 'answer'; sdp: string };

type CallSessionProof = { sessionId: string; sessionToken: string };

/** POST /api/documents/:id/calls/tracks: publish the microphone, or subscribe to speakers'. */
export type CallTracksRequest = CallSessionProof &
  (
    | { publish: { sdp: string; mid: string }; subscribe?: undefined }
    | { subscribe: CallTrackLocator[]; publish?: undefined }
  );

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
  'calls_off' | 'calls_listen_only' | 'invalid_call_request' | 'calls_upstream';
export type CallsOffReason = 'production' | 'unconfigured';
