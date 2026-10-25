'use client';

// The eraser canvas tool (docs/specs/008-canvas/canvas-and-palette.md). Pressing on the canvas deletes
// whatever element is under the pointer; holding and dragging deletes
// everything the drag passes over. The whole press-drag is ONE undo,
// however many elements it removes:
//   - markCheckpoint() once (on the first actual deletion) → single undo,
//     the same checkpoint-then-tick pattern useEditorDrag uses for a move;
//   - tick() per removal for live feedback (no per-element history).
// An empty-canvas press that erases nothing costs no checkpoint (it is
// taken lazily, only when something is removed).
//
// Hit-testing rides the DOM rather than re-deriving per-type geometry:
// every element wrapper (and the arrow hit band) carries data-element-id,
// so document.elementsFromPoint at the pointer resolves what's underneath
// (shapes, arrows, text, images — all of them). Locked elements, and
// everything on a locked tab, are skipped (docs/specs/008-canvas/canvas-and-palette.md Locking).
//
// The Eraser Panel's settings (docs/specs/008-canvas/eraser-panel.md) ride on top of that same hit test:
// a SIZE asks it at a ring of points rather than one, a TARGET filter drops
// what the brush touched but isn't allowed to remove, and TAP mode skips the drag listeners entirely. None of them
// can reach a locked element — that check stays where it was.
//
// Canvas only calls beginErase (from its capture-phase pointerdown, so it
// intercepts before an element's own select/drag); the move + release of
// the gesture are tracked here via window listeners so an erase keeps
// working even if the pointer leaves the canvas surface mid-drag.

import { useEffect, useRef } from 'react';
import { arrowReferencesAny, type Element, type Tab } from '@livedesign/design';

import { elementHostsAtPoint } from '@/lib/dom-hit-test';
import {
  DEFAULT_ERASER_CONFIG,
  eraserAllows,
  eraserRadius,
  eraserSamplePoints,
  type EraserConfig,
} from '@/lib/eraser-config';
import { track } from '@/lib/telemetry';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { beginCanvasGesture } from '@/lib/canvas-gesture';

type EraserDeps = {
  editsBlocked: boolean;
  // The panel's settings (docs/specs/008-canvas/eraser-panel.md). Absent falls back to the original
  // eraser: a one-pixel sweep that removes anything it touches, one element
  // at a time.
  config?: EraserConfig;
  // Elements on a hidden or locked layer (docs/specs/006-design/layers.md): the eraser passes
  // over them like element-locked ones.
  layerInertIds: Set<string>;
  activeId: string;
  activeTab: Tab;
  // Element-level write WITHOUT a fresh history checkpoint (see
  // useEditorHistory.tick) — paired with one markCheckpoint() per gesture.
  tick: (mapElements: (els: Element[]) => Element[]) => void;
  markCheckpoint: () => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
};

export function useCanvasEraser(deps: EraserDeps) {
  // Latest deps for the window listeners: they attach once per gesture but
  // must read fresh state every move (the active tab shrinks as elements
  // are erased). Mirrors useEditorDrag's depsRef pattern.
  const depsRef = useLatest(deps);
  // Ids removed so far this gesture. Dedupes repeat hits as the pointer
  // lingers, and growing it lets the tick filter cascade pinned arrows
  // once an endpoint is erased.
  const erasedRef = useRef<Set<string>>(new Set());
  // Whether this gesture has taken its undo checkpoint yet (taken lazily
  // on the first real deletion so an empty press is a no-op).
  const checkpointedRef = useRef(false);
  // Ends the sweep in flight, if any: its listeners and its canvas gesture.
  const stopSweepRef = useRef<(() => void) | null>(null);

  const checkpointOnce = () => {
    if (checkpointedRef.current) return;
    depsRef.current.markCheckpoint();
    checkpointedRef.current = true;
  };

  // Drop everything erased so far, cascading arrows pinned to it.
  const removeErased = () => {
    checkpointOnce();
    const ids = erasedRef.current;
    depsRef.current.tick((els) =>
      els.filter((el) => {
        if (el.locked === true || depsRef.current.layerInertIds.has(el.id)) return true;
        if (ids.has(el.id)) return false;
        // Drop arrows pinned to an erased element, matching deleteSelected.
        if (el.type === 'arrow' && arrowReferencesAny(el, ids)) return false;
        return true;
      }),
    );
  };

  const eraseAtPoint = (clientX: number, clientY: number) => {
    const { activeTab, layerInertIds } = depsRef.current;
    const config = depsRef.current.config ?? DEFAULT_ERASER_CONFIG;
    let changed = false;
    // One sample for a Point brush; a ring of them for a sized one.
    const samples = eraserSamplePoints(clientX, clientY, eraserRadius(config));
    for (const point of samples) {
      for (const { id } of elementHostsAtPoint(point.x, point.y)) {
        if (erasedRef.current.has(id)) continue;
        const el = activeTab.elements.find((e) => e.id === id);
        // Skip unknown ids (a wrapper for something on another layer) and
        // locked / hidden-or-locked-LAYER elements (protected, docs/specs/006-design/layers.md).
        if (!el || el.locked === true || layerInertIds.has(id)) continue;
        // And skip what the target filter protects — a sweep set to Drawings
        // passes straight over everything else on the canvas.
        if (!eraserAllows(el, config.target)) continue;
        erasedRef.current.add(id);
        changed = true;
      }
    }
    // First removal of the gesture takes the single undo checkpoint.
    if (changed) removeErased();
  };

  const beginErase = (clientX: number, clientY: number) => {
    const { editsBlocked, activeTab, setSelectedId, setEditingId } = depsRef.current;
    if (editsBlocked || activeTab.locked === true) return;
    erasedRef.current = new Set();
    checkpointedRef.current = false;
    // Clear selection so a now-erased element's toolbar disappears.
    setSelectedId(null);
    setEditingId(null);
    eraseAtPoint(clientX, clientY);

    // Tap mode (docs/specs/008-canvas/eraser-panel.md) is one press, one thing: the move listener is what
    // makes a two-pixel wobble take a neighbour with it, so it isn't attached.
    const tapOnly = (depsRef.current.config ?? DEFAULT_ERASER_CONFIG).mode === 'tap';
    const onMove = (ev: PointerEvent) => {
      if (!tapOnly) eraseAtPoint(ev.clientX, ev.clientY);
    };
    const endGesture = beginCanvasGesture('erase');
    const detach = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      endGesture();
      stopSweepRef.current = null;
    };
    // A cancelled sweep ends like a lift: what it already erased is recorded.
    const onUp = () => {
      detach();
      if (erasedRef.current.size > 0) {
        track('Element', 'Deleted', 'Eraser');
      }
      erasedRef.current = new Set();
    };
    stopSweepRef.current?.();
    stopSweepRef.current = detach;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };
  // Unmounting mid-sweep detaches its listeners and closes the gesture.
  useEffect(() => () => stopSweepRef.current?.(), []);

  return { beginErase };
}
