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
import type { HandSignal } from './raised-hand';
import type { CallStage } from './stage';
import { VOICE_REFRESH_MS, VOICE_SAMPLE_MS } from './voice-detector';
import type { CallZone } from './zones';

/** Alone on a tab this long, the microphone closes. */
export const MIC_IDLE_CLOSE_MS = 15_000;
/** A speaker's locator goes out again for a new walker at most this often. */
export const LOCATOR_RESEND_MS = 1000;
/**
 * A publishing call that has sent the room nothing this long asks it to read the kill switch (#463): just past a
 * talking speaker's level refresh, so a speaker who is talking never sends one.
 */
export const CALLS_CHECK_MS = VOICE_REFRESH_MS + 2 * VOICE_SAMPLE_MS;

/** The camera's source: the large layer's size (video-and-screen-bubbles.md "Two layers"). */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } },
};
/** Two simulcast layers, large first (Realtime ranks RIDs a to z): `f` 720p at 1.5 Mbps, `h` half size at 300 kbps. */
export const CAMERA_ENCODINGS: RTCRtpEncodingParameters[] = [
  { rid: 'f', maxBitrate: 1_500_000, maxFramerate: 24 },
  { rid: 'h', scaleResolutionDownBy: 2, maxBitrate: 300_000, maxFramerate: 24 },
];
/** A screen, capped for cost and clarity: up to 1080p at 5 to 15 fps (video-and-screen-bubbles.md "The screen share"). */
export const SCREEN_MAX_FPS = 15;
export const SCREEN_MAX_BITRATE = 1_000_000;
export const SCREEN_CONSTRAINTS: DisplayMediaStreamOptions = {
  audio: false,
  video: {
    width: { max: 1920 },
    height: { max: 1080 },
    frameRate: { ideal: SCREEN_MAX_FPS, max: SCREEN_MAX_FPS },
  },
};
export const SCREEN_ENCODINGS: RTCRtpEncodingParameters[] = [
  { maxBitrate: SCREEN_MAX_BITRATE, maxFramerate: SCREEN_MAX_FPS },
];

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
  | { kind: 'avatar-let-speak'; targetId: string; on: boolean };

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
};

/** The browser's getUserMedia, unless the input brings its own. */
export function userMediaOf(input: ProximityCallInput) {
  return (
    input.getUserMedia ?? ((c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c))
  );
}
