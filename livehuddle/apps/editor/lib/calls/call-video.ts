// A proximity call's camera and shared screen (docs/specs/012-collaboration/video-and-screen-bubbles.md "The camera",
// "The screen share"): published on demand on the call's session, shown in your own bubble, and stopped by you, the
// browser's own control, or the kill switch going audio only. The call owns one and tells it what happens.
import {
  CALL_SCREEN_TRACK_NAME,
  CALL_VIDEO_TRACK_NAME,
  callsModeAllows,
} from '@livehuddle/api-schema';
import { callSelf, SELF_MEDIA_ID, setCallMedia, setCallSelf } from './calls-store';
import {
  CAMERA_CONSTRAINTS,
  CAMERA_ENCODINGS,
  SCREEN_CONSTRAINTS,
  SCREEN_ENCODINGS,
  userMediaOf,
  type ProximityCallInput,
} from './call-config';
import type { SfuSession } from './sfu-session';

/** What the camera and the screen need of their call. */
export type CallVideoHost = {
  input: ProximityCallInput;
  sfu: () => SfuSession | null;
  trackToken: () => string | null;
  stopped: () => boolean;
  // A track went on or off: the room learns where it is now.
  announce: () => void;
};

export class CallVideo {
  private readonly host: CallVideoHost;
  camera: MediaStream | null = null;
  screen: MediaStream | null = null;
  // Whether the op carries a camera or screen slot: once used in this call, it says when it goes off too.
  cameraAnnounced = false;
  screenAnnounced = false;

  constructor(host: CallVideoHost) {
    this.host = host;
  }

  /** Turn the camera on or off. A Viewer has none; audio only pauses it. */
  async toggleCamera(): Promise<void> {
    if (this.camera) {
      this.stopCamera();
      return;
    }
    const sfu = this.host.sfu();
    if (!sfu || !this.host.trackToken() || !this.host.input.canSpeak || this.host.stopped()) return;
    if (!callsModeAllows(callSelf().mode, 'video') || callSelf().camera === 'starting') return;
    setCallSelf({ camera: 'starting' });
    let stream: MediaStream;
    try {
      stream = await userMediaOf(this.host.input)(CAMERA_CONSTRAINTS);
    } catch {
      if (!this.host.stopped()) setCallSelf({ camera: 'blocked' });
      return;
    }
    if (this.host.stopped() || !callsModeAllows(callSelf().mode, 'video')) {
      for (const t of stream.getTracks()) t.stop();
      if (!this.host.stopped()) setCallSelf({ camera: 'off' });
      return;
    }
    this.camera = stream;
    setCallMedia(SELF_MEDIA_ID, 'video', stream);
    setCallSelf({ camera: 'on' });
    this.cameraAnnounced = true;
    await sfu.publish(stream.getVideoTracks()[0]!, CALL_VIDEO_TRACK_NAME, CAMERA_ENCODINGS);
    this.host.announce();
  }

  stopCamera(): void {
    if (!this.camera) {
      if (callSelf().camera === 'blocked') setCallSelf({ camera: 'off' });
      return;
    }
    for (const t of this.camera.getTracks()) t.stop();
    this.camera = null;
    void this.host.sfu()?.replaceTrack(CALL_VIDEO_TRACK_NAME, null);
    setCallMedia(SELF_MEDIA_ID, 'video', null);
    setCallSelf({ camera: 'off' });
    this.host.announce();
  }

  /** Share a screen, or stop sharing. An Editor's alone; audio only pauses it. */
  async toggleScreen(): Promise<void> {
    if (this.screen) {
      this.stopScreen();
      return;
    }
    const sfu = this.host.sfu();
    const { input } = this.host;
    if (!sfu || !this.host.trackToken() || !input.canShare || this.host.stopped()) return;
    if (!callsModeAllows(callSelf().mode, 'screen') || callSelf().screen === 'starting') return;
    setCallSelf({ screen: 'starting' });
    const getDisplayMedia =
      input.getDisplayMedia ??
      ((o: DisplayMediaStreamOptions) => navigator.mediaDevices.getDisplayMedia(o));
    let stream: MediaStream;
    try {
      stream = await getDisplayMedia(SCREEN_CONSTRAINTS);
    } catch {
      // Cancelled in the browser's picker, or refused: back to off, never an error.
      if (!this.host.stopped()) setCallSelf({ screen: 'off' });
      return;
    }
    if (this.host.stopped() || !callsModeAllows(callSelf().mode, 'screen')) {
      for (const t of stream.getTracks()) t.stop();
      if (!this.host.stopped()) setCallSelf({ screen: 'off' });
      return;
    }
    const track = stream.getVideoTracks()[0]!;
    // Text stays sharp: the encoder keeps detail and drops frames rather than resolution.
    track.contentHint = 'detail';
    // The browser's own Stop Sharing control ends the track.
    track.addEventListener('ended', () => {
      if (this.screen === stream) this.stopScreen();
    });
    this.screen = stream;
    setCallMedia(SELF_MEDIA_ID, 'screen', stream);
    setCallSelf({ screen: 'on' });
    this.screenAnnounced = true;
    await sfu.publish(track, CALL_SCREEN_TRACK_NAME, SCREEN_ENCODINGS);
    this.host.announce();
  }

  stopScreen(): void {
    if (!this.screen) return;
    for (const t of this.screen.getTracks()) t.stop();
    this.screen = null;
    void this.host.sfu()?.replaceTrack(CALL_SCREEN_TRACK_NAME, null);
    setCallMedia(SELF_MEDIA_ID, 'screen', null);
    setCallSelf({ screen: 'off' });
    this.host.announce();
  }

  /** The open streams, for the call's teardown; released with it. */
  release(): (MediaStream | null)[] {
    const streams = [this.camera, this.screen];
    this.camera = null;
    this.screen = null;
    return streams;
  }
}
