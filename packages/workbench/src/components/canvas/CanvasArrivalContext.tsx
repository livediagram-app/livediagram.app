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

// What appears at once (docs/specs/008-canvas/canvas-and-palette.md "Motion and animations"): the
// elements in the commit that shows a tab arrive with the board, and a burst of elements landing in
// one commit (a big paste, duplicate, undo or import, or a collaborator's) arrives together; both
// appear at once. Any other element mounted later was added and pops in. A context rather than a
// prop, for the reason CanvasStillContext is one: the element views are memoised.

// More elements than this landing in one commit is a burst. Each popping element runs a transform
// animation, which Safari gives a compositing layer of its own, and every element painted over one
// then needs a layer too: a 500-element paste on a 2,600-element board froze an iPad-size WebKit
// for about 7 s with every copy popping, against about 0.4 s with none
// (docs/specs/008-canvas/canvas-performance.md "Adding many elements animates nothing").
export const ARRIVAL_BURST = 24;

// One per canvas: the tab whose first commit has landed, and whether the commit being rendered
// lands a burst. Never changes within a tab, so no element view renders for it.
type Arrival = {
  settledTab: RefObject<string | null>;
  burst: RefObject<boolean>;
  tabId: string;
} | null;

const CanvasArrivalContext = createContext<Arrival>(null);

export function CanvasArrivalProvider({
  tabId,
  loaded = true,
  count,
  children,
}: {
  tabId: string;
  // False while the tab shows its placeholder: the commit that lands its content is the one it arrives in.
  loaded?: boolean;
  // How many elements the tab shows. A render whose count has grown past the last committed one by
  // more than ARRIVAL_BURST lands a burst. Absent, nothing counts as a burst.
  count?: number;
  children: ReactNode;
}) {
  const settledTab = useRef<string | null>(null);
  const committedCount = useRef<number | null>(null);
  const burst = useRef(false);
  // Read by the elements this render mounts, which render after this provider. Derived only from a
  // prop and a count written in an effect, so a render React discards and redoes writes the same
  // value. A ref rather than state or a context value: a burst must change nothing that every element
  // view reads, or each one would render for it; only the views it mounts read it, once.
  /* oxlint-disable react/refs */
  burst.current =
    count !== undefined &&
    committedCount.current !== null &&
    count - committedCount.current > ARRIVAL_BURST;
  /* oxlint-enable react/refs */
  useEffect(() => {
    if (loaded) settledTab.current = tabId;
  }, [tabId, loaded]);
  useEffect(() => {
    committedCount.current = count ?? null;
  }, [count]);
  // Changes only on a tab switch, when the tab's elements mount anew anyway.
  const value = useMemo(() => ({ settledTab, burst, tabId }), [tabId]);
  return <CanvasArrivalContext.Provider value={value}>{children}</CanvasArrivalContext.Provider>;
}

// Whether the element calling this appears at once: it mounts with the board its tab opens with, or
// in a burst. Read once, as the element mounts; outside a provider an element is always an addition.
export function useArrivesWithBoard(): boolean {
  const context = useContext(CanvasArrivalContext);
  const [arrives] = useState(
    () =>
      context !== null && (context.settledTab.current !== context.tabId || context.burst.current),
  );
  return arrives;
}
