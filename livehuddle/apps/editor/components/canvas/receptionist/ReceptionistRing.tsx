'use client';

// The ring round the real control the Receptionist is talking about (docs/specs/008-canvas/receptionist.md "Asking the Receptionist"), drawn
// over the editor's chrome in the tours' look, for as long as his answer shows. Measured when it opens and when the
// window resizes; a control that is not on screen (a closed minimap, a phone's narrower palette) draws no ring.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Screen px the ring stands off the control's edge.
const PAD = 6;

type Rect = { left: number; top: number; width: number; height: number };

function measure(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return {
    left: r.left - PAD,
    top: r.top - PAD,
    width: r.width + 2 * PAD,
    height: r.height + 2 * PAD,
  };
}

export function ReceptionistRing({ selector }: { selector: string }) {
  const [rect, setRect] = useState<Rect | null>(null);
  useEffect(() => {
    const update = () => setRect(measure(selector));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [selector]);
  if (!rect) return null;
  return createPortal(
    <div
      aria-hidden
      data-receptionist-ring=""
      className="pointer-events-none fixed z-[60] rounded-xl border-2 border-amber-400 shadow-[0_0_0_4px_rgba(245,158,11,0.2),0_0_24px_rgba(245,158,11,0.45)] motion-safe:animate-pulse"
      style={rect}
    />,
    document.body,
  );
}
