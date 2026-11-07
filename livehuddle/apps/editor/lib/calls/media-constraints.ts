// What the camera and a shared screen ask the browser for, and how each is sent (docs/specs/012-collaboration/
// video-and-screen-bubbles.md "Two layers", "The screen share", "Local preview"): shared by the call (call-video.ts,
// through call-config.ts) and the local preview (local-preview.ts), which must not load the call to capture.

/** The microphone's source: the call's (call-mic.ts) and the local preview's (local-mic.ts). */
export const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: false,
};

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
