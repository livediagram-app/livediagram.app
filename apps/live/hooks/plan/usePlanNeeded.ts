'use client';

// Whether a document needs its items (docs/specs/025-plan/plan-mode.md "Cost"): a document with no Plan
// board or card on the open tab, and no card slide in its deck, never fetches them, so a plain diagram
// pays nothing for Plan. Once needed it stays needed for the session (latched), so moving to a tab
// without Plan content keeps the items it already holds.
import { useState } from 'react';
import type { Element } from '@livediagram/document';

export function hasPlanContent(
  elements: readonly Element[],
  presentation: string | null | undefined,
): boolean {
  return (
    elements.some(
      (el) => el.type === 'shape' && (el.shape === 'plan-board' || el.shape === 'plan-card'),
    ) || !!presentation?.includes('"itemId"')
  );
}

export function usePlanNeeded(
  elements: readonly Element[],
  presentation: string | null | undefined,
): boolean {
  const now = hasPlanContent(elements, presentation);
  const [latched, setLatched] = useState(now);
  // State adjusted during render on the transition (docs/specs/003-system-architecture/react-state-and-effects.md).
  if (now && !latched) setLatched(true);
  return latched || now;
}
