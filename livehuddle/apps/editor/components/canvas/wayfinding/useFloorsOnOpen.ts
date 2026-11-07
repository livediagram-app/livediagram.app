import { useEffect, useRef, useState } from 'react';
import type { Wayfinding } from './wayfinding-store';

// How long a panel shows a floor as loading before giving up on it (a failed fetch): its arrival row then.
export const FLOOR_WAIT_MS = 8000;

/**
 * Floors nobody has opened yet are fetched on opening a panel, once (docs/specs/009-elements/elevator.md "Floors not
 * opened yet", stairs.md "The panel"). Read once, at opening: the fetch skips loaded tabs and dedupes one in flight,
 * so one ask per opening is enough. Returns true once FLOOR_WAIT_MS has passed, after which a floor still loading is
 * shown as landed rather than loading forever.
 */
export function useFloorsOnOpen(anyLoading: boolean, wayfinding: Wayfinding): boolean {
  const loadingAtOpen = useRef(anyLoading);
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (!loadingAtOpen.current) return;
    wayfinding.actions.loadFloors();
    const t = setTimeout(() => setWaited(true), FLOOR_WAIT_MS);
    return () => clearTimeout(t);
  }, [wayfinding]);
  return waited;
}
