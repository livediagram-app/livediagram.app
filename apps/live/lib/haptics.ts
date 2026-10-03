// A short vibration on a touch screen for the gestures a finger cannot see land
// (docs/specs/007-editor/live-app.md "Mobile chrome"): a long-press that opened a menu, a drag that
// caught an alignment snap, a delete. Android only: Safari has no Vibration API, so it is a no-op
// there, as it is on any device without a motor or a fine pointer (a mouse never buzzes).
export type HapticKind = 'press' | 'snap' | 'delete';

// Durations in ms: a tick for a snap, a firmer tap for a press, a double pulse for a delete.
const PATTERNS: Record<HapticKind, number | number[]> = {
  snap: 8,
  press: 15,
  delete: [12, 40, 12],
};

export function haptic(kind: HapticKind): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  if (typeof window === 'undefined' || !window.matchMedia?.('(pointer: coarse)').matches) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // A browser that blocks vibration (no user activation yet) just stays quiet.
  }
}
