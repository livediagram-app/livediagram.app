// What the camera and a shared screen ask the browser for, and how each is sent (docs/specs/012-collaboration/
// video-and-screen-bubbles.md "Two layers", "The screen share", "Local preview"): shared by the call (call-video.ts,
// through call-config.ts) and the local preview (local-preview.ts), which must not load the call to capture.

// The microphone's and the camera's sources are shared with every canvas app's walkthroughs, so they live in
// @liveworkspace/capture; the call's encodings and the screen share stay here.
export { CAMERA_CONSTRAINTS, MIC_CONSTRAINTS } from '@liveworkspace/capture/constraints';

/** Two simulcast layers, large first (Realtime ranks RIDs a to z): `f` 720p at 1.5 Mbps, `h` half size at 300 kbps. */
export const CAMERA_ENCODINGS: RTCRtpEncodingParameters[] = [
  { rid: 'f', maxBitrate: 1_500_000, maxFramerate: 24 },
  { rid: 'h', scaleResolutionDownBy: 2, maxBitrate: 300_000, maxFramerate: 24 },
];
/**
 * The picker's options beyond the standard ones (Screen Capture spec, Chromium 107+). Firefox and Safari ignore them,
 * as WebIDL ignores any unknown option. `controller` is a `CaptureController` (screen-picker.ts), one per picker.
 */
export type ScreenShareOptions = DisplayMediaStreamOptions & {
  selfBrowserSurface?: 'include' | 'exclude';
  surfaceSwitching?: 'include' | 'exclude';
  controller?: object;
};
/** A screen, capped for cost and clarity: up to 1080p at 5 to 15 fps (video-and-screen-bubbles.md "The screen share"). */
export const SCREEN_MAX_FPS = 15;
export const SCREEN_MAX_BITRATE = 1_000_000;
export const SCREEN_CONSTRAINTS: ScreenShareOptions = {
  audio: false,
  video: {
    width: { max: 1920 },
    height: { max: 1080 },
    frameRate: { ideal: SCREEN_MAX_FPS, max: SCREEN_MAX_FPS },
  },
  // The picker hints (#953): livehuddle's own tab is never offered (no hall of mirrors), and the sharing bar offers
  // Share this tab instead on the same track, so viewers' bubbles never drop.
  selfBrowserSurface: 'exclude',
  surfaceSwitching: 'include',
};
export const SCREEN_ENCODINGS: RTCRtpEncodingParameters[] = [
  { maxBitrate: SCREEN_MAX_BITRATE, maxFramerate: SCREEN_MAX_FPS },
];
