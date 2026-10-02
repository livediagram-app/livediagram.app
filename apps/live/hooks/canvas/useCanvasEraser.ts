'use client';

// The eraser canvas tool (docs/specs/008-canvas/canvas-and-palette.md). Pressing on the canvas deletes
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
import type { ChangeLogEntry } from '@livediagram/api-schema';
import { arrowReferencesAny, type Element, type Tab } from '@livediagram/document';

import { elementHostsAtPoint } from '@/lib/dom-hit-test';
import {
  DEFAULT_ERASER_CONFIG,
  eraserAllows,
  eraserRadius,
  eraserSamplePoints,
  type EraserConfig,
} from '@/lib/eraser-config';
import { track } from '@/lib/telemetry';
import { useLatest } from '@/hooks/ui/useLatest';
import { beginCanvasGesture } from '@/lib/canvas-gesture';
import { pointerToCanvas } from '@/lib/canvas';
import type { WhiteboardEraserMode } from '@/lib/whiteboard-prefs';
import { WHITEBOARD_ERASER_RADIUS_PX } from '@/lib/whiteboard-tool';
import {
  partialEraseStep,
  pathsTouched,
  shapesTouched,
  strokesTouched,
} from '@/lib/whiteboard-erase';

// Where the transformed canvas sits on screen at the press, so a client point
// maps to canvas coords for the whiteboard's geometric erase.
export type EraseFrame = { left: number; top: number; zoom: number };

type EraserDeps = {
  editsBlocked: boolean;
  // The panel's settings (docs/specs/008-canvas/eraser-panel.md). Absent falls back to the original
  // eraser: a one-pixel sweep that removes anything it touches, one element
  // at a time.
  config?: EraserConfig;
  // Elements on a hidden or locked layer (docs/specs/006-document/layers.md): the eraser passes
  // over them like element-locked ones.
  layerInertIds: Set<string>;
  activeId: string;
  activeTab: Tab;
  // Element-level write WITHOUT a fresh history checkpoint (see
  // useEditorHistory.tick) — paired with one markCheckpoint() per gesture.
  tick: (mapElements: (els: Element[]) => Element[]) => void;
  // Returns the pushed step's undo-marker token (lib/entry-history).
  markCheckpoint: () => number;
  // One activity-log entry for the gesture (diffs before → after). Same
  // emitter the history-aware commit uses; the fill token routes the
  // entry to the gesture's OWN undo step even if another step landed
  // between the checkpoint and the release.
  emitChange: (
    tabId: string,
    before: Element[],
    after: Element[],
    override?: { kind: ChangeLogEntry['kind']; summary: string },
    opts?: { fillToken?: number },
  ) => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  // On a whiteboard (docs/specs/023-whiteboard/whiteboard.md "Eraser"): a stroke is touched where its INK
  // is, and Partial cuts strokes instead of removing them. Null elsewhere.
  whiteboard?: { mode: WhiteboardEraserMode } | null;
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
  // The pre-gesture element list, for the single end-of-gesture diff.
  const beforeRef = useRef<Element[]>([]);
  // Whether this gesture has taken its undo checkpoint yet (taken lazily
  // on the first real deletion so an empty press is a no-op), and the
  // checkpoint's marker token for the end-of-gesture log emit.
  const checkpointedRef = useRef(false);
  const gestureTokenRef = useRef<number | undefined>(undefined);
  // Whiteboard: the press's canvas frame, the previous sample (the brush sweeps
  // the segment between samples, so a fast swipe cannot skip a stroke) and
  // whether a Partial step changed anything.
  const frameRef = useRef<EraseFrame | null>(null);
  const prevRef = useRef<{ x: number; y: number } | null>(null);
  const cutRef = useRef(false);
  // Ends the sweep in flight, if any: its listeners and its canvas gesture.
  const stopSweepRef = useRef<(() => void) | null>(null);

  const checkpointOnce = () => {
    if (checkpointedRef.current) return;
    gestureTokenRef.current = depsRef.current.markCheckpoint();
    checkpointedRef.current = true;
  };

  // The whiteboard's step. Returns false when this is not a whiteboard gesture.
  const whiteboardErase = (clientX: number, clientY: number): boolean => {
    const { whiteboard, activeTab, tick, layerInertIds } = depsRef.current;
    const frame = frameRef.current;
    if (!whiteboard || !frame) return false;
    const rect = { left: frame.left, top: frame.top } as DOMRect;
    const at = pointerToCanvas(clientX, clientY, rect, frame.zoom);
    const from = prevRef.current ?? at;
    prevRef.current = at;
    const screenRadius = WHITEBOARD_ERASER_RADIUS_PX[whiteboard.mode];
    const r = screenRadius / frame.zoom;
    const isProtected = (el: Element) =>
      el.locked === true || depsRef.current.layerInertIds.has(el.id);
    // A path goes whole in either mode (docs/specs/023-whiteboard/path-tool.md "Selecting and erasing").
    let changed = false;
    for (const id of pathsTouched(activeTab.elements, from, at, r, isProtected)) {
      if (erasedRef.current.has(id)) continue;
      erasedRef.current.add(id);
      changed = true;
    }
    if (whiteboard.mode === 'partial') {
      if (changed) removeErased();
      if (strokesTouched(activeTab.elements, from, at, r, isProtected).length === 0) return true;
      checkpointOnce();
      cutRef.current = true;
      tick(
        (els) => partialEraseStep(els, from, at, r, isProtected, () => crypto.randomUUID()) ?? els,
      );
      return true;
    }
    // A shape goes where its outline or visible fill is, never through its empty inside.
    for (const id of [
      ...strokesTouched(activeTab.elements, from, at, r, isProtected),
      ...shapesTouched(activeTab.elements, from, at, r, isProtected),
    ]) {
      if (erasedRef.current.has(id)) continue;
      erasedRef.current.add(id);
      changed = true;
    }
    // Everything else (a note, a text box, a line by its hit band) is touched as on any tab: by the DOM.
    for (const point of eraserSamplePoints(clientX, clientY, screenRadius)) {
      for (const { id } of elementHostsAtPoint(point.x, point.y)) {
        if (erasedRef.current.has(id)) continue;
        const el = activeTab.elements.find((e) => e.id === id);
        if (!el || el.type === 'freehand' || el.type === 'path' || el.type === 'shape') continue;
        if (isProtected(el) || layerInertIds.has(id)) continue;
        erasedRef.current.add(id);
        changed = true;
      }
    }
    if (changed) removeErased();
    return true;
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
    if (whiteboardErase(clientX, clientY)) return;
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
        // locked / hidden-or-locked-LAYER elements (protected, docs/specs/006-document/layers.md).
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

  const beginErase = (clientX: number, clientY: number, frame?: EraseFrame) => {
    const { editsBlocked, activeTab, setSelectedId, setEditingId } = depsRef.current;
    if (editsBlocked || activeTab.locked === true) return;
    erasedRef.current = new Set();
    beforeRef.current = activeTab.elements;
    checkpointedRef.current = false;
    frameRef.current = frame ?? null;
    prevRef.current = null;
    cutRef.current = false;
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
      if (erasedRef.current.size > 0 || cutRef.current) {
        track('Element', 'Deleted', 'Eraser');
        // One activity entry for the whole gesture: diff the pre-gesture
        // list against the now-current one.
        const { activeId, activeTab: liveTab, emitChange } = depsRef.current;
        emitChange(activeId, beforeRef.current, liveTab.elements, undefined, {
          fillToken: gestureTokenRef.current,
        });
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
