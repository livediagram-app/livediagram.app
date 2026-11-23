'use client';

import { useCallback, useEffect, useRef, useState, type AnimationEvent } from 'react';

// A list people add rows to and remove rows from never jumps (each app's
// docs/specs/004-interface-design/motion.md "Rows that come and go"): a new row slides in and grows from nothing,
// so the rows under it ease down; a removed row slides out and shrinks, and only then leaves the list. The app's
// slide-row-in / slide-row-out keyframes, 150ms; reduced motion skips them and the change is immediate.
//
// For a list keyed by index (rows with no id of their own). Spread `rowProps(i)` on each row's wrapper, call
// `enter(i)` as a row is added at `i`, and `leave(i, commit)` in place of removing it: `commit` runs when it is gone.

// Past the keyframes' 150ms: the fallback for a browser that never fires animationend (reduced motion drops the
// animation, a hidden tab pauses it).
const LEAVE_FALLBACK_MS = 260;

// No matchMedia (a test's DOM) counts as reduced: the change is immediate.
const reducedMotion = () =>
  typeof window === 'undefined' ||
  !window.matchMedia ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useRowMotion() {
  const [entering, setEntering] = useState<number | null>(null);
  const [leaving, setLeaving] = useState<number | null>(null);
  const commit = useRef<(() => void) | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const finish = useCallback(() => {
    window.clearTimeout(timer.current);
    const run = commit.current;
    commit.current = null;
    setLeaving(null);
    run?.();
  }, []);

  // Closed mid-exit (the dialog shut): the removal still happens.
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      commit.current?.();
      commit.current = null;
    },
    [],
  );

  return {
    /** The row that is on its way out, if any: its controls should not be pressed again. */
    leaving,
    enter: (index: number) => {
      if (!reducedMotion()) setEntering(index);
    },
    leave: (index: number, run: () => void) => {
      // One at a time: a second removal finishes the first at once.
      if (commit.current) finish();
      if (reducedMotion()) return run();
      commit.current = run;
      setLeaving(index);
      timer.current = window.setTimeout(finish, LEAVE_FALLBACK_MS);
    },
    rowProps: (index: number) => ({
      // Clipped only while it moves: at rest a focus ring must not be cut off.
      className:
        index === leaving
          ? 'pointer-events-none overflow-hidden animate-slide-row-out'
          : index === entering
            ? 'overflow-hidden animate-slide-row-in'
            : '',
      onAnimationEnd: (e: AnimationEvent<HTMLElement>) => {
        if (e.target !== e.currentTarget) return;
        if (index === leaving) finish();
        else if (index === entering) setEntering(null);
      },
    }),
  };
}
