// A proximity call's camera and shared screen (docs/specs/012-collaboration/video-and-screen-bubbles.md "The camera",
// "The screen share"): published on demand on the call's session, shown in your own bubble, and stopped by you, the
// browser's own control, or the kill switch going audio only. The call owns one and tells it what happens. A stream the
// local preview already captured (local-preview.ts, "Local preview") is adopted onto the same path, never re-asked.
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

// Publish a camera or a screen, with its encodings. A refused publish (already logged by the session) is false: the
// bubble stays on your own screen, and a session Realtime dropped is renewed by the call, which publishes it again.
async function published(
  sfu: SfuSession,
  stream: MediaStream,
  name: typeof CALL_VIDEO_TRACK_NAME | typeof CALL_SCREEN_TRACK_NAME,
): Promise<boolean> {
  const encodings = name === CALL_VIDEO_TRACK_NAME ? CAMERA_ENCODINGS : SCREEN_ENCODINGS;
  try {
    await sfu.publish(stream.getVideoTracks()[0]!, name, encodings);
    return true;
  } catch {
    return false;
  }
}

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
    await this.sendCamera(sfu, stream);
  }

  /**
   * Send a camera the local preview already captured (video-and-screen-bubbles.md "Local preview"): the same as
   * turning it on, without asking the browser again. False (the stream untouched) when this call may not send one.
   */
  adoptCamera(stream: MediaStream): boolean {
    const sfu = this.host.sfu();
    if (this.camera || !sfu || !this.host.trackToken() || !this.host.input.canSpeak) return false;
    if (this.host.stopped() || !callsModeAllows(callSelf().mode, 'video')) return false;
    void this.sendCamera(sfu, stream);
    return true;
  }

  private async sendCamera(sfu: SfuSession, stream: MediaStream): Promise<void> {
    this.camera = stream;
    setCallMedia(SELF_MEDIA_ID, 'video', stream);
    setCallSelf({ camera: 'on' });
    this.cameraAnnounced = true;
    if (await published(sfu, stream, CALL_VIDEO_TRACK_NAME)) this.host.announce();
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
    await this.sendScreen(sfu, stream);
  }

  /** Send a screen the local preview already captured: an Editor's alone, no second picker. */
  adoptScreen(stream: MediaStream): boolean {
    const sfu = this.host.sfu();
    if (this.screen || !sfu || !this.host.trackToken() || !this.host.input.canShare) return false;
    if (this.host.stopped() || !callsModeAllows(callSelf().mode, 'screen')) return false;
    void this.sendScreen(sfu, stream);
    return true;
  }

  private async sendScreen(sfu: SfuSession, stream: MediaStream): Promise<void> {
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
    if (await published(sfu, stream, CALL_SCREEN_TRACK_NAME)) this.host.announce();
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

  /** The call renewed a session Realtime dropped: the camera and the screen that are on go out on the new one. */
  async republish(): Promise<void> {
    const sfu = this.host.sfu();
    if (!sfu) return;
    const camera = !!this.camera && (await published(sfu, this.camera, CALL_VIDEO_TRACK_NAME));
    const screen = !!this.screen && (await published(sfu, this.screen, CALL_SCREEN_TRACK_NAME));
    if (camera || screen) this.host.announce();
  }

  /** The open streams, for the call's teardown; released with it. */
  release(): [MediaStream | null, MediaStream | null] {
    const streams: [MediaStream | null, MediaStream | null] = [this.camera, this.screen];
    this.camera = null;
    this.screen = null;
    return streams;
  }
}
