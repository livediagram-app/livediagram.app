'use client';

// The eraser canvas tool (spec/09). Pressing on the canvas deletes
// whatever element is under the pointer; holding and dragging deletes
// everything the drag passes over. The whole press-drag is ONE undo and
// ONE activity-log entry, however many elements it removes:
//   - markCheckpoint() once (on the first actual deletion) → single undo,
//     the same checkpoint-then-tick pattern useEditorDrag uses for a move;
//   - tick() per removal for live feedback (no per-element log / history);
//   - emitChange(before → after) once on release → single activity entry
//     diffing the whole gesture (the same path multi-delete uses).
// An empty-canvas press that erases nothing costs no checkpoint and no
// entry (the checkpoint is taken lazily, only when something is removed).
//
// Hit-testing rides the DOM rather than re-deriving per-type geometry:
// every element wrapper (and the arrow hit band) carries data-element-id,
// so document.elementsFromPoint at the pointer resolves what's underneath
// (shapes, arrows, text, images — all of them). Locked elements, and
// everything on a locked tab, are skipped (spec/09 Locking).
//
// Canvas only calls beginErase (from its capture-phase pointerdown, so it
// intercepts before an element's own select/drag); the move + release of
// the gesture are tracked here via window listeners so an erase keeps
// working even if the pointer leaves the canvas surface mid-drag.

import { useRef } from 'react';
import type { ChangeLogEntry } from '@livediagram/api-schema';
import type { Element, Tab } from '@livediagram/diagram';
import { arrowReferencesAny } from '@/lib/canvas';
import { track } from '@/lib/telemetry';

type EraserDeps = {
  editsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  // Element-level write WITHOUT a fresh history checkpoint (see
  // useEditorHistory.tick) — paired with one markCheckpoint() per gesture.
  tick: (mapElements: (els: Element[]) => Element[]) => void;
  markCheckpoint: () => void;
  // One activity-log entry for the gesture (diffs before → after). Same
  // emitter the history-aware commit uses, so undo pops the entry in step.
  emitChange: (
    tabId: string,
    before: Element[],
    after: Element[],
    override?: { kind: ChangeLogEntry['kind']; summary: string },
  ) => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
};

export function useCanvasEraser(deps: EraserDeps) {
  // Latest deps for the window listeners: they attach once per gesture but
  // must read fresh state every move (the active tab shrinks as elements
  // are erased). Mirrors useEditorDrag's depsRef pattern.
  const depsRef = useRef(deps);
  depsRef.current = deps;
  // Ids removed so far this gesture. Dedupes repeat hits as the pointer
  // lingers, and growing it lets the tick filter cascade pinned arrows
  // once an endpoint is erased.
  const erasedRef = useRef<Set<string>>(new Set());
  // The pre-gesture element list, for the single end-of-gesture diff.
  const beforeRef = useRef<Element[]>([]);
  // Whether this gesture has taken its undo checkpoint yet (taken lazily
  // on the first real deletion so an empty press is a no-op).
  const checkpointedRef = useRef(false);

  const eraseAtPoint = (clientX: number, clientY: number) => {
    const { activeTab, tick, markCheckpoint } = depsRef.current;
    let changed = false;
    for (const node of document.elementsFromPoint(clientX, clientY)) {
      const host = node.closest('[data-element-id]');
      const id = host?.getAttribute('data-element-id');
      if (!id || erasedRef.current.has(id)) continue;
      const el = activeTab.elements.find((e) => e.id === id);
      // Skip unknown ids (a wrapper for something on another layer) and
      // locked elements (protected from deletion).
      if (!el || el.locked === true) continue;
      erasedRef.current.add(id);
      changed = true;
    }
    if (!changed) return;
    // First removal of the gesture: take the single undo checkpoint now.
    if (!checkpointedRef.current) {
      markCheckpoint();
      checkpointedRef.current = true;
    }
    const ids = erasedRef.current;
    tick((els) =>
      els.filter((el) => {
        if (el.locked === true) return true;
        if (ids.has(el.id)) return false;
        // Drop arrows pinned to an erased element, matching deleteSelected.
        if (el.type === 'arrow' && arrowReferencesAny(el, ids)) return false;
        return true;
      }),
    );
  };

  const beginErase = (clientX: number, clientY: number) => {
    const { editsBlocked, activeTab, setSelectedId, setEditingId } = depsRef.current;
    if (editsBlocked || activeTab.locked === true) return;
    erasedRef.current = new Set();
    beforeRef.current = activeTab.elements;
    checkpointedRef.current = false;
    // Clear selection so a now-erased element's toolbar disappears.
    setSelectedId(null);
    setEditingId(null);
    eraseAtPoint(clientX, clientY);

    const onMove = (ev: PointerEvent) => eraseAtPoint(ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (erasedRef.current.size > 0) {
        track('Element', 'Deleted', 'Eraser');
        // One activity entry for the whole gesture: diff the pre-gesture
        // list against the now-current one.
        const { activeId, activeTab: liveTab, emitChange } = depsRef.current;
        emitChange(activeId, beforeRef.current, liveTab.elements);
      }
      erasedRef.current = new Set();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return { beginErase };
}
