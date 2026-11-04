'use client';

// The active tab's text scale for its boards and Plan cards (docs/specs/004-interface-design/fonts.md "Text size on
// boards and cards"). Context rather than a prop, so it reaches a board drawn in a portal (a Dashboard slot, a
// maximised board) without threading through every canvas layer. A number, so a render that leaves the tab's Text
// Size alone re-renders no board through it.
import { createContext, useContext, type ReactNode } from 'react';
import type { TextSize } from '@liveplanner/project';
import { planTextScale } from '@/lib/plan-font';

const PlanTextScaleContext = createContext(1);

export function PlanTextScaleProvider({
  size,
  children,
}: {
  size: TextSize | undefined;
  children: ReactNode;
}) {
  return (
    <PlanTextScaleContext.Provider value={planTextScale(size)}>
      {children}
    </PlanTextScaleContext.Provider>
  );
}

export function usePlanTextScale(): number {
  return useContext(PlanTextScaleContext);
}
