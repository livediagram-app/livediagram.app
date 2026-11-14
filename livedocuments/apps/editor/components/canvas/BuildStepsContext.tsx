'use client';

// Each built element's step number on the open tab's slides (docs/specs/012-collaboration/presentation-mode.md
// "Setting builds up"), for its badge: worked out once above the canvas, so an element view reads its own number
// without a prop through every view, and a tab where nothing builds resolves no slide at all.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { buildStepsOfTab, type Slide, type Tab } from '@livedocuments/document';

const NONE: ReadonlyMap<string, number> = new Map();
const BuildStepsContext = createContext<ReadonlyMap<string, number>>(NONE);

function sameSteps(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [id, n] of a) if (b.get(id) !== n) return false;
  return true;
}

export function BuildStepsProvider({
  slides,
  tab,
  children,
}: {
  slides: readonly Slide[] | undefined;
  tab: Tab;
  children: ReactNode;
}) {
  // The tab is new on every edit; the map keeps its identity while its numbers hold, so an edit that moves no build
  // re-renders no element view (docs/specs/008-canvas/canvas-performance.md). Adjusted during render, as a value
  // derived from the last one is (docs/specs/003-system-architecture/react-state-and-effects.md).
  const next = useMemo(() => (slides ? buildStepsOfTab(slides, tab) : NONE), [slides, tab]);
  const [kept, setKept] = useState(next);
  const steps = sameSteps(next, kept) ? kept : next;
  if (steps !== kept) setKept(steps);
  return <BuildStepsContext.Provider value={steps}>{children}</BuildStepsContext.Provider>;
}

/** The element's step number among its slide's builds, or undefined when it has no build on a slide. */
export function useBuildStep(id: string): number | undefined {
  return useContext(BuildStepsContext).get(id);
}
