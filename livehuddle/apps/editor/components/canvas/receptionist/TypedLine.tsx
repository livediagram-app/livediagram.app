'use client';

// The Receptionist's line, typed out (docs/specs/008-canvas/receptionist.md "Typing"): his words appear a few letters
// at a time, as though he were saying them. The whole line is laid out from the start, hidden, so the bubble keeps
// its size and place while he types; a screen reader hears the whole line at once. Reduced motion shows it whole.

import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/lib/reduced-motion';

/** Letters a second: quick enough that a long answer takes about two seconds. */
export const TYPE_CPS = 90;

/** How many of a line's letters show `ms` after it started. */
export function typedLength(length: number, ms: number): number {
  return Math.max(0, Math.min(length, Math.floor((ms * TYPE_CPS) / 1000)));
}

export function TypedLine({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  // Which line is typing and how far it has got; a new line starts again from nothing.
  const [typed, setTyped] = useState({ text: '', n: 0 });
  const n = reduced ? text.length : typed.text === text ? typed.n : 0;
  useEffect(() => {
    if (reduced) return;
    const start = performance.now();
    let frame = 0;
    const tick = () => {
      const next = typedLength(text.length, performance.now() - start);
      // One render per new letter, never per frame.
      setTyped((t) => (t.text === text && t.n === next ? t : { text, n: next }));
      if (next < text.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, reduced]);
  return (
    <p className={`grid ${className ?? ''}`} aria-live="polite">
      <span className="sr-only">{text}</span>
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {text}
      </span>
      <span
        aria-hidden
        data-typed={n < text.length ? 'typing' : 'done'}
        className="col-start-1 row-start-1"
      >
        {text.slice(0, n)}
      </span>
    </p>
  );
}
