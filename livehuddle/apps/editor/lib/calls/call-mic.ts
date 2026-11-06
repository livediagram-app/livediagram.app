// A proximity call's microphone (docs/specs/012-collaboration/proximity-audio.md "The microphone", "The talking
// equaliser"): opened once somebody is on your tab, published once and swapped in place after, closed after a quiet
// spell alone, muted on demand, and sampled for your own equaliser. The call owns one and tells it what happens.
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
  private muted = false;
  private voice: VoiceState = SILENT;
  private sampler: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  /** The browser refused the microphone. */
  blocked = false;
  /** Published once in this call: the locator carries it from then on, even while closed. */
  published = false;

  constructor(host: CallMicHost) {
    this.host = host;
  }

  /** Open the microphone (a speaker's) and publish it, or swap it back in after a close. */
  async open(): Promise<void> {
    const sfu = this.host.sfu();
    if (this.stream || this.blocked || !sfu || !this.host.trackToken()) return;
    let stream: MediaStream;
    try {
      stream = await userMediaOf(this.host.input)(MIC_CONSTRAINTS);
    } catch {
      this.blocked = true;
      setCallSelf({ mic: 'blocked' });
      return;
    }
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
    } else {
      this.published = true;
      await sfu.publish(track);
      this.host.announce();
    }
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

  /** Open while somebody else walks the tab; closed after MIC_IDLE_CLOSE_MS alone. */
  keepFor(company: boolean): void {
    if (!this.host.input.canSpeak || !this.published) return;
    if (company) {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = null;
      if (!this.stream) void this.open();
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

  /** Mute or unmute: muted sends nothing, no audio and no equaliser. */
  toggleMute(): void {
    this.muted = !this.muted;
    for (const t of this.stream?.getAudioTracks() ?? []) t.enabled = !this.muted;
    if (this.muted) this.applyVoice(silenceVoice(this.voice, performance.now()));
    setCallSelf({ muted: this.muted });
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
