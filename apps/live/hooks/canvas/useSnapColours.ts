'use client';

// Snap colours (docs/specs/023-draw-mode/draw-mode.md "Snap colours"): the board's custom colours
// that can become stock colours, and the snap itself, as one commit (one undo step).

import { useMemo } from 'react';
import { snapTabColours, snappableCustomColours, type Element } from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { debugLog } from '@/lib/debug-log';

export type SnapColoursApi = {
  // The distinct custom colours a snap would convert, most recently drawn first.
  colours: string[];
  // The board cannot be edited now: the snap is unavailable.
  blocked: boolean;
  // Snaps them all; returns how many colours were converted (0: nothing happened).
  snap: () => number;
};

export function useSnapColours(deps: {
  elements: readonly Element[];
  // Elements on hidden or locked layers: never changed.
  inertIds: ReadonlySet<string>;
  editsBlocked: boolean;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
}): SnapColoursApi {
  const { elements, inertIds, editsBlocked, commit } = deps;
  const colours = useMemo(() => snappableCustomColours(elements, inertIds), [elements, inertIds]);

  const snap = () => {
    if (editsBlocked || colours.length === 0) {
      debugLog('[snap-colours] nothing to snap', { blocked: editsBlocked });
      return 0;
    }
    let result = { colours: 0, changed: 0 };
    // The live elements, read inside the commit, so an edit since this render is kept.
    commit((els) => {
      const out = snapTabColours(els, inertIds);
      result = out;
      return out.elements;
    });
    if (result.changed === 0) return 0;
    debugLog('[snap-colours] snapped', { colours: result.colours, elements: result.changed });
    track('Draw', 'Changed', 'SnapColours');
    return result.colours;
  };

  return { colours, blocked: editsBlocked, snap };
}
