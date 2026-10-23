'use client';

// The three markers' settings (docs/specs/023-draw-mode/drawing-tools.md "Markers"): each one's
// colour and width, device-local, as a logo page's Draw, the markers' flyout and the quick style
// panel's pen rows read and change them.

import { useState } from 'react';
import type { PenColour } from '@livedesign/design';
import { track } from '@/lib/telemetry';
import {
  loadWhiteboardPrefs,
  saveWhiteboardPrefs,
  type WhiteboardPenId,
  type WhiteboardPrefs,
} from '@/lib/whiteboard-prefs';

export type MarkerPensModel = ReturnType<typeof useMarkerPens>;

export function useMarkerPens() {
  // Read lazily from this browser (readLocalStorageSafe copes with no storage).
  const [prefs, setPrefs] = useState<WhiteboardPrefs>(loadWhiteboardPrefs);

  const updatePen = (id: WhiteboardPenId, patch: { colour?: PenColour | null; width?: number }) => {
    const next = { pens: prefs.pens.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
    setPrefs(next);
    saveWhiteboardPrefs(next);
    if (patch.colour !== undefined) track('Draw', 'Changed', 'PenColour');
    if (patch.width !== undefined) track('Draw', 'Changed', 'PenWidth');
  };

  return { prefs, updatePen };
}
