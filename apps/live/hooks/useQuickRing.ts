'use client';

// Quick-connect ring open-state, lifted out of Canvas so the canvas body keeps
// to layout + pointer routing. Only one ring opens at a time (the selection
// toolbar dodges the top one via SelectionPopover's forceBelow). The ring
// resets whenever the selection changes, and any pointerdown outside a ring
// (`[data-quick-ring]`) closes it.

import { useEffect, useState } from 'react';
import type { QuickConnectDirection } from '@/lib/canvas';

export function useQuickRing(selectedId: string | null) {
  const [quickRingOpen, setQuickRingOpen] = useState<QuickConnectDirection | null>(null);
  useEffect(() => {
    setQuickRingOpen(null);
  }, [selectedId]);
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
