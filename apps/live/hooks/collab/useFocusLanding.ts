import { useCallback, useRef } from 'react';

// Where taking a Bring Focus invitation lands you (docs/specs/012-collaboration/bring-focus.md "Where it
// takes you"). On your own tab only the pan moves: the zoom you chose for that canvas is yours. On another
// tab there is no zoom of yours for that canvas yet, so the tab enters as it always does (its fit), and the
// point is centred at the zoom that fit gave. Keeping the zoom fitted to the tab you left instead could land
// a small diagram at the 8% a huge one needed. `land` is what arriving does once the tab is the right one:
// centre the point.
export function useFocusLanding({
  activeId,
  setActiveId,
  land,
}: {
  activeId: string;
  setActiveId: (tabId: string) => void;
  land: (tabId: string, at: { x: number; y: number }) => void;
}): {
  onFollowTab: (tabId: string) => void;
  onCentreOn: (at: { x: number; y: number }) => void;
  /** Run after a tab-entry fit: centres a point that is waiting for this tab's fit. */
  afterTabFit: (tabId: string) => void;
} {
  // The tab being switched to, then the point to centre once it has fitted.
  const pending = useRef<{ tabId: string; at: { x: number; y: number } | null } | null>(null);

  const onFollowTab = useCallback(
    (tabId: string) => {
      if (tabId === activeId) {
        pending.current = null;
        return;
      }
      pending.current = { tabId, at: null };
      setActiveId(tabId);
    },
    [activeId, setActiveId],
  );

  const onCentreOn = useCallback(
    (at: { x: number; y: number }) => {
      // Crossing tabs: centring now would aim the canvas being left, so the point waits for the fit.
      if (pending.current && pending.current.at === null) pending.current.at = at;
      else land(activeId, at);
    },
    [activeId, land],
  );

  const afterTabFit = useCallback(
    (tabId: string) => {
      const landing = pending.current;
      if (!landing?.at) return;
      // Another tab fitted first (they moved on before this one loaded): the landing is stale.
      pending.current = null;
      if (landing.tabId === tabId) land(tabId, landing.at);
    },
    [land],
  );

  return { onFollowTab, onCentreOn, afterTabFit };
}
