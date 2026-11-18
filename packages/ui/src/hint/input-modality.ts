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
  hoverQuery = undefined;
}

// Whether any pointer on this device can hover (`(any-hover: hover)`). A phone's or a touch-only tablet's cannot: every
// mouse event there is an echo of a tap, even one arriving long after it (a tapped tab pill moves the presence avatars
// under the finger, and the browser's own mouse move over them is no hover). One media query, read on each ask, so a
// trackpad attached later counts. Without matchMedia (a test DOM), it can.
let hoverQuery: MediaQueryList | null | undefined;
export function canHover(): boolean {
  if (hoverQuery === undefined)
    hoverQuery = typeof matchMedia === 'function' ? matchMedia('(any-hover: hover)') : null;
  return hoverQuery?.matches ?? true;
}
