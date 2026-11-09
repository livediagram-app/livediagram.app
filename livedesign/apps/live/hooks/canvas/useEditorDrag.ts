// Drag state machine for the canvas, lifted out of editor-page.tsx so
// the editor route stays focused on top-level orchestration and the
// drag math can be reasoned about (and tested) on its own. Pure
// behavioural extraction: every dispatcher and the global pointer-
// move / pointer-up effect are unchanged from their previous inline
// shape; only the surrounding closure has changed.
//
// Why a hook (not a lib helper): the drag state IS React state
// (setDrag triggers re-render so the wrapper element renders with the
// right cursor + the resize handles see the live drag), and the
// pointer-move effect attaches global listeners that have to be torn
// down via the effect-cleanup convention. Both are React-shaped, so
// they belong in a hook rather than a pure module.
//
// Why a deps ref: the pointer-move effect's listeners need to read
// `activeTab.elements`, `tick`, `zoomRef`, etc. on every move event,
// but we don't want to re-attach those listeners every render. A ref
// gives the effect a stable hook (one attach per drag start) plus a
// fresh view of the parent state on every fire.

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { Element } from '@livedesign/design';
import type { DragState } from '@/lib/canvas';
import type { EditorDragDeps, EditorDragApi } from './useEditorDrag.types';
import type { ShiftDupSwap } from './shift-duplicate-swap';
import { useSnapGuideState } from './useSnapGuideState';
import { useArrowDragHandlers } from './useArrowDragHandlers';
import { useBoxedDragHandlers } from './useBoxedDragHandlers';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { applyOverlay, clearLocalPreview, localPreview, setLocalPreview } from '@/lib/drag-preview';
import { attachDragListeners } from './editor-drag-listeners';

export function useEditorDrag(deps: EditorDragDeps): EditorDragApi {
  const [drag, setDrag] = useState<DragState | null>(null);
  // Alignment guides for the active gesture. Set from the move-effect on
  // every boxed move / single-element resize, cleared on pointer-up. The
  // render layer (CanvasChrome) draws them as faint lines.
  // Cosmetic snap-guide overlay state (alignment + distribution guides,
  // arrow snap markers), coalesced through rAF. See useSnapGuideState.
  const { snapGuideStore, scheduleGuides, scheduleSnapTargets } = useSnapGuideState();
  // Whether the current body drag has crossed DRAG_ENGAGE_PX. Reset at the
  // start of each gesture (in the move effect below); flipped true once the
  // pointer travels far enough that the press is unambiguously a drag.
  const dragEngagedRef = useRef(false);
  // A begin* handler ARMS a checkpoint here instead of taking it at
  // pointer-down. It's flushed lazily on the first real `tick` (the first
  // actual mutation) in the move effect below, so a plain click that
  // selects an element — or a press on a locked element / tab that never
  // mutates — leaves the undo history untouched. Taking the checkpoint at
  // pointer-down pushed a no-op snapshot (and cleared the redo stack) on
  // every click, evicting real states from the bounded HISTORY_LIMIT.
  const checkpointPendingRef = useRef(false);
  // One-shot guard so an arrow-to-arrow connection (docs/specs/008-canvas/arrow-to-arrow.md) is tracked once
  // per endpoint drag, not on every pointer-move tick. Reset on drag start.
  const arrowConnectTrackedRef = useRef(false);
  // Shift-duplicate ghosting (docs/specs/008-canvas/shift-drag-duplicate.md). Holding Shift during a boxed move
  // swaps identities: the ORIGINAL elements park back at their start
  // position (keeping their ids, so every arrow pinned to them stays put),
  // and a fresh CLONE set takes over the cursor, rendered as a translucent
  // ghost. Boundary arrows (pinned to a dragged element from outside the
  // set) are duplicated onto the clones so a copied box keeps its
  // connections. `dupSwapRef` holds what's needed to swing back if Shift
  // is released (a ref, so mid-drag toggles don't churn the
  // pointer-listener effect); `shiftDupGhostIds` is the render-facing set
  // of CLONE ids to draw translucent.
  const dupSwapRef = useRef<ShiftDupSwap | null>(null);
  const [shiftDupGhostIds, setShiftDupGhostIds] = useState<ReadonlySet<string> | null>(null);
  // Stash deps on every render so the move-effect always reads
  // fresh values without re-subscribing global pointer listeners.
  const depsRef = useLatest(deps);
  // The gesture's preview (docs/specs/008-canvas/drag-preview.md): every write a drag makes lands
  // here, not in the design, and the design changes once, on release. `base` is the board as
  // the gesture found it (the overlay is what the gesture changed relative to it, so a
  // collaborator's change to another element is never undone), `virtual` the gesture's own result,
  // which the drag logic reads in place of the written design. Kept across the effect's re-runs
  // within one gesture (a quick-connect arrow turning to follow the pointer).
  const previewRef = useRef<{ tabId: string; base: Element[]; virtual: Element[] } | null>(null);
  const virtualTab = useEffectEvent(() => {
    const tab = depsRef.current.activeTab;
    const p = previewRef.current;
    return p && p.tabId === tab.id ? { ...tab, elements: p.virtual } : tab;
  });
  const previewTick = useEffectEvent((mapper: (els: Element[]) => Element[]) => {
    const tab = depsRef.current.activeTab;
    let p = previewRef.current;
    if (!p) {
      p = { tabId: tab.id, base: tab.elements, virtual: tab.elements };
      previewRef.current = p;
      debugLog('[drag-preview] begin', { tab: tab.id });
    }
    const next = { ...p, virtual: mapper(p.virtual) };
    previewRef.current = next;
    setLocalPreview(next.tabId, next.virtual, next.base);
  });
  // The preview becomes the design in one change: one checkpoint (for an edit of existing
  // elements; a creation drag never arms one), one write.
  const commitPreview = useEffectEvent(() => {
    const p = previewRef.current;
    previewRef.current = null;
    const overlay = localPreview();
    const count = overlay ? overlay.changed.size + overlay.removed.size + overlay.added.length : 0;
    clearLocalPreview(count > 0 ? 'landed' : 'cancelled');
    if (!p || !overlay || count === 0) return;
    if (checkpointPendingRef.current) {
      depsRef.current.markCheckpoint();
      checkpointPendingRef.current = false;
    }
    depsRef.current.tick((els) => applyOverlay(els, overlay));
    debugLog('[drag-preview] commit', { count });
  });
  const cancelPreview = useEffectEvent(() => {
    if (!previewRef.current) return;
    previewRef.current = null;
    clearLocalPreview('cancelled');
    debugLog('[drag-preview] cancel');
  });
  // The canvas going away mid-gesture writes nothing.
  useEffect(() => () => cancelPreview(), []);

  const { beginDrag, beginAnchorDrag, pressArmedAction } = useBoxedDragHandlers({
    depsRef,
    setDrag,
    checkpointPendingRef,
  });

  // Shared opening for every arrow-handle drag: refuse to start while a
  // format-painter gesture is live, then resolve the
  // target as a typed arrow. Returns the deps snapshot + arrow, or null
  // when the drag shouldn't begin. The setSelectedId / locked / style
  // guards stay per-handler because their order differs between gestures.
  const {
    beginArrowTranslate,
    beginEndpointDrag,
    beginArrowCurveDrag,
    beginArrowCurvePointDrag,
    beginArrowBend,
    beginArrowScale,
    deleteCurvePoint,
    beginArrowElbowDrag,
    beginArrowLabelDrag,
  } = useArrowDragHandlers({ depsRef, setDrag, checkpointPendingRef, arrowConnectTrackedRef });

  // Global pointer-move / pointer-up listeners. Attached once per
  // drag-start, torn down when the drag ends. Every fire reads
  // through depsRef so an external state change (zoom, selection,
  // active-tab swap) is reflected without re-attaching. The listeners
  // themselves live in editor-drag-listeners.ts.
  useEffect(() => {
    // A gesture that ended by a route that neither committed nor cancelled keeps its result, as when
    // every tick was a write.
    if (!drag) {
      commitPreview();
      return;
    }
    return attachDragListeners({
      drag,
      depsRef,
      setDrag,
      scheduleGuides,
      scheduleSnapTargets,
      dragEngagedRef,
      checkpointPendingRef,
      arrowConnectTrackedRef,
      dupSwapRef,
      setShiftDupGhostIds,
      virtualTab,
      previewTick,
      commitPreview,
      cancelPreview,
    });
  }, [depsRef, drag, scheduleGuides, scheduleSnapTargets]);

  return {
    drag,
    shiftDupGhostIds,
    snapGuideStore,
    beginDrag,
    beginAnchorDrag,
    pressArmedAction,
    beginArrowTranslate,
    beginEndpointDrag,
    beginArrowCurveDrag,
    beginArrowCurvePointDrag,
    beginArrowBend,
    beginArrowScale,
    deleteCurvePoint,
    beginArrowElbowDrag,
    beginArrowLabelDrag,
  };
}
