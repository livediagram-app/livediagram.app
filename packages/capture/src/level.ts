// How loud a microphone is, for a level meter: livehuddle's talking equaliser and a walkthrough's recording dock read
// it the same way. Never audio: one number, read when the caller asks.

/** The root mean square of a block of samples (-1 to 1), as an analyser's time-domain data gives them. */
export function rmsOf(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

/** A loudness as a meter's fill, 0 to 1: -65 dBFS (a silent room, after the browser's noise suppression, sits near
 *  -71) is empty, -15 dBFS (a shout) full. Measured on a desk USB microphone (owner, 2026-11-17): talking runs -39
 *  dBFS at the median and -24 at the 90th percentile, so a voice fills half to four fifths and only a shout fills it. */
export function meterFill(rms: number): number {
  const db = 20 * Math.log10(Math.max(rms, 1e-9));
  return Math.max(0, Math.min(1, (db + 65) / 50));
}

export type LevelMeter = {
  /** The latest fill, 0 to 1. */
  read: () => number;
  close: () => void;
};

type AudioContextLike = {
  createAnalyser: () => AnalyserNode;
  createMediaStreamSource: (stream: MediaStream) => MediaStreamAudioSourceNode;
  close: () => Promise<void>;
  state?: string;
  resume?: () => Promise<void>;
};

// A context started inside a press (primeAudio), for the next meter to use. Brave refuses a resume that no press
// started, even after the page was pressed, so a meter made later in an effect sat suspended and read silence (owner,
// 2026-11-17); Chrome allows it.
let primed: AudioContextLike | null = null;

// sinkId is newer than TypeScript's DOM types (Chromium 110 onward; other browsers ignore it).
type RecordingOptions = AudioContextOptions & { sinkId?: { type: 'none' } };
type ContextClass = new (options?: RecordingOptions) => AudioContext;

// What a recording's context asks for (liveworkspace/docs/specs/006-media/walkthroughs.md "On no speaker's clock"): no
// output device, so the browser clocks it by wall time rather than by speakers or headphones that may run off true
// (Work Tracker 1314), at 48 kHz, Opus's own rate, so a Bluetooth headset opening at 16 kHz never narrows it. Each is
// dropped in turn for a browser that refuses it: a recording is never lost for want of either.
const RECORDING_OPTIONS: readonly RecordingOptions[] = [
  { sampleRate: 48000, sinkId: { type: 'none' } },
  { sinkId: { type: 'none' } },
];

/** A context for a recording and its meter, which play nothing: on no speaker's clock, at 48 kHz, where allowed. */
export function recordingContext(Context: ContextClass = AudioContext): AudioContext {
  for (const options of RECORDING_OPTIONS) {
    try {
      return new Context(options);
    } catch {
      // Refused: ask with less.
    }
  }
  return new Context();
}

/** Starts the audio a meter will read, inside the press that asks for it (Record Walkthrough). */
export function primeAudio(createContext: () => AudioContextLike = () => recordingContext()): void {
  if (primed && primed.state !== 'closed') return void primed.resume?.().catch(() => {});
  try {
    primed = createContext();
    void primed.resume?.().catch(() => {});
  } catch {
    primed = null;
  }
}

/** The context primeAudio started, while it is open: one a press began, so Brave lets it run. */
export function primedAudio(): AudioContextLike | null {
  return primed && primed.state !== 'closed' ? primed : null;
}

// Still suspended: the next press or key anywhere wakes it.
function resumeOnNextPress(context: AudioContextLike): () => void {
  const wake = () => {
    void context.resume?.().catch(() => {});
    if (context.state !== 'suspended') stop();
  };
  const stop = () => {
    window.removeEventListener('pointerdown', wake, true);
    window.removeEventListener('keydown', wake, true);
  };
  window.addEventListener('pointerdown', wake, true);
  window.addEventListener('keydown', wake, true);
  return stop;
}

/** A meter over a stream's sound. Closing it stops the analysis, never the stream (nor a primed context, kept for the
 *  next one). */
export function levelMeter(
  stream: MediaStream,
  createContext?: () => AudioContextLike,
): LevelMeter {
  const shared = !createContext && primed !== null && primed.state !== 'closed';
  const context = shared ? primed! : (createContext ?? (() => new AudioContext()))();
  let stopWaking = () => {};
  if (context.state === 'suspended') {
    void context.resume?.().catch(() => {});
    if (typeof window !== 'undefined') stopWaking = resumeOnNextPress(context);
  }
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  const source = context.createMediaStreamSource(stream);
  source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  return {
    read: () => {
      analyser.getFloatTimeDomainData(samples);
      return meterFill(rmsOf(samples));
    },
    close: () => {
      stopWaking();
      if (shared) return void source.disconnect?.();
      void context.close().catch(() => {});
    },
  };
}
