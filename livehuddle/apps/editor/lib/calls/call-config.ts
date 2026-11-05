// A proximity call's settings and shapes (docs/specs/012-collaboration/proximity-audio.md, video-and-screen-bubbles.md,
// meeting-rooms-and-stage.md): the timings, the media each track asks the browser for, what a call sends over the
// room and the scene the canvas hands it. Shared by the call (proximity-call.ts) and its parts.
import {
  CALL_SCREEN_TRACK_NAME,
  CALL_VIDEO_TRACK_NAME,
  type CallTrackLocator,
  type VoiceLevel,
} from '@livehuddle/api-schema';
import type { CallsCaller } from '@/lib/api/calls';
import type { ViewRect } from './bubbles';
import type { CallMedia } from './calls-store';
import type { Point } from './hearing';
import type { LocalPreview } from './local-preview';
import type { HandSignal } from './raised-hand';
import type { CallStage } from './stage';
import { VOICE_REFRESH_MS, VOICE_SAMPLE_MS } from './voice-detector';
import type { CallZone } from './zones';

/** Alone on a tab this long, the microphone closes. */
export const MIC_IDLE_CLOSE_MS = 15_000;
/** A speaker's locator goes out again for a new walker at most this often. */
export const LOCATOR_RESEND_MS = 1000;
/** The call proves its session to the room again, on a `not_heard`, at most this often (sfu-session.ts retries). */
export const REPROVE_MS = 2000;
/**
 * A publishing call that has sent the room nothing this long asks it to read the kill switch (#463): just past a
 * talking speaker's level refresh, so a speaker who is talking never sends one.
 */
export const CALLS_CHECK_MS = VOICE_REFRESH_MS + 2 * VOICE_SAMPLE_MS;

// The camera's and screen's capture and encodings live in a light module of their own, which the local preview
// (local-preview.ts) shares without pulling in the call.
export {
  CAMERA_CONSTRAINTS,
  CAMERA_ENCODINGS,
  SCREEN_CONSTRAINTS,
  SCREEN_ENCODINGS,
  SCREEN_MAX_BITRATE,
  SCREEN_MAX_FPS,
} from './media-constraints';

export const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: false,
};

/** Which bubble a received track fills; the microphone's is none (it goes to the audio graph). */
export const MEDIA_OF: Readonly<Record<string, CallMedia | undefined>> = {
  [CALL_VIDEO_TRACK_NAME]: 'video',
  [CALL_SCREEN_TRACK_NAME]: 'screen',
};

/** What a call sends over the room: the editor adds the tab. */
export type CallSignal =
  | { kind: 'avatar-voice'; level: VoiceLevel }
  | { kind: 'calls-check' }
  | {
      kind: 'call-track';
      track: CallTrackLocator | null;
      video?: CallTrackLocator | null;
      screen?: CallTrackLocator | null;
    }
  | HandSignal
  | { kind: 'avatar-let-speak'; targetId: string; on: boolean }
  // Proves this browser's Realtime session to the room, which then answers the mint route for it (#483).
  | { kind: 'call-session'; sessionId: string; sessionToken: string }
  // An Editor stopping someone else's screen share (#469).
  | { kind: 'call-stop-share'; targetId: string }
  // A knock on a room, and the answer to one (docs/specs/012-collaboration/knock.md "The wire").
  | { kind: 'avatar-knock'; roomId: string }
  | { kind: 'avatar-knock-answer'; targetId: string; roomId: string; answer: 'in' | 'later' };

/**
 * Where everyone stands, as the canvas sees it: your feet, every other walker's on your tab, the visible area, the
 * tab's visible Office rooms, each one call (meeting-rooms-and-stage.md "Rooms are calls"), and its visible stages
 * (the same spec's "The stage").
 */
export type CallScene = {
  tabId: string;
  self: Point | null;
  walkers: ReadonlyMap<string, Point>;
  view?: ViewRect | null;
  zones?: readonly CallZone[];
  stages?: readonly CallStage[];
};

export type ProximityCallInput = {
  caller: CallsCaller;
  canSpeak: boolean;
  // An Editor: may share a screen.
  canShare?: boolean;
  // Made in the Join press, so the browser lets it play.
  context: AudioContext;
  send: (signal: CallSignal) => void;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  getDisplayMedia?: (options: DisplayMediaStreamOptions) => Promise<MediaStream>;
  // Whether the page is visible; a hidden tab receives no bubbles. Defaults to the document's.
  pageVisible?: () => boolean;
  // The canvas's local preview (video-and-screen-bubbles.md "Local preview"): a live call sends what it may of it.
  preview?: Pick<LocalPreview, 'stream' | 'take' | 'stop' | 'subscribe'>;
};

/** The browser's getUserMedia, unless the input brings its own. */
export function userMediaOf(input: ProximityCallInput) {
  return (
    input.getUserMedia ?? ((c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c))
  );
}
