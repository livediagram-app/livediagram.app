'use client';

import { useEffect, useEffectEvent, useMemo, useRef, useState, type RefObject } from 'react';
import { cursorsNearKey, type ClientPoint, type HoverCursor } from '../../lib/cursor-hover';

const NONE: ReadonlySet<string> = new Set();

// The remote cursors this screen's pointer is over or near (docs/specs/012-collaboration/collaborator-enhancements.md
// "Cursors Step Aside"), so the layer can fade them out of the way while it is there.
//
// The cost stays off the hot path: one passive pointermove listener while any cursor is drawn, at most one check
// per animation frame, and each check is one rect read (the layer's anchor at canvas (0, 0)) plus arithmetic per
// cursor (cursor-hover.ts). It renders only when the set near the pointer changes, never per move. A touch has
// no hover, so only a mouse or a pen counts; a touch drops whatever a pen left faded.
export function useCursorsNearPointer(
  cursors: readonly HoverCursor[],
  zoom: number,
  anchorRef: RefObject<HTMLElement | null>,
): ReadonlySet<string> {
  const [key, setKey] = useState('');
  const pointer = useRef<ClientPoint | null>(null);
  const frame = useRef(0);
  const drawn = cursors.length > 0;

  const check = useEffectEvent(() => {
    const anchor = anchorRef.current;
    const at = pointer.current;
    let next = '';
    if (anchor && at) {
      const origin = anchor.getBoundingClientRect();
      next = cursorsNearKey(cursors, at, { x: origin.left, y: origin.top }, zoom);
    }
    setKey((prev) => (prev === next ? prev : next));
  });

  const schedule = useEffectEvent(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      check();
    });
  });

  useEffect(() => {
    if (!drawn) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (!pointer.current) return;
        pointer.current = null;
      } else {
        pointer.current = { x: e.clientX, y: e.clientY };
      }
      schedule();
    };
    const onLeave = () => {
      pointer.current = null;
      schedule();
    };
    const root = document.documentElement;
    window.addEventListener('pointermove', onMove, { capture: true, passive: true });
    // A wheel pans or zooms the canvas under a still pointer.
    window.addEventListener('wheel', schedule, { capture: true, passive: true });
    root.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove, { capture: true });
      window.removeEventListener('wheel', schedule, { capture: true });
      root.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      pointer.current = null;
      setKey('');
    };
  }, [drawn]);

  // A cursor that moves onto (or off) a still pointer steps aside (or back) too.
  useEffect(() => {
    if (pointer.current) schedule();
  }, [cursors, zoom]);

  return useMemo(() => (key ? new Set(key.split('\n')) : NONE), [key]);
}
