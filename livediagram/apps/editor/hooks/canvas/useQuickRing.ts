'use client';

// Quick-connect ring open-state, lifted out of Canvas so the canvas body keeps
// to layout + pointer routing. Only one ring opens at a time (the selection
// toolbar dodges the top one via SelectionPopover's forceBelow). The ring
// resets whenever the selection changes, and any pointerdown outside a ring
// (`[data-quick-ring]`) closes it.

import { useEffect, useState } from 'react';
import type { QuickConnectDirection } from '@/lib/canvas';
import type { SelectionStore } from '@/lib/selection-store';

export function useQuickRing(selection: SelectionStore) {
  const [quickRingOpen, setQuickRingOpen] = useState<QuickConnectDirection | null>(null);
  // A change of the selected element closes the ring. Watched on the store, not read in render, so
  // the canvas does not re-render for the selection; closing an already-closed ring is a no-op.
  useEffect(() => {
    let ringSelection = selection.get().selectedId;
    return selection.subscribe(() => {
      const { selectedId } = selection.get();
      if (selectedId === ringSelection) return;
      ringSelection = selectedId;
      setQuickRingOpen(null);
    });
  }, [selection]);
  useEffect(() => {
    if (!quickRingOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement)?.closest?.('[data-quick-ring]')) setQuickRingOpen(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [quickRingOpen]);
  return [quickRingOpen, setQuickRingOpen] as const;
}
