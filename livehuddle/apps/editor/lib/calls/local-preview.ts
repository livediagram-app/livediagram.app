// A camera or a screen with no call to send it on (docs/specs/012-collaboration/video-and-screen-bubbles.md "Local
// preview"): captured on a press, shown as your own bubble on your own screen alone, and sent to nobody. A call that
// goes live takes the stream already captured (`take`), so joining never asks the browser twice. Part of the canvas
// chunk, never the call's: it needs only the store and the constraints.
import { useSyncExternalStore } from 'react';
import { callSelf, onCallSelf, SELF_MEDIA_ID, setCallMedia, setCallSelf } from './calls-store';
import type { CallMedia, CallSelf } from './calls-store';
import { CAMERA_CONSTRAINTS, SCREEN_CONSTRAINTS } from './media-constraints';

export type PreviewKind = 'camera' | 'screen';

/** The browser's capture calls, unless a test brings its own. */
export type PreviewCapture = {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  getDisplayMedia?: (options: DisplayMediaStreamOptions) => Promise<MediaStream>;
};

/** Whether this browser can capture that kind here: a secure context and the API (no screen picker on a phone). */
export function canCapture(kind: PreviewKind): boolean {
  if (typeof window === 'undefined' || !window.isSecureContext) return false;
  const devices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
  if (!devices) return false;
  return kind === 'camera'
    ? typeof devices.getUserMedia === 'function'
    : typeof devices.getDisplayMedia === 'function';
}

const MEDIA_OF_KIND: Record<PreviewKind, CallMedia> = { camera: 'video', screen: 'screen' };
const stopAll = (stream: MediaStream) => {
  for (const t of stream.getTracks()) t.stop();
};

export class LocalPreview {
  private readonly capture: PreviewCapture;
  private readonly streams: Record<PreviewKind, MediaStream | null> = {
    camera: null,
    screen: null,
  };
  // Bumped by every start and stop, so a capture that resolves after a stop is released, never shown.
  private readonly attempt: Record<PreviewKind, number> = { camera: 0, screen: 0 };
  private readonly listeners = new Set<() => void>();

  constructor(capture: PreviewCapture = {}) {
    this.capture = capture;
  }

  /** The stream this preview holds of that kind, or null. */
  stream(kind: PreviewKind): MediaStream | null {
    return this.streams[kind];
  }

  /** Subscribe to a stream arriving (the running call, which takes what it may send). */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Capture that kind and show it as your own bubble. A capture already on its way is left to finish. */
  async start(kind: PreviewKind): Promise<void> {
    if (this.streams[kind] || stateOf(callSelf(), kind) === 'starting') return;
    const attempt = ++this.attempt[kind];
    setState(kind, 'starting');
    let stream: MediaStream;
    try {
      stream = await this.open(kind);
    } catch {
      // A refused camera reads Camera Blocked; a cancelled screen picker is back to off, never an error.
      if (attempt === this.attempt[kind]) setState(kind, kind === 'camera' ? 'blocked' : 'off');
      return;
    }
    if (attempt !== this.attempt[kind]) {
      stopAll(stream);
      return;
    }
    const track = stream.getVideoTracks()[0];
    if (track) {
      if (kind === 'screen') track.contentHint = 'detail';
      // The browser's own Stop Sharing control ends a screen; an unplugged or withdrawn camera ends a camera.
      track.addEventListener('ended', () => {
        if (this.streams[kind] === stream) this.stop(kind);
      });
    }
    this.streams[kind] = stream;
    setCallMedia(SELF_MEDIA_ID, MEDIA_OF_KIND[kind], stream);
    setState(kind, 'on');
    for (const listener of [...this.listeners]) listener();
  }

  /** Stop that kind: its tracks end (the camera light goes out) and the bubble goes. Cancels a capture on its way. */
  stop(kind: PreviewKind): void {
    this.attempt[kind]++;
    const stream = this.streams[kind];
    this.streams[kind] = null;
    if (stream) {
      stopAll(stream);
      setCallMedia(SELF_MEDIA_ID, MEDIA_OF_KIND[kind], null);
    }
    setState(kind, 'off');
  }

  /** Stop both: leaving the mode, a tab change, the canvas going. */
  stopAll(): void {
    this.stop('camera');
    this.stop('screen');
  }

  /**
   * Hand the stream over to the call, still running: the call now owns it, keeps showing it, and stops it when it is
   * done. The preview reads off.
   */
  take(kind: PreviewKind): MediaStream | null {
    const stream = this.streams[kind];
    if (!stream) return null;
    this.streams[kind] = null;
    setState(kind, 'off');
    return stream;
  }

  private open(kind: PreviewKind): Promise<MediaStream> {
    if (kind === 'camera') {
      const getUserMedia =
        this.capture.getUserMedia ??
        ((c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c));
      return getUserMedia(CAMERA_CONSTRAINTS);
    }
    const getDisplayMedia =
      this.capture.getDisplayMedia ??
      ((o: DisplayMediaStreamOptions) => navigator.mediaDevices.getDisplayMedia(o));
    return getDisplayMedia(SCREEN_CONSTRAINTS);
  }
}

function stateOf(self: CallSelf, kind: PreviewKind) {
  return kind === 'camera' ? self.previewCamera : self.previewScreen;
}

function setState(kind: PreviewKind, state: 'off' | 'starting' | 'on' | 'blocked') {
  if (kind === 'camera') setCallSelf({ previewCamera: state });
  else setCallSelf({ previewScreen: state === 'blocked' ? 'off' : state });
}

/** Your camera as the strip shows it: the call's while it has one, else the preview's. */
export function selfCamera(self: CallSelf): CallSelf['camera'] {
  return self.camera !== 'off' ? self.camera : self.previewCamera;
}

/** Your screen as the strip shows it: the call's while it shares, else the preview's. */
export function selfScreen(self: CallSelf): CallSelf['screen'] {
  return self.screen !== 'off' ? self.screen : self.previewScreen;
}

/** Whether your own bubble of that kind is a preview nobody else sees (the Only You tag). */
export function localOnly(self: CallSelf, media: CallMedia): boolean {
  return media === 'video'
    ? self.camera === 'off' && self.previewCamera === 'on'
    : self.screen === 'off' && self.previewScreen === 'on';
}

// One small string, so a level or a heard set changing never re-renders the bubbles.
const localOnlyKey = () => {
  const self = callSelf();
  return `${localOnly(self, 'video') ? 'v' : ''}${localOnly(self, 'screen') ? 's' : ''}`;
};

/** Which of your own bubbles are previews, for the bubble layer. */
export function useLocalOnly(): { video: boolean; screen: boolean } {
  const key = useSyncExternalStore(onCallSelf, localOnlyKey, localOnlyKey);
  return { video: key.includes('v'), screen: key.includes('s') };
}
