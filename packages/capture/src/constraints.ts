// What the microphone and the camera ask the browser for, wherever a person is heard or seen: livehuddle's calls and
// local previews (livehuddle/docs/specs/012-collaboration/video-and-screen-bubbles.md "Two layers") and every canvas
// app's walkthroughs (liveworkspace/docs/specs/006-media/walkthroughs.md). One copy, moved here from livehuddle when the
// walkthroughs became its second user.

/** The microphone's source: speech, cleaned up by the browser. */
export const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: false,
};

/** The camera's source: a call's large layer's size. */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } },
};

/** The same source from one device the person picked; the browser's default when none was. */
export function onDevice(
  constraints: MediaStreamConstraints,
  deviceId: string | null,
): MediaStreamConstraints {
  if (!deviceId) return constraints;
  const kind = constraints.audio ? 'audio' : 'video';
  const base = constraints[kind];
  return {
    ...constraints,
    [kind]: { ...(typeof base === 'object' ? base : {}), deviceId: { exact: deviceId } },
  };
}

export type CaptureKind = 'microphone' | 'camera' | 'screen';

/** Whether this browser can capture that kind here: a secure context and the API (no screen picker on a phone). */
export function canCapture(kind: CaptureKind): boolean {
  // Read off globalThis, so a render on the server (no window, no navigator) reads as unable.
  if (globalThis.isSecureContext !== true) return false;
  const devices = (globalThis.navigator as Navigator | undefined)?.mediaDevices;
  if (!devices) return false;
  return kind === 'screen'
    ? typeof devices.getDisplayMedia === 'function'
    : typeof devices.getUserMedia === 'function';
}
