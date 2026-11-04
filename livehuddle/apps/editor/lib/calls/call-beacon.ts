// What a proximity call tells the room about itself (docs/specs/012-collaboration/proximity-audio.md "The wire"):
// where its media is (the `call-track` locator, sent on a change and again for a new walker at most once a second),
// and, after a quiet spell, a nudge to read the kill switch (docs/specs/016-platform/calls-kill-switch.md "The room
// tells its clients"). Every signal goes through here, so the quiet spell is measured from the last of them.
import { CALL_SCREEN_TRACK_NAME, CALL_VIDEO_TRACK_NAME } from '@livehuddle/api-schema';
import { CALLS_CHECK_MS, LOCATOR_RESEND_MS, type CallSignal } from './call-config';
import type { SfuSession } from './sfu-session';

/** Which of this browser's tracks the locator names: published or announced once, and on now. */
export type TrackSlots = {
  published: boolean;
  cameraAnnounced: boolean;
  camera: boolean;
  screenAnnounced: boolean;
  screen: boolean;
};

/** Where this browser's media is: the microphone's locator once published, the camera's and the screen's while on. */
export function trackSignalOf(
  sfu: SfuSession | null,
  token: string | null,
  slots: TrackSlots,
): CallSignal | null {
  if (!sfu || !token) return null;
  if (!slots.published && !slots.cameraAnnounced && !slots.screenAnnounced) return null;
  return {
    kind: 'call-track',
    track: slots.published ? sfu.locator(token) : null,
    ...(slots.cameraAnnounced
      ? { video: slots.camera ? sfu.locator(token, CALL_VIDEO_TRACK_NAME) : null }
      : {}),
    ...(slots.screenAnnounced
      ? { screen: slots.screen ? sfu.locator(token, CALL_SCREEN_TRACK_NAME) : null }
      : {}),
  };
}

/** What the beacon needs of its call. */
export type CallBeaconHost = {
  send: (signal: CallSignal) => void;
  // The locator to send now, or null while there is nothing to say.
  trackSignal: () => CallSignal | null;
  // Whether the kill-switch nudge is still owed: the call runs and publishes something.
  publishing: () => boolean;
};

export class CallBeacon {
  private readonly host: CallBeaconHost;
  private locatorSentAt = -Infinity;
  private locatorDue: ReturnType<typeof setTimeout> | null = null;
  // When this call last sent the room anything, and the nudge due after a quiet CALLS_CHECK_MS.
  private checkDue: ReturnType<typeof setTimeout> | null = null;

  constructor(host: CallBeaconHost) {
    this.host = host;
  }

  /** Send the locator: now when forced, else at most once every LOCATOR_RESEND_MS. */
  sendLocator(force = false): void {
    const signal = this.host.trackSignal();
    if (!signal) return;
    const wait = LOCATOR_RESEND_MS - (performance.now() - this.locatorSentAt);
    if (!force && wait > 0) {
      this.locatorDue ??= setTimeout(() => {
        this.locatorDue = null;
        this.sendLocator(true);
      }, wait);
      return;
    }
    this.locatorSentAt = performance.now();
    this.send(signal);
  }

  /** Everything this call tells the room goes through here. */
  send(signal: CallSignal): void {
    this.host.send(signal);
    if (this.checkDue) clearTimeout(this.checkDue);
    this.checkDue = setTimeout(() => this.check(), CALLS_CHECK_MS);
  }

  // A publishing call that has said nothing for CALLS_CHECK_MS asks the room to read the kill switch, so a silent
  // room still hears of a flip within about that long (calls-kill-switch.md "The room tells its clients"). The room
  // reads at most once per CALLS_CHECK_MS whoever asks; a listener asks nothing, as nothing it hears costs without a
  // publisher.
  private check(): void {
    this.checkDue = null;
    if (!this.host.publishing()) return;
    this.send({ kind: 'calls-check' });
  }

  /** The call is ending: nothing more is due. */
  clear(): void {
    if (this.locatorDue) clearTimeout(this.locatorDue);
    if (this.checkDue) clearTimeout(this.checkDue);
    this.checkDue = null;
  }
}
