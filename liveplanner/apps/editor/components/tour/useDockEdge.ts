'use client';

// Which edge a phone's mission strip docks at (docs/specs/026-plan/plan-tour.md "Never over what it names"): its usual
// edge (the top while a window or a sheet up from the bottom is open, else the bottom), unless the control its ring
// means sits there, when it docks at the other (pickDockEdge). Measured as the
// ring's target is (every TRACK_MS, as HintRing follows it), and at once when the window or the visible viewport
// resizes (a phone's keyboard), so the strip moves as soon as a panel opens under it.

import { useEffect, useState, type RefObject } from 'react';
import { pickDockEdge } from '@liveworkspace/workbench/components/tour/tour-position';
import { firstDrawn } from './ring-target';

const TRACK_MS = 150;

// A window drawn down to the bottom of the screen (a column's settings, a card's panel: a phone opens them as sheets
// up from the bottom): the strip would sit over it.
function sheetBelow(): boolean {
  for (const el of document.querySelectorAll('[role="dialog"]')) {
    if (el.closest('[data-mission-strip-layer]')) continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.bottom >= window.innerHeight - 1) return true;
  }
  return false;
}

export function useDockEdge({
  on,
  ring,
  sheetRef,
  prefer,
  bottomInset,
}: {
  // Only a phone's sheet moves; elsewhere the usual edge stands and nothing is measured.
  on: boolean;
  ring: string | readonly string[] | null;
  // The sheet, measured for its height.
  sheetRef: RefObject<HTMLElement | null>;
  prefer: 'top' | 'bottom';
  // The footer under a bottom sheet.
  bottomInset: number;
}): 'top' | 'bottom' {
  const [edge, setEdge] = useState(prefer);
  // One string, so a fresh array of the same selectors does not restart the measure.
  const key = ring === null ? '' : typeof ring === 'string' ? ring : ring.join('\n');
  useEffect(() => {
    if (!on) return;
    const selectors = key === '' ? [] : key.split('\n');
    const measure = () => {
      const sheet = sheetRef.current;
      const usual = prefer === 'top' || sheetBelow() ? 'top' : 'bottom';
      setEdge(
        pickDockEdge(firstDrawn(selectors), sheet?.offsetHeight ?? 0, window.innerHeight, usual, {
          bottom: bottomInset,
        }),
      );
    };
    measure();
    const id = window.setInterval(measure, TRACK_MS);
    const vv = window.visualViewport;
    window.addEventListener('resize', measure);
    vv?.addEventListener('resize', measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', measure);
      vv?.removeEventListener('resize', measure);
    };
  }, [on, key, prefer, bottomInset, sheetRef]);
  // Off a phone the usual edge stands, whatever was last measured.
  return on ? edge : prefer;
}
