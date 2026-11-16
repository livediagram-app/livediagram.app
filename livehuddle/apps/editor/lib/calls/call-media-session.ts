// The browser's own call controls (docs/specs/012-collaboration/proximity-audio.md "Outside the tab"; blueprint:
// proximity-audio.md "Outside the tab", Work Tracker 992): while you are in a live call and may speak, the W3C Media
// Session's togglemicrophone and togglecamera run the Call dock's own actions, and the microphone's and camera's
// state is reported back on every change, wherever it was made. Hang up is never registered: in a Space you leave a
// call by walking away. Not live, or stopped, both handlers clear, so a stale button never acts on no call.
import { callsModeAllows } from '@livehuddle/api-schema';
import { callActions, callSelf, micOn, onCallSelf, type CallSelf } from './calls-store';

type CallAction = 'togglemicrophone' | 'togglecamera';

/** The part of `navigator.mediaSession` the call uses; the setters are missing where the browser lacks them. */
export type CallMediaSession = {
  setActionHandler: (action: CallAction, handler: (() => void) | null) => void;
  setMicrophoneActive?: (active: boolean) => unknown;
  setCameraActive?: (active: boolean) => unknown;
};

/** What the browser is told: which actions are registered, and the microphone's and camera's state. */
export type CallSessionState = {
  mic: boolean;
  cameraAction: boolean;
  active: boolean;
  camera: boolean;
};

const CLEARED: CallSessionState = { mic: false, cameraAction: false, active: false, camera: false };

/** `navigator.mediaSession`, or null where the browser has none (the static export's build, older browsers). */
export function mediaSessionOf(
  nav: { mediaSession?: unknown } | undefined = globalThis.navigator,
): CallMediaSession | null {
  const session = nav?.mediaSession as Partial<CallMediaSession> | undefined;
  return typeof session?.setActionHandler === 'function' ? (session as CallMediaSession) : null;
}

/** The state your call asks for: actions only while live and able to speak, the camera's only while video is allowed. */
export function callSessionState(self: CallSelf, hasActions: boolean): CallSessionState {
  const live = hasActions && self.available && self.canSpeak && self.phase === 'live';
  if (!live) return CLEARED;
  return {
    mic: true,
    cameraAction: callsModeAllows(self.mode, 'video'),
    active: micOn(self),
    camera: self.camera === 'on',
  };
}

// Each call is wrapped: a browser that does not know an action (Firefox, Safari) throws, and is left as it is.
function attempt(run: () => unknown): void {
  try {
    const result = run();
    if (result instanceof Promise) result.catch(() => {});
  } catch {
    // The browser refused this action: nothing else changes.
  }
}

const toggleMicrophone = () => callActions()?.toggleMute();
const toggleCamera = () => callActions()?.toggleCamera();

/**
 * Keep the browser's call controls in step with your call until the returned stop is called, which clears them.
 * Only a change is applied, so a level tick (the store notifies on every one) costs one small compare.
 */
export function watchCallMediaSession(
  session: CallMediaSession | null = mediaSessionOf(),
): () => void {
  if (!session) return () => {};
  let applied = CLEARED;
  const apply = (next: CallSessionState) => {
    const was = applied;
    applied = next;
    if (next.mic !== was.mic) {
      attempt(() =>
        session.setActionHandler('togglemicrophone', next.mic ? toggleMicrophone : null),
      );
    }
    if (next.cameraAction !== was.cameraAction) {
      attempt(() =>
        session.setActionHandler('togglecamera', next.cameraAction ? toggleCamera : null),
      );
    }
    // Reported as the actions register and on every change while they stay, then once more as off when they clear.
    const registered = next.mic && !was.mic;
    if (registered || next.active !== was.active) {
      attempt(() => session.setMicrophoneActive?.(next.active));
    }
    if (registered || next.camera !== was.camera) {
      attempt(() => session.setCameraActive?.(next.camera));
    }
  };
  const sync = () => apply(callSessionState(callSelf(), callActions() !== null));
  sync();
  const unsubscribe = onCallSelf(sync);
  return () => {
    unsubscribe();
    apply(CLEARED);
  };
}
