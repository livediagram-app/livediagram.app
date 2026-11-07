// A proximity call's microphone (docs/specs/012-collaboration/proximity-audio.md "The microphone", "The talking
// equaliser"): muted when the call starts and not opened at all until your first unmute (owner, 2026-11-07: "your mic
// stays muted by default when joining"), so walking in never asks for the microphone. Opened on an unmute, published
// once and swapped in place after; kept open while unmuted, alone or not, so you can see it work; released after a
// quiet spell muted and alone; sampled for your own equaliser. The call owns one and tells it what happens.
import type { VoiceLevel } from '@livehuddle/api-schema';
import type { AudioGraph } from './audio-graph';
import { setCallSelf } from './calls-store';
import {
  MIC_CONSTRAINTS,
  MIC_IDLE_CLOSE_MS,
  userMediaOf,
  type CallSignal,
  type ProximityCallInput,
} from './call-config';
import type { SfuSession } from './sfu-session';
import {
  silenceVoice,
  SILENT,
  stepVoice,
  VOICE_SAMPLE_MS,
  type VoiceState,
} from './voice-detector';

/** What the microphone needs of its call. */
export type CallMicHost = {
  input: ProximityCallInput;
  graph: AudioGraph;
  sfu: () => SfuSession | null;
  trackToken: () => string | null;
  stopped: () => boolean;
  // Everything said to the room, through the call's quiet-spell clock.
  send: (signal: CallSignal) => void;
  // The microphone was published: the room learns where it is.
  announce: () => void;
};

export class CallMic {
  private readonly host: CallMicHost;
  private stream: MediaStream | null = null;
  private muted = true;
  // Somebody else walks the tab (keepFor).
  private company = false;
  private voice: VoiceState = SILENT;
  private sampler: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  /** The browser refused the microphone. */
  blocked = false;
  // A capture is on its way: a second open (an unmute, then somebody arriving) waits on it rather than asking again.
  private opening = false;
  /** Published once in this call: the locator carries it from then on, even while closed. */
  published = false;

  constructor(host: CallMicHost) {
    this.host = host;
  }

  /** Open the microphone (a speaker's) and publish it, or swap it back in after a close. One capture at a time. */
  async open(): Promise<void> {
    const sfu = this.host.sfu();
    if (this.stream || this.opening || this.blocked || !sfu || !this.host.trackToken()) return;
    let stream: MediaStream;
    this.opening = true;
    try {
      stream = await userMediaOf(this.host.input)(MIC_CONSTRAINTS);
    } catch {
      this.opening = false;
      this.blocked = true;
      setCallSelf({ mic: 'blocked' });
      return;
    }
    this.opening = false;
    if (this.host.stopped()) {
      for (const t of stream.getTracks()) t.stop();
      return;
    }
    this.stream = stream;
    const track = stream.getAudioTracks()[0]!;
    track.enabled = !this.muted;
    this.host.graph.listenTo(stream);
    setCallSelf({ mic: 'open' });
    this.startSampling();
    if (this.published) {
      await sfu.replaceMic(track);
      return;
    }
    await this.publish(sfu, track);
  }

  // Publish the open microphone. A refused publish (already logged by the session) leaves it unpublished, and a
  // session Realtime dropped is renewed by the call, which publishes it again (republish).
  private async publish(sfu: SfuSession, track: MediaStreamTrack): Promise<void> {
    this.published = true;
    try {
      await sfu.publish(track);
    } catch {
      this.published = false;
      return;
    }
    this.host.announce();
  }

  private close(): void {
    if (!this.stream) return;
    for (const t of this.stream.getTracks()) t.stop();
    this.stream = null;
    this.host.graph.listenTo(null);
    void this.host.sfu()?.replaceMic(null);
    this.stopSampling();
    setCallSelf({ mic: 'closed' });
  }

  /** Open while unmuted; muted, kept while somebody else walks the tab and released after MIC_IDLE_CLOSE_MS alone. */
  keepFor(company: boolean): void {
    this.company = company;
    if (!this.host.input.canSpeak) return;
    if (!this.muted || company) {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = null;
      // Swapped back in for an unmuted speaker after a release (never opened here while muted: no prompt).
      if (!this.muted && !this.stream && this.published) void this.open();
      return;
    }
    if (!this.stream || this.idleTimer) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.close();
    }, MIC_IDLE_CLOSE_MS);
  }

  private startSampling(): void {
    if (this.sampler) return;
    this.sampler = setInterval(() => this.sample(), VOICE_SAMPLE_MS);
  }

  /** Stop sampling: your equaliser goes quiet. */
  stopSampling(): void {
    if (this.sampler) clearInterval(this.sampler);
    this.sampler = null;
    this.applyVoice(silenceVoice(this.voice, performance.now()));
  }

  private sample(): void {
    if (this.muted) return;
    this.applyVoice(stepVoice(this.voice, this.host.graph.micLevel(), performance.now()));
  }

  private applyVoice(step: { state: VoiceState; send?: VoiceLevel }): void {
    this.voice = step.state;
    if (step.send === undefined) return;
    this.host.send({ kind: 'avatar-voice', level: step.send });
    setCallSelf({ level: step.send });
  }

  /**
   * Mute or unmute: muted sends nothing, no audio and no equaliser. The first unmute opens the microphone (the browser
   * asks then, never on walking in); a press on Mic Blocked asks again.
   */
  toggleMute(): void {
    if (this.blocked) {
      this.blocked = false;
      this.muted = false;
      setCallSelf({ muted: false, mic: 'closed' });
      void this.open();
      return;
    }
    this.muted = !this.muted;
    for (const t of this.stream?.getAudioTracks() ?? []) t.enabled = !this.muted;
    if (this.muted) this.applyVoice(silenceVoice(this.voice, performance.now()));
    setCallSelf({ muted: this.muted });
    if (!this.muted && !this.stream && this.host.input.canSpeak) void this.open();
    this.keepFor(this.company);
  }

  /**
   * The call renewed a session Realtime dropped (proximity-audio.md "A session that expires"): an open microphone is
   * published on the new one; a released one is no longer published, so the next open publishes it afresh.
   */
  async republish(): Promise<void> {
    const sfu = this.host.sfu();
    const track = this.stream?.getAudioTracks()[0];
    if (sfu && track) {
      await this.publish(sfu, track);
      return;
    }
    this.published = false;
    // Unmuted while the session was renewed, the microphone could not open then: it opens now.
    if (!this.muted && !this.blocked && this.host.input.canSpeak) await this.open();
  }

  /** The call is ending: no idle close is due. */
  clearIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
  }

  /** The open stream, for the call's teardown; released with it. */
  release(): MediaStream | null {
    const stream = this.stream;
    this.stream = null;
    return stream;
  }
}
