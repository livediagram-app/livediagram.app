'use client';

import { useEffect, useRef, useState } from 'react';

// The "Copied" label that appears on a copy button and fades back after a
// beat. Six surfaces across the editor and this package had their own copy of
// the flag and its timer, and they had drifted into five different behaviours:
// resets at 1500ms, 1800ms and 2000ms, two with no reset at all, and only one
// that cleared a still-pending timer when you clicked twice.
//
// None of them cleared the timer on unmount, so closing a dialog while the
// label was showing left a timeout to set state on a component that had gone.
//
// This owns ONLY the flag and its lifetime. Writing to the clipboard stays
// with the caller, because what happens when the write FAILS is genuinely
// per-surface: the share dialog toasts an error, the poll panel stays quiet
// because the results are still on screen, and the team invite falls back to a
// selectable field. The one rule they share is the one worth enforcing here:
// flash only on success, so a blocked clipboard never says "Copied".
//
// Generic over the flashed value so a surface with several copy buttons can
// flash WHICH one was copied (the share dialog flashes a share code) while the
// common case just flashes `true`.
export function useCopiedFlash<T = true>(
  resetMs = 1500,
): { copied: T | null; flash: (value?: T) => void; reset: () => void } {
  const [copied, setCopied] = useState<T | null>(null);
  const timer = useRef<number | null>(null);

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const flash = (value?: T) => {
    // Clearing first is what makes a second click restart the countdown
    // rather than inherit the remainder of the first one's.
    clear();
    setCopied((value ?? true) as T);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setCopied(null);
    }, resetMs);
  };

  // Clear it now rather than waiting out the delay. Callers need this when the
  // thing that was copied stops being current: a dialog reopening, or a fresh
  // invite link replacing the one whose "Copied" is still showing.
  const reset = () => {
    clear();
    setCopied(null);
  };

  useEffect(() => clear, []);

  return { copied, flash, reset };
}
