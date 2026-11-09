// The editor's sound: one AudioContext, made lazily, and sine notes played through it. The Timer's chime
// (docs/specs/009-elements/timer-and-stopwatch.md "The chime"), the reception bell, the join and leave chimes
// (docs/specs/012-collaboration/join-and-leave-sounds.md) and the nudge (docs/specs/012-collaboration/nudge.md) all
// play here. No audio file: every sound is drawn with Web Audio.
//
// Browsers keep a page silent until it is pressed. A context made before that starts suspended; the first press or
// key in the tab resumes it (unlockAudioOnGesture), after which the tab may play while hidden, which is what lets a
// chime reach someone working in another tab.

export type Note = { hz: number; at: number };

let context: AudioContext | null = null;

/** The one context, made on first use; null where there is no Web Audio or the browser refuses one. */
export function audio(): AudioContext | null {
  if (context) return context;
  const Ctor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    return null;
  }
  return context;
}

/** Forget the context (tests). */
export function resetAudio(): void {
  context = null;
}

/**
 * Play sine notes now, each with a soft attack and a fade over `noteS` seconds, at `peak` gain. Silent where the
 * browser refuses sound or has no Web Audio.
 */
export function playTones(notes: readonly Note[], noteS: number, peak: number): void {
  const ctx = audio();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const t0 = ctx.currentTime + 0.02;
    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.hz;
      const start = t0 + note.at;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + noteS);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + noteS + 0.05);
    }
  } catch {
    // A browser that throws on any of it stays silent.
  }
}

const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;
const NOTHING = () => {};

/**
 * Make and resume the context on the first press or key in the tab, so a sound played later (from a room message
 * while the tab is hidden) is heard. Answers the way to stop waiting; the first gesture stops it too, so no listener
 * outlives its use. Already running: nothing to wait for.
 */
export function unlockAudioOnGesture(target: Window = window): () => void {
  if (context?.state === 'running') return NOTHING;
  const stop = () => {
    for (const e of GESTURES) target.removeEventListener(e, unlock, true);
  };
  const unlock = () => {
    stop();
    const ctx = audio();
    if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
  };
  for (const e of GESTURES) target.addEventListener(e, unlock, true);
  return stop;
}
