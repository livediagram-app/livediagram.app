import { useEffect } from 'react';
import { readUserPreferences } from '@/lib/user-preferences';

// Keep the `.reduce-motion` class on <html> in sync with the user's
// "Reduce motion" preference (spec/20) so flipping the Settings toggle
// takes effect live, without a reload. The CSS in globals.css keys off
// that class (alongside the OS `prefers-reduced-motion` media query, which
// is always honoured independently) to collapse decorative animations +
// transitions to ~instant.
//
// The initial application happens in a pre-paint inline script in
// app/layout.tsx (reading the cached preference) so the class is present
// before any element's one-shot mount animation fires. This hook only has
// to handle runtime changes — and must NOT undo that pre-paint class
// during the brief window before `userPreferences` finishes loading
// (when `enabled` reads a transient false). So it only ADDS on enabled,
// and only REMOVES once the cached preference confirms the user genuinely
// has it off, never on the transient unloaded-false.
export function useReduceMotion(enabled: boolean): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (enabled) {
      root.classList.add('reduce-motion');
    } else if (!readUserPreferences().reduceMotion) {
      root.classList.remove('reduce-motion');
    }
  }, [enabled]);
}
