// How loud a microphone is, for a level meter: livehuddle's talking equaliser and a walkthrough's recording dock read
// it the same way. Never audio: one number, read when the caller asks.

/** The root mean square of a block of samples (-1 to 1), as an analyser's time-domain data gives them. */
export function rmsOf(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

/** A loudness as a meter's fill, 0 to 1: -50 dBFS (a quiet room) is empty, -10 dBFS (a raised voice) full. */
export function meterFill(rms: number): number {
  const db = 20 * Math.log10(Math.max(rms, 1e-9));
  return Math.max(0, Math.min(1, (db + 50) / 40));
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
};

/** A meter over a stream's sound. Closing it stops the analysis, never the stream. */
export function levelMeter(
  stream: MediaStream,
  createContext: () => AudioContextLike = () => new AudioContext(),
): LevelMeter {
  const context = createContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  context.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  return {
    read: () => {
      analyser.getFloatTimeDomainData(samples);
      return meterFill(rmsOf(samples));
    },
    close: () => void context.close().catch(() => {}),
  };
}
