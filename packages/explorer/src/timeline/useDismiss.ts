import { useEffect, useRef } from 'react';

/** Closes on a press outside `ref` (and outside `keep`, the control that toggles it) and on Escape, listening only
 *  while `enabled`. */
export function useDismiss(
  ref: { current: HTMLElement | null },
  onDismiss: () => void,
  enabled = true,
  keep?: string,
) {
  const latest = useRef(onDismiss);
  latest.current = onDismiss;
  useEffect(() => {
    if (!enabled) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (keep && target?.closest?.(keep)) return;
      if (ref.current && !ref.current.contains(target)) latest.current();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') latest.current();
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, enabled, keep]);
}
