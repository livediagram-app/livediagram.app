import { describe, expect, it } from 'vitest';
import {
  quantiseVoice,
  rmsOf,
  SILENT,
  silenceVoice,
  stepVoice,
  VOICE_HANGOVER_MS,
  VOICE_SAMPLE_MS,
  type VoiceState,
} from './voice-detector';

const LOUD = 0.05;
const QUIET = 0.001;

// Runs the detector over a loudness per sample, answering what went on the wire and when.
function run(levels: number[], from: VoiceState = SILENT) {
  let state = from;
  const sent: [number, number][] = [];
  levels.forEach((rms, i) => {
    const now = i * VOICE_SAMPLE_MS;
    const step = stepVoice(state, rms, now);
    state = step.state;
    if (step.send !== undefined) sent.push([now, step.send]);
  });
  return { state, sent };
}

// docs/specs/012-collaboration/proximity-audio.md "The talking equaliser".
describe('voice detection', () => {
  it('quantises loudness to 1 to 4 and measures RMS', () => {
    expect(quantiseVoice(0.02)).toBe(1);
    expect(quantiseVoice(0.0001)).toBe(1);
    expect(quantiseVoice(0.3)).toBe(4);
    expect(rmsOf(new Float32Array([]))).toBe(0);
    expect(rmsOf(new Float32Array([0.5, -0.5]))).toBe(0.5);
  });

  it('sends a start, holds through pauses shorter than the hangover, then a stop', () => {
    const pause = Math.floor(VOICE_HANGOVER_MS / VOICE_SAMPLE_MS) - 2;
    const { sent } = run([
      LOUD,
      ...Array<number>(pause).fill(QUIET),
      LOUD,
      ...Array<number>(20).fill(QUIET),
    ]);
    expect(sent.map(([, level]) => level)).toEqual([2, 0]);
  });

  it('sends at most four changes a second however the voice moves', () => {
    const wobble = Array.from({ length: 40 }, (_, i) => (i % 2 ? 0.03 : 0.09));
    const { sent } = run(wobble);
    for (let i = 1; i < sent.length; i++)
      expect(sent[i]![0] - sent[i - 1]![0]).toBeGreaterThanOrEqual(250);
    expect(sent.length).toBeLessThanOrEqual(9);
  });

  it('refreshes a held level every five seconds and sends nothing while silent', () => {
    const { sent } = run(Array<number>(220).fill(LOUD));
    expect(sent.map(([at]) => at)).toEqual([0, 5000, 10000]);
    expect(run(Array<number>(40).fill(QUIET)).sent).toEqual([]);
  });

  it('a mute stops a showing level, and silences nothing when already quiet', () => {
    const talking = run([LOUD]).state;
    expect(silenceVoice(talking, 100)).toEqual({ state: { ...SILENT, sentAt: 100 }, send: 0 });
    expect(silenceVoice(SILENT, 100)).toEqual({ state: SILENT });
  });
});
