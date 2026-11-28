// The timebox's chime (docs/specs/026-plan/session-tabs.md "The progress bar"): two soft notes, E5 then A5, played
// once when a card's time is up, made with Web Audio so there is no file to fetch. Quiet by design; nothing plays where
// the browser has no audio or refuses it (a page nobody has touched yet), and that is never an error.
const NOTES_HZ = [659.25, 880] as const;
const NOTE_S = 0.32;
const GAP_S = 0.16;
const PEAK_GAIN = 0.08;

type AudioCtor = new () => AudioContext;

export function playSessionChime(
  ctor: AudioCtor | undefined = (globalThis as { AudioContext?: AudioCtor }).AudioContext,
): boolean {
  if (!ctor) return false;
  try {
    const audio = new ctor();
    const start = audio.currentTime + 0.02;
    NOTES_HZ.forEach((hz, i) => {
      const at = start + i * (NOTE_S + GAP_S);
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(PEAK_GAIN, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_S);
      osc.connect(gain).connect(audio.destination);
      osc.start(at);
      osc.stop(at + NOTE_S + 0.02);
    });
    // Closed once both notes are done, so a long session holds no audio graph.
    setTimeout(() => void audio.close().catch(() => {}), (NOTE_S * 2 + GAP_S + 0.2) * 1000);
    return true;
  } catch {
    return false;
  }
}
