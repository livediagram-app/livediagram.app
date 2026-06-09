import { useEffect } from 'react';

// Apply the per-user "Reduce motion" preference (spec/20) by toggling the
// `.reduce-motion` class on <html>. The CSS in globals.css keys off that
// class (alongside the OS `prefers-reduced-motion` media query, which is
// always honoured independently) to collapse decorative animations +
// transitions to ~instant.
//
// On <html> rather than a local container so it also covers portalled UI
// (dialogs, popovers, context menus render into document.body, outside the
// editor's DOM subtree). Cleared on unmount / when disabled so navigating
// away or flipping the toggle off restores motion immediately.
export function useReduceMotion(enabled: boolean): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('reduce-motion', enabled);
    return () => root.classList.remove('reduce-motion');
  }, [enabled]);
}
