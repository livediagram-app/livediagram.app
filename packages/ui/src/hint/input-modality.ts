// Whether the last thing the person did was press with a pointer (touch, pen or mouse) rather than a key. A browser
// decides `:focus-visible` for script focus from its own guess, and some engines (an emulated phone, WebKit) guess
// "keyboard" when a dialog hands focus back to its opener after a tap. A hint opens on keyboard focus only, so it asks
// here: focus that follows a press, with no key since, is not keyboard focus. Before any input, focus counts as keyboard
// (tests focus with no input at all, and a keyboard user's first act is a key).
let lastInputWasPointer = false;
let listening = false;

// Listening starts when the first hint mounts, so the press that precedes a focus is never missed. Two passive
// capture listeners on the document, installed once.
export function watchInputModality(): void {
  if (listening) return;
  listening = true;
  const options = { capture: true, passive: true } as const;
  document.addEventListener('pointerdown', () => (lastInputWasPointer = true), options);
  document.addEventListener('keydown', () => (lastInputWasPointer = false), options);
}

export function lastInputWasPress(): boolean {
  return lastInputWasPointer;
}

export function resetInputModality(): void {
  lastInputWasPointer = false;
}
