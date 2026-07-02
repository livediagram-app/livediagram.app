// Arrow-key nudge for the current selection (spec/09 Move). Lifted
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
//   - Boxed elements shift `x`/`y`; free arrow endpoints shift
//     `from`/`to`; pinned arrow anchors re-pick their best face via
//     rebindArrowAnchorsAfterMove when the autoRebindArrows pref
//     is on (read through the live ref so the latest value applies
//     without re-mounting the listener).
//   - Suppressed in view-role sessions; the consumer also gates on
//     "is there a typing target focused" upstream.

import { useEffect, useRef, type RefObject } from 'react';
import { isBoxed, rebindArrowAnchorsAfterMove, type Element, type Tab } from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

type NudgeDeps = {
  isReadOnly: boolean;
  multiSelectedIds: Set<string>;
  selectedId: string | null;
  activeTab: Tab;
  // History coalescing helpers from useDiagramHistory: the first
  // press of a burst takes a checkpoint, subsequent presses tick.
  markCheckpoint: () => number;
  tick: (mapElements: (els: Element[]) => Element[]) => void;
  // Debounced activity-log emitter (see useActivityLogDebounce). Called
  // on every press; the 500ms per-key window matches the burst window,
  // so a run of arrow-key presses collapses into ONE "Moved X" entry
  // rather than one per keystroke.
  scheduleElementChangeLog: (
    key: string,
    opts?: { fillToken?: number; onWindowStart?: () => number },
  ) => void;
  // Mutable mirror of the autoRebindArrows preference, kept in sync
  // with userPreferences upstream. Read through the ref so a flip
  // in Settings applies on the next press without re-mounting any
  // listener.
  autoRebindArrowsRef: RefObject<boolean>;
};

export function useNudgeSelection(deps: NudgeDeps): (dx: number, dy: number) => void {
  const burstActiveRef = useRef(false);
  const burstTimerRef = useRef<number | null>(null);
  // The burst's checkpoint token, so the debounced log entry fills THIS
  // burst's undo step (see lib/entry-history).
  const burstTokenRef = useRef<number | undefined>(undefined);

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
    const ids =
      deps.multiSelectedIds.size > 0
        ? deps.multiSelectedIds
        : deps.selectedId !== null
          ? new Set([deps.selectedId])
          : null;
    if (!ids || ids.size === 0) return;
    // Open a coalescing burst on the first press: checkpoint so undo
    // returns to the pre-nudge state, then only tick until idle.
    if (!burstActiveRef.current) {
      burstActiveRef.current = true;
      burstTokenRef.current = deps.markCheckpoint();
      // Telemetry (spec/22): one event per burst, not per press.
      // `type` is a preset, never user content.
      track('Element', 'Changed', 'Nudge');
    }
    if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current);
    burstTimerRef.current = window.setTimeout(() => {
      burstActiveRef.current = false;
      burstTimerRef.current = null;
    }, 500);
    const movedBoxedIds = new Set(
      deps.activeTab.elements.filter((el) => ids.has(el.id) && isBoxed(el)).map((el) => el.id),
    );
    deps.tick((els) => {
      const moved = els.map((el) => {
        if (!ids.has(el.id)) return el;
        if (isBoxed(el)) return { ...el, x: el.x + dx, y: el.y + dy };
        if (el.type === 'arrow') {
          const from =
            el.from.kind === 'free'
              ? { ...el.from, x: el.from.x + dx, y: el.from.y + dy }
              : el.from;
          const to = el.to.kind === 'free' ? { ...el.to, x: el.to.x + dx, y: el.to.y + dy } : el.to;
          return { ...el, from, to };
        }
        return el;
      });
      return deps.autoRebindArrowsRef.current
        ? rebindArrowAnchorsAfterMove(moved, movedBoxedIds)
        : moved;
    });
    // Log the burst as one entry: the first press captures the
    // pre-nudge snapshot, each press resets the 500ms window, and the
    // single flush diffs against the settled position → "Moved X".
    deps.scheduleElementChangeLog('element-nudge', { fillToken: burstTokenRef.current });
  };
}
