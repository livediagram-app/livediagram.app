// Whether a drawing zone of the open page is being edited (docs/specs/030-knowledgebase/page-surface.md "The
// formatting bar"): the drawing tools show only then, in the formatting controls' place. Set by the writing (the zone
// a zone bar is for), read by the chrome; a plain store, so neither renders the other.
//
// The writing's zone bar follows the pointer and the selection, so it lets go of a zone the moment the pointer leaves
// for the tools. Reaching for the tools must not put them away: once a drawing is being edited it stays so until the
// person does something somewhere else, which is the next press or key outside the strip (`[data-toolbar-palette]`)
// that the writing does not answer by saying a drawing is being edited again (a key only where it types).
import { useSyncExternalStore } from 'react';

const STRIP = '[data-toolbar-palette]';

const inStrip = (node: EventTarget | null): boolean =>
  node instanceof Element && node.closest(STRIP) !== null;

let editing = false;
// The writing said the edit ended; the tools stay until the next press or key elsewhere.
let held = false;
const listeners = new Set<() => void>();

// When the person last did something elsewhere (a press outside the strip, a key where it types), while a drawing
// was being edited. The zone bar letting go right after that is the answer to it, and ends the edit at once.
let elsewhereAt = -Infinity;
/** How long after a press or key elsewhere the writing's "no longer edited" is taken as its answer, ms. */
export const ELSEWHERE_ANSWER_MS = 400;
const noteElsewhere = (event: Event): void => {
  if (elsewhere(event)) elsewhereAt = performance.now();
};

function set(next: boolean): void {
  if (next === editing) return;
  editing = next;
  if (typeof document !== 'undefined') {
    elsewhereAt = -Infinity;
    for (const type of ['pointerdown', 'keydown'])
      if (next) document.addEventListener(type, noteElsewhere, true);
      else document.removeEventListener(type, noteElsewhere, true);
  }
  for (const listener of listeners) listener();
}

// A key ends it only where it types (the writing, a field): on the page itself a key may be a drawing's own (R for a
// square), which the tools being up is what allows.
const typesInto = (node: EventTarget | null): boolean =>
  node instanceof Element && node.closest('[contenteditable="true"], input, textarea') !== null;

const elsewhere = (event: Event): boolean =>
  !inStrip(event.target) && (event.type !== 'keydown' || typesInto(event.target));

function release(event: Event): void {
  if (!held || !elsewhere(event)) return;
  stopHolding();
  set(false);
}

function stopHolding(): void {
  if (!held) return;
  held = false;
  document.removeEventListener('pointerdown', release, true);
  document.removeEventListener('keydown', release, true);
}

export function setDrawingZoneEditing(next: boolean): void {
  if (next) {
    stopHolding();
    set(true);
    return;
  }
  if (!editing || held) return;
  if (typeof document === 'undefined' || performance.now() - elsewhereAt < ELSEWHERE_ANSWER_MS) {
    set(false);
    return;
  }
  held = true;
  document.addEventListener('pointerdown', release, true);
  document.addEventListener('keydown', release, true);
}

/** Nothing edited and nothing held: the page closing, and a test. */
export function resetDrawingZoneEditing(): void {
  stopHolding();
  set(false);
}

/** Whether one is being edited now, for a reader outside React (the keyboard shortcuts). */
export const drawingZoneEditing = (): boolean => editing;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDrawingZoneEditing(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => editing,
    () => false,
  );
}
