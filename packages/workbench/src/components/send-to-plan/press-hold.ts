// What a send entry read as its press started (liveworkspace/docs/specs/004-index/send-to-plan.md "On a touch screen").
// A tap anywhere but on the words picked clears them before its click lands (iPad Safari, Android Chrome), and the
// press's `mousedown`, the desktop's way to keep them, comes only after the finger lifts. So an entry reads the words on
// `pointerdown` and its click takes them. A hold older than PRESS_HOLD_MS counts for nothing: a press let go elsewhere,
// then a keyboard press later, reads the words as they are then.

/** How long a press's words wait for its click. A tap's click lands well inside it; a long press opens the entry's hint
 *  card and swallows the click (useHint), so nothing waits longer. */
export const PRESS_HOLD_MS = 1000;

export type PressHold<T> = {
  /** Keeps what the press started on. */
  hold(value: T): void;
  /** What the press held, once, while still fresh; undefined when nothing is. */
  take(): T | undefined;
};

export function pressHold<T>(now: () => number = () => Date.now()): PressHold<T> {
  let held: { value: T; at: number } | null = null;
  return {
    hold(value) {
      held = { value, at: now() };
    },
    take() {
      const h = held;
      held = null;
      return h && now() - h.at <= PRESS_HOLD_MS ? h.value : undefined;
    },
  };
}
