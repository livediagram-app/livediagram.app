import { HINT_TOUCH_COMPAT_MS } from './hint-constants';

// Phones and emulators follow a tap with compatibility mouse events at the tap point. When the tap closes a dialog,
// the control that was under the finger gets a mouse `pointerenter` that nobody made, and its hint would open and stay
// (a mouse leaves only when it moves). A hint asks here whether a touch just ended, and ignores a mouse that arrives
// inside HINT_TOUCH_COMPAT_MS of one.
let lastTouchAt = Number.NEGATIVE_INFINITY;
let listening = false;

// Listening starts when the first hint mounts. Two passive capture listeners on the document, installed once.
export function watchTouches(): void {
  if (listening) return;
  listening = true;
  const note = (e: PointerEvent) => {
    if (e.pointerType === 'touch') lastTouchAt = Date.now();
  };
  const options = { capture: true, passive: true } as const;
  document.addEventListener('pointerdown', note, options);
  document.addEventListener('pointerup', note, options);
}

export function touchedRecently(now: number): boolean {
  return now - lastTouchAt < HINT_TOUCH_COMPAT_MS;
}

export function resetTouches(): void {
  lastTouchAt = Number.NEGATIVE_INFINITY;
}
