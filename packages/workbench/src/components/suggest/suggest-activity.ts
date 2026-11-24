// Whether the person is mid-gesture (liveworkspace/docs/specs/016-notifications/suggestions.md "Never mid-gesture"):
// typing, holding a pointer down (a drag, a draw, a resize), or within SUGGEST_IDLE_MS of either. One set of passive
// capture listeners for the page, installed by the first suggestion and kept; each event stores a number and a flag,
// nothing more, so a keystroke or a pointer move costs a few nanoseconds (no pointermove is heard at all).
import { SUGGEST_IDLE_MS } from './suggestions';

let last = 0;
let down = false;
let installed = false;

const touch = () => {
  last = Date.now();
};
const press = () => {
  down = true;
  last = Date.now();
};
const release = () => {
  down = false;
  last = Date.now();
};

/** Hears the page's keys and pointers; once per page. Called from an effect, so only in a browser. */
export function watchActivity(): void {
  if (installed) return;
  installed = true;
  const opts = { capture: true, passive: true } as const;
  window.addEventListener('keydown', touch, opts);
  window.addEventListener('input', touch, opts);
  window.addEventListener('pointerdown', press, opts);
  window.addEventListener('pointerup', release, opts);
  window.addEventListener('pointercancel', release, opts);
  window.addEventListener('wheel', touch, opts);
}

// A field, a text area or editable text with the focus: the person is writing, even between keys.
function typingInFocus(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type;
  return !['button', 'checkbox', 'radio', 'range', 'color', 'submit', 'reset'].includes(type);
}

/** Whether a suggestion must wait: a pointer held, a recent key or press, or typing in focus. */
export function busyNow(now = Date.now()): boolean {
  return down || now - last < SUGGEST_IDLE_MS || typingInFocus();
}

/** Clears what was heard, for tests. */
export function resetActivityForTests(): void {
  last = 0;
  down = false;
}
