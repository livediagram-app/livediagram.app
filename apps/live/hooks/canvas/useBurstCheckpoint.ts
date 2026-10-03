'use client';

import { useRef } from 'react';

// Continuous controls (a slider drag, a colour-picker sweep) fire on
// every tick. Committing each tick would flood the bounded undo stack in
// a single drag, so a burst takes ONE undo step: the first call for a
// key checkpoints, and every call inside the window that follows only
// refreshes the window. Keys are independent, so an opacity drag and a
// fill-colour sweep in parallel stay two separate steps.
//
// 500 ms keeps a fast drag collapsed into one step while two discrete
// clicks 500+ ms apart stay separate steps.
export const BURST_CHECKPOINT_WINDOW_MS = 500;

export function useBurstCheckpoint(markCheckpoint: () => void): (key: string) => void {
  const windows = useRef<Record<string, number | undefined>>({});
  return (key: string) => {
    const open = windows.current[key];
    if (open === undefined) markCheckpoint();
    else window.clearTimeout(open);
    windows.current[key] = window.setTimeout(() => {
      windows.current[key] = undefined;
    }, BURST_CHECKPOINT_WINDOW_MS);
  };
}
