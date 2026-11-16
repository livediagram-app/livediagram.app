// The one way a screen picker opens, for the call (call-video.ts) and the local preview (local-preview.ts) alike
// (docs/specs/012-collaboration/video-and-screen-bubbles.md "The screen share", #953): the picker hints in
// SCREEN_CONSTRAINTS, and Conditional Focus, so the presenter stays on livehuddle after picking a tab or a window and
// the hidden-tab rule never closes their subscriptions. Part of the canvas chunk: it needs only the constraints.
import { SCREEN_CONSTRAINTS, type ScreenShareOptions } from './media-constraints';

/** The browser's picker, or a test's. */
export type DisplayMediaPicker = (options: DisplayMediaStreamOptions) => Promise<MediaStream>;

/** What a `CaptureController` gives us (Chromium 109+; the DOM types may not have it yet). */
export type FocusController = {
  setFocusBehavior(behavior: 'focus-captured-surface' | 'no-focus-change'): void;
};
export type FocusControllerClass = new () => FocusController;

/** This browser's `CaptureController`, when it has one: Firefox and Safari do not. */
export function captureControllerClass(): FocusControllerClass | undefined {
  const Controller = (globalThis as { CaptureController?: unknown }).CaptureController;
  return typeof Controller === 'function' ? (Controller as FocusControllerClass) : undefined;
}

// Only a tab or a window takes the focus away; a whole screen has none to keep. A browser that does not say which it
// is (no displaySurface) is asked anyway: a refusal is harmless.
function movesFocus(stream: MediaStream): boolean {
  // An older Safari track has no getSettings.
  const surface = stream.getVideoTracks()[0]?.getSettings?.().displaySurface;
  return surface === undefined || surface === 'browser' || surface === 'window';
}

/**
 * Open the picker at the screen caps and hints, and keep the focus on livehuddle where the browser can. The focus
 * call runs in the same microtask the picker resolves in (a late one throws and the switch goes ahead), and never
 * fails the share. A cancelled picker rejects as before.
 */
export async function pickScreen(
  getDisplayMedia: DisplayMediaPicker,
  Controller: FocusControllerClass | undefined = captureControllerClass(),
): Promise<MediaStream> {
  const controller = Controller ? new Controller() : undefined;
  const options: ScreenShareOptions = controller
    ? { ...SCREEN_CONSTRAINTS, controller }
    : SCREEN_CONSTRAINTS;
  const stream = await getDisplayMedia(options);
  if (controller && movesFocus(stream)) {
    try {
      controller.setFocusBehavior('no-focus-change');
    } catch {
      // Too late, or a surface the browser will not hold focus for: the share carries on, only the focus moves.
    }
  }
  return stream;
}
