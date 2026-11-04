// The call's sound (docs/specs/012-collaboration/blueprints/proximity-audio.md "Audio graph"): one AudioContext,
// each heard speaker through a gain and a stereo panner, and the microphone through an analyser for the voice
// detector. Gain and pan glide, so walking is never heard as steps.
import { rmsOf } from './voice-detector';

/** How long gain and pan take to settle on a new value (the time constant of setTargetAtTime). */
export const GLIDE_S = 0.12;

type Voice = {
  element: HTMLAudioElement;
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  pan: StereoPannerNode;
};

export class AudioGraph {
  readonly context: AudioContext;
  private readonly voices = new Map<string, Voice>();
  private analyser: AnalyserNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private samples: Float32Array<ArrayBuffer> | null = null;

  /** Made inside the Join press, so the browser lets it play. */
  constructor(context: AudioContext) {
    this.context = context;
  }

  /** Play a speaker's stream, silent until `place` sets its gain. */
  attach(id: string, stream: MediaStream): void {
    this.detach(id);
    // Chrome plays a WebRTC stream into Web Audio only while a media element holds it; muted, so it is heard once.
    const element = new Audio();
    element.muted = true;
    element.srcObject = stream;
    void element.play().catch(() => {});
    const source = this.context.createMediaStreamSource(stream);
    const gain = this.context.createGain();
    gain.gain.value = 0;
    const pan = this.context.createStereoPanner();
    source.connect(gain).connect(pan).connect(this.context.destination);
    this.voices.set(id, { element, source, gain, pan });
  }

  has(id: string): boolean {
    return this.voices.has(id);
  }

  /** Glide a speaker to a new volume and side. */
  place(id: string, gain: number, pan: number): void {
    const voice = this.voices.get(id);
    if (!voice) return;
    const at = this.context.currentTime;
    voice.gain.gain.setTargetAtTime(gain, at, GLIDE_S);
    voice.pan.pan.setTargetAtTime(pan, at, GLIDE_S);
  }

  detach(id: string): void {
    const voice = this.voices.get(id);
    if (!voice) return;
    this.voices.delete(id);
    voice.source.disconnect();
    voice.gain.disconnect();
    voice.pan.disconnect();
    voice.element.srcObject = null;
  }

  /** Listen to the microphone for the voice detector (never to the speakers: no feedback). */
  listenTo(mic: MediaStream | null): void {
    this.micSource?.disconnect();
    this.micSource = null;
    if (!mic) return;
    this.analyser ??= Object.assign(this.context.createAnalyser(), { fftSize: 512 });
    this.samples ??= new Float32Array(this.analyser.fftSize);
    this.micSource = this.context.createMediaStreamSource(mic);
    this.micSource.connect(this.analyser);
  }

  /** The microphone's loudness now (RMS, 0 to 1); 0 while not listening. */
  micLevel(): number {
    if (!this.micSource || !this.analyser || !this.samples) return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    return rmsOf(this.samples);
  }

  close(): void {
    for (const id of [...this.voices.keys()]) this.detach(id);
    this.listenTo(null);
    void this.context.close().catch(() => {});
  }
}
