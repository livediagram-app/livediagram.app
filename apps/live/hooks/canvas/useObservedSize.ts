import { useLayoutEffect, useState, type Ref } from 'react';

export type ObservedSize = { width: number; height: number };

// The size of the element behind an object ref, kept in state by a ResizeObserver, so render reads a
// measurement instead of the DOM (docs/specs/003-system-architecture/react-state-and-effects.md).
//
// Measured once in a layout effect (before paint, so the first frame that shows the element already has
// its size) and again whenever it resizes; never on a pan or a zoom, which move the element's content
// without resizing it. An equal-valued measurement keeps the previous object, so it re-renders nothing.
// Null while inactive, while the ref holds nothing, and for a callback ref (which has nothing to read).
export function useObservedSize(ref: Ref<HTMLElement>, active = true): ObservedSize | null {
  const [size, setSize] = useState<ObservedSize | null>(null);
  useLayoutEffect(() => {
    const node = active && ref && typeof ref === 'object' ? ref.current : null;
    if (!node) return;
    const measure = () => {
      const r = node.getBoundingClientRect();
      setSize((prev) =>
        prev && prev.width === r.width && prev.height === r.height
          ? prev
          : { width: r.width, height: r.height },
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [ref, active]);
  return active ? size : null;
}
