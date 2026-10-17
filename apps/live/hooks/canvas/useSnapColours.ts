'use client';

// Snap colours (docs/specs/023-drawing-mode/drawing-mode.md "Snap colours"): the board's custom colours
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
    // What it will do is read from the elements as they are, not from inside the commit's updater, which React may run
    // later; the commit itself snaps the live elements, so an edit since this render is kept.
    const result = snapTabColours(elements, inertIds);
    if (result.changed === 0) return 0;
    commit((els) => (els === elements ? result.elements : snapTabColours(els, inertIds).elements));
    debugLog('[snap-colours] snapped', { colours: result.colours, elements: result.changed });
    track('Drawing', 'Changed', 'SnapColours');
    return result.colours;
  };

  return { colours, blocked: editsBlocked, snap };
}
