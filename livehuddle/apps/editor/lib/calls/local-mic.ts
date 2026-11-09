// The microphone with no call to send it on (docs/specs/012-collaboration/proximity-audio.md "Local preview"), as the
// camera has one (local-preview.ts): in a Space kept in This Browser, on a server without calls, or while calls are
// paused, unmuting still opens the microphone, so you can see it work. It drives your own talking equaliser on your
// own screen and nothing else: no session, no track, no signal to the room. Part of the canvas chunk, never the
// call's: it needs only the store, the constraints and the voice detector.
import type { VoiceLevel } from '@livehuddle/api-schema';
import { setCallSelf } from './calls-store';
import { MIC_CONSTRAINTS } from './media-constraints';
import {
  rmsOf,
  silenceVoice,
  SILENT,
  stepVoice,
  VOICE_SAMPLE_MS,
  type VoiceState,
} from './voice-detector';

export class LocalMic {
  private readonly getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>;
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private sampler: ReturnType<typeof setInterval> | null = null;
  private voice: VoiceState = SILENT;
  // Bumped by every start and stop, so a capture that resolves after a stop is released, never shown.
  private attempt = 0;

  constructor(getUserMedia?: (c: MediaStreamConstraints) => Promise<MediaStream>) {
    this.getUserMedia =
      getUserMedia ?? ((c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c));
  }

  get on(): boolean {
    return this.stream !== null;
  }

  /** Open the microphone on a press and sample it for your own equaliser. */
  async start(): Promise<void> {
    if (this.stream) return;
    const attempt = ++this.attempt;
    setCallSelf({ previewMic: 'starting' });
    let stream: MediaStream;
    try {
      stream = await this.getUserMedia(MIC_CONSTRAINTS);
    } catch {
      if (attempt === this.attempt) setCallSelf({ previewMic: 'blocked' });
      return;
    }
    if (attempt !== this.attempt) {
      for (const t of stream.getTracks()) t.stop();
      return;
    }
    this.stream = stream;
    // A microphone the browser ends (unplugged, its permission withdrawn) closes, as a press would: never an equaliser
    // left reading a dead track.
    for (const t of stream.getTracks()) {
      t.addEventListener('ended', () => {
        if (this.stream === stream) this.stop();
      });
    }
    const context = new AudioContext();
    this.context = context;
    const analyser = Object.assign(context.createAnalyser(), { fftSize: 512 });
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    this.sampler = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      this.apply(stepVoice(this.voice, rmsOf(samples), performance.now()));
    }, VOICE_SAMPLE_MS);
    setCallSelf({ previewMic: 'on' });
  }

  /** Close it: the browser's microphone light goes out and your equaliser goes quiet. */
  stop(): void {
    this.attempt++;
    if (this.sampler) clearInterval(this.sampler);
    this.sampler = null;
    for (const t of this.stream?.getTracks() ?? []) t.stop();
    this.stream = null;
    void this.context?.close().catch(() => {});
    this.context = null;
    this.apply(silenceVoice(this.voice, performance.now()));
    setCallSelf({ previewMic: 'off' });
  }

  private apply(step: { state: VoiceState; send?: VoiceLevel }): void {
    this.voice = step.state;
    if (step.send !== undefined) setCallSelf({ level: step.send });
  }
}
