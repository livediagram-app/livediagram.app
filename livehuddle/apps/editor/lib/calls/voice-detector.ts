// The speaker's own voice detection (docs/specs/012-collaboration/proximity-audio.md "The talking equaliser";
// blueprint "Voice detection"): a pure step over the microphone's loudness, deciding what coarse level to send and
// when. Never audio: the room sees a start, a level at most four times a second while it changes, a refresh while it
// holds, and a stop.
import type { VoiceLevel } from '@livehuddle/api-schema';

/** How often the microphone's level is read. */
export const VOICE_SAMPLE_MS = 50;
/** About -34 dBFS: above a quiet room, below a voice. */
export const VOICE_THRESHOLD_RMS = 0.02;
/** How long below the threshold before speaking stops, so pauses between words do not flicker. */
export const VOICE_HANGOVER_MS = 600;
/** The least gap between two level changes on the wire: at most about four a second. */
export const VOICE_MIN_INTERVAL_MS = 250;
/** An unchanged level is sent again this often, so a receiver can tell a long speech from a lost stop. */
export const VOICE_REFRESH_MS = 5000;
/** The level's range, in dBFS: the threshold is level 1, the ceiling level 4. */
export const VOICE_DB_FLOOR = -34;
export const VOICE_DB_CEIL = -10;

export type VoiceState = {
  // The level being shown to others (0: not speaking).
  sent: VoiceLevel;
  // When it was last sent.
  sentAt: number;
  // When the voice was last above the threshold.
  heardAt: number;
};

export const SILENT: VoiceState = { sent: 0, sentAt: -Infinity, heardAt: -Infinity };

/** The level 1 to 4 for a loudness at or above the threshold. */
export function quantiseVoice(rms: number): Exclude<VoiceLevel, 0> {
  const db = 20 * Math.log10(Math.max(rms, 1e-9));
  const t = (db - VOICE_DB_FLOOR) / (VOICE_DB_CEIL - VOICE_DB_FLOOR);
  return Math.max(1, Math.min(4, 1 + Math.floor(t * 4))) as Exclude<VoiceLevel, 0>;
}

/** The root mean square of a block of samples (-1 to 1), as an analyser's time-domain data gives them. */
export function rmsOf(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

/**
 * One sample's step: the next state, and the level to send now (undefined: send nothing). A stop goes out at once; a
 * start and a change wait for VOICE_MIN_INTERVAL_MS since the last send; an unchanged level is refreshed.
 */
export function stepVoice(
  state: VoiceState,
  rms: number,
  now: number,
): { state: VoiceState; send?: VoiceLevel } {
  const loud = rms >= VOICE_THRESHOLD_RMS;
  const heardAt = loud ? now : state.heardAt;
  const speaking = loud || now - heardAt < VOICE_HANGOVER_MS;
  if (!speaking) {
    if (state.sent === 0) return { state: { ...state, heardAt } };
    return { state: { sent: 0, sentAt: now, heardAt }, send: 0 };
  }
  // In the hangover the level holds; while loud it follows the voice.
  const level = loud ? quantiseVoice(rms) : state.sent === 0 ? 1 : state.sent;
  const due =
    level !== state.sent
      ? now - state.sentAt >= VOICE_MIN_INTERVAL_MS
      : now - state.sentAt >= VOICE_REFRESH_MS;
  if (!due) return { state: { ...state, heardAt } };
  return { state: { sent: level, sentAt: now, heardAt }, send: level };
}

/** Muting (or leaving): a stop when the level was showing, then silence. */
export function silenceVoice(
  state: VoiceState,
  now: number,
): { state: VoiceState; send?: VoiceLevel } {
  if (state.sent === 0) return { state: SILENT };
  return { state: { ...SILENT, sentAt: now }, send: 0 };
}
