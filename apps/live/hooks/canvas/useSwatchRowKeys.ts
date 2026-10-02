'use client';

// Arrow keys along a row of swatches (docs/specs/023-draw-mode/draw-mode.md "The colour picker"):
// Left and Right move (held at the ends), Home and End jump to the ends. Focus moves, nothing is
// picked: Enter or Space on a swatch picks it. One swatch is the row's Tab stop (roving tabindex).

import { useRef, type KeyboardEvent } from 'react';

export function useSwatchRowKeys(count: number) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target =
      e.key === 'ArrowRight'
        ? Math.min(count - 1, index + 1)
        : e.key === 'ArrowLeft'
          ? Math.max(0, index - 1)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? count - 1
              : null;
    if (target === null) return;
    e.preventDefault();
    e.stopPropagation();
    if (target !== index) refs.current[target]?.focus();
  };
  const ref = (index: number) => (node: HTMLButtonElement | null) => {
    refs.current[index] = node;
  };
  const focus = (index: number) => refs.current[Math.min(index, count - 1)]?.focus();
  return { ref, onKeyDown, focus };
}
