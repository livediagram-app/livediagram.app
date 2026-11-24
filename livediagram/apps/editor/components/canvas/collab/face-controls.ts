'use client';

// A collaboration element's own main controls (docs/specs/008-canvas/element-menu-quick-bar.md "Kind tools"): a
// quiz's Edit Question, Start, Reveal Answer and Reset, a done check's Reset Everyone, an idea box's Empty the Box.
// Each face knows what it can do now (its phase, who is asking), so the face publishes them and the canvas hands the
// selected element's to its kind tools: the same verbs as the face's own "..." menu, in the Quick Style panel and the
// element menu's bar.
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';

export type FaceControlIcon = 'edit' | 'start' | 'lock' | 'reveal' | 'reset' | 'clear';
export type FaceControl = {
  key: string;
  label: string;
  description: string;
  icon: FaceControlIcon;
  run: () => void;
};

const NONE: readonly FaceControl[] = [];
const offers = new Map<string, readonly FaceControl[]>();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const tell = () => listeners.forEach((l) => l());
const shape = (c: readonly FaceControl[]) => c.map((x) => `${x.key}:${x.label}`).join('|');

/** A face: what it can do now. Entries that are false, null or undefined are left out. */
export function usePublishFaceControls(
  id: string,
  controls: readonly (FaceControl | false | null | undefined)[],
): void {
  const mine = useRef<readonly FaceControl[] | null>(null);
  useLayoutEffect(() => {
    const next = controls.filter((c): c is FaceControl => !!c);
    const had = offers.get(id) ?? NONE;
    // The latest closures always; readers are told only when what is on offer changes.
    if (shape(had) === shape(next) && had.length === next.length && had.length > 0) {
      had.forEach((c, i) => (c.run = next[i]!.run));
      mine.current = had;
      return;
    }
    if (next.length) offers.set(id, next);
    else offers.delete(id);
    mine.current = next.length ? next : null;
    if (shape(had) !== shape(next)) tell();
  });
  useLayoutEffect(
    () => () => {
      if (mine.current && offers.get(id) === mine.current) {
        offers.delete(id);
        tell();
      }
    },
    [id],
  );
}

/** The canvas: the controls of the element with this id, or none. */
export function useFaceControls(id: string | null | undefined): readonly FaceControl[] {
  return useSyncExternalStore(
    subscribe,
    () => (id ? (offers.get(id) ?? NONE) : NONE),
    () => NONE,
  );
}
