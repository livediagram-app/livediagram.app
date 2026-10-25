'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

// What a tab opens with (docs/specs/008-canvas/canvas-and-palette.md "Motion and animations"): the
// elements in the commit that shows a tab arrive with the board and appear at once; an element
// mounted after that commit was added and pops in. A context rather than a prop, for the reason
// CanvasStillContext is one: the element views are memoised.

// One per canvas: the tab whose first commit has landed. Written only in an effect, after that
// commit, so every element mounted in it still reads the tab as arriving.
type Arrival = { settledTab: RefObject<string | null>; tabId: string } | null;

const CanvasArrivalContext = createContext<Arrival>(null);

export function CanvasArrivalProvider({
  tabId,
  loaded = true,
  children,
}: {
  tabId: string;
  // False while the tab shows its placeholder: the commit that lands its content is the one it arrives in.
  loaded?: boolean;
  children: ReactNode;
}) {
  const settledTab = useRef<string | null>(null);
  useEffect(() => {
    if (loaded) settledTab.current = tabId;
  }, [tabId, loaded]);
  // Changes only on a tab switch, when the tab's elements mount anew anyway.
  const value = useMemo(() => ({ settledTab, tabId }), [tabId]);
  return <CanvasArrivalContext.Provider value={value}>{children}</CanvasArrivalContext.Provider>;
}

// Whether the element calling this is mounting with the board its tab opens with. Read once, as the
// element mounts; outside a provider an element is always an addition.
export function useArrivesWithBoard(): boolean {
  const context = useContext(CanvasArrivalContext);
  const [arrives] = useState(
    () => context !== null && context.settledTab.current !== context.tabId,
  );
  return arrives;
}
