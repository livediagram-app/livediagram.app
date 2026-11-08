// Arrow-key nudge for the current selection (docs/specs/008-canvas/canvas-and-palette.md Move). Lifted
// out of editor-page.tsx so the burst-coalescing refs live next to
// the handler that uses them (they were 300+ lines apart in the
// page file), and so the burst timer cleans up on unmount instead
// of leaking a setTimeout into a torn-down component.
//
// Behaviour-identical to the prior inline form:
//
//   - Multi-selection wins; otherwise the single selectedId.
//   - 1px move per call: the keyboard hook decides the magnitude
//     (1px plain, 10px with Shift) by passing different (dx, dy).
//   - A run of presses coalesces into one undo step: the first
//     press takes a markCheckpoint, subsequent presses just `tick`
//     the present, and the burst closes after 500ms idle.
//   - Telemetry: one `Element / Changed / Nudge` per burst, never
//     per press.
//   - Boxed elements shift `x`/`y`. A stored arrow never moves
//     (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine").
//   - Suppressed in view-role sessions; the consumer also gates on
//     "is there a typing target focused" upstream.

import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import { useEffect, useRef } from 'react';
import { isBoxed, type Element, type Tab } from '@livehuddle/document';
import { track } from '@/lib/telemetry';

type NudgeDeps = {
  isReadOnly: boolean;
  // Read on each press (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
  activeTab: Tab;
  // History coalescing helpers from useDocumentHistory: the first
  // press of a burst takes a checkpoint, subsequent presses tick.
  markCheckpoint: () => void;
  tick: (mapElements: (els: Element[]) => Element[]) => void;
};

export function useNudgeSelection(deps: NudgeDeps): (dx: number, dy: number) => void {
  const burstActiveRef = useRef(false);
  const burstTimerRef = useRef<number | null>(null);

  // Clear any in-flight burst timer when the host unmounts so the
  // scheduled "close the burst" callback doesn't fire into a dead
  // component (it would touch the refs above, harmless on its own,
  // but a clean teardown is the contract).
  useEffect(() => {
    return () => {
      if (burstTimerRef.current !== null) {
        window.clearTimeout(burstTimerRef.current);
        burstTimerRef.current = null;
      }
    };
  }, []);

  return (dx, dy) => {
    if (deps.isReadOnly) return;
    const { selectedId, multiSelectedIds } = deps.readSelection();
    const picked =
      multiSelectedIds.size > 0
        ? multiSelectedIds
        : selectedId !== null
          ? new Set([selectedId])
          : null;
    if (!picked || picked.size === 0) return;
    const ids = picked;
    // Open a coalescing burst on the first press: checkpoint so undo
    // returns to the pre-nudge state, then only tick until idle.
    if (!burstActiveRef.current) {
      burstActiveRef.current = true;
      deps.markCheckpoint();
      // Telemetry (docs/specs/017-telemetry/telemetry.md): one event per burst, not per press.
      // `type` is a preset, never user content.
      track('Element', 'Changed', 'Nudge');
    }
    if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current);
    burstTimerRef.current = window.setTimeout(() => {
      burstActiveRef.current = false;
      burstTimerRef.current = null;
    }, 500);
    deps.tick((els) =>
      els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, x: el.x + dx, y: el.y + dy } : el)),
    );
  };
}
