'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import {
  continuedPath,
  defaultFillColor,
  defaultStrokeColor,
  resolveStockColours,
  pathAnchors,
  pathGeometry,
  reshapeContour,
  reshapePath,
  type Element,
  type PathAnchor,
  type PathElement,
} from '@livedesign/design';
import type { PendingDraw } from '@/lib/draw-mode';
import { rubberBand } from '@/lib/path-draw';
import { sharedNodeType, toWorld } from '@/lib/path-edit';
import type { CanvasTool } from '@/components/palette/palette.types';
import type { PathEditKind } from '@/hooks/canvas/usePathCommits';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { usePathDrawGesture, type PathCommit } from './usePathDrawGesture';
import { usePathEditGesture } from './usePathEditGesture';
import { usePathContour } from './usePathContour';
import { isSimplifiable, simplifyContour } from '@/lib/path-simplify';
import type { PathDraftView } from './PathDraftLayer';
import type { PathEditView } from './PathEditLayer';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { useToast } from '@/hooks/ui/useToast';
import { inkPath } from '@/lib/whiteboard-tool';

// A press on a toolbar floating over the canvas (the selection toolbar, the edit toolbar) is a
// button press, never a node.
const onToolbar = (e: React.PointerEvent) =>
  !!(e.target as HTMLElement | null)?.closest?.('[data-canvas-toolbar]');

// The id the path being drawn renders under: it has no element yet.
const PATH_DRAFT_ID = 'path-draft';

const identity = <T>(el: T): T => el;

// The Path tool on the canvas (docs/specs/023-draw-mode/path-tool.md): composes the drawing
// gesture and the edit mode for Canvas, which wires in four things with the smallest edit to
// itself: the press intercepts, the elements it shows (a path being continued is drawn by the
// draft, a path being edited shows the gesture's anchors), and the two layers it draws in the
// transformed canvas.
export function usePathTool({
  pendingDraw,
  canvasTool,
  elements,
  inertIds,
  wrapperRef,
  viewportZoom,
  activeTabId,
  editingId,
  soleSelectedPathId,
  onCommitPath,
  onCommitPathEdit,
  onDressPath = identity,
  onLeaveEdit,
  onDeselect,
  onBeginEdit,
  onCancelDraw,
  snapPoint,
}: {
  pendingDraw: PendingDraw | null;
  canvasTool: CanvasTool;
  elements: Element[];
  inertIds?: ReadonlySet<string>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  viewportZoom: number;
  activeTabId?: string;
  editingId: string | null;
  // The path that is the one selected element, if any (Canvas reads it from the selection store,
  // narrowed to paths, so selecting anything else does not re-render the canvas).
  soleSelectedPathId: string | null;
  onCommitPath: (commit: PathCommit) => void;
  onCommitPathEdit: (
    id: string,
    next: { anchors: PathAnchor[]; closed: boolean },
    kind: PathEditKind,
    contour?: number,
  ) => void;
  onDressPath?: <T extends Element>(el: T) => T;
  onLeaveEdit: () => void;
  onDeselect: () => void;
  onBeginEdit: (id: string) => void;
  // Puts a held tool down: opening a path's edit mode puts the Path tool down first.
  onCancelDraw: () => void;
  // Where a click places a node instead (usePathDrawGesture).
  snapPoint?: (p: { x: number; y: number }) => { x: number; y: number } | null;
}) {
  const surface = useCanvasSurface();
  const toast = useToast();
  const draw = usePathDrawGesture({
    pendingDraw,
    elements,
    inertIds,
    wrapperRef,
    viewportZoom,
    activeTabId,
    onCommitPath,
    onStartPath: onDeselect,
    snapPoint,
  });
  const openEdit = (id: string) => {
    if (pendingDraw) onCancelDraw();
    onBeginEdit(id);
  };

  // Edit mode: the path being edited, while Select is in hand and it can be edited at all (a
  // combined path one contour at a time, usePathContour).
  const pathOf = (id: string | null): PathElement | null => {
    const el = id ? elements.find((e) => e.id === id) : undefined;
    return el?.type === 'path' && el.locked !== true && !inertIds?.has(el.id) ? el : null;
  };
  const editable = canvasTool === 'select' && pendingDraw === null;
  const edited = pathOf(editingId);
  const editing = editable ? edited : null;
  // A tool picked, the path locked, out of reach or deleted (by a peer too): edit mode leaves.
  const stale =
    editingId !== null && elements.some((e) => e.id === editingId && e.type === 'path') && !editing;
  const lastEditedRef = useRef<string | null>(null);
  useEffect(() => {
    const vanished = !editing && editingId !== null && editingId === lastEditedRef.current;
    lastEditedRef.current = editing?.id ?? null;
    if (!stale && !vanished) return;
    debugLog(`[path] edit left: ${vanished && !stale ? 'path gone' : 'no longer editable'}`);
    onLeaveEdit();
  }, [stale, editing, editingId, onLeaveEdit]);
  const contour = usePathContour({ editing, elements, wrapperRef, viewportZoom });
  const contourIndex = contour.compound ? contour.index : undefined;
  const edit = usePathEditGesture({
    // A combined path's contour as a path of its own; its edits land on that contour.
    element: contour.element,
    selectedPathId: editingId === null ? (pathOf(soleSelectedPathId)?.id ?? null) : null,
    wrapperRef,
    viewportZoom,
    onCommitPathEdit: (id, next, kind) => {
      // Closing and opening are the whole path's, never one contour's (J included).
      if (contourIndex !== undefined && editing && next.closed !== editing.closed) return;
      onCommitPathEdit(id, next, kind, contourIndex);
    },
    onLeave: onLeaveEdit,
    onDeselect,
    onBeginEdit: openEdit,
    contour: contour.index,
    snapOthers: contour.others?.points,
    snapToPage: snapPoint,
    onEmptyPress: contour.pickAt,
  });

  const { draft } = draw;
  const continuingId = draft?.continuing?.id ?? null;

  // The path as it will land, displayed as the canvas displays that element (from its first node,
  // so the rubber band wears its style too; the layer draws the path once it has two).
  const element = useMemo((): PathElement | null => {
    if (!draft || draft.anchors.length === 0) return null;
    const original = continuingId ? elements.find((el) => el.id === continuingId) : undefined;
    const base =
      original?.type === 'path'
        ? continuedPath(original, draft.anchors, false)
        : onDressPath<PathElement>(
            inkPath({
              id: PATH_DRAFT_ID,
              type: 'path',
              ...pathGeometry(draft.anchors, false),
              closed: false,
            }),
          );
    // As it will land (usePathCommits): Ink by name, drawn in its version for this canvas.
    return resolveStockColours(base, surface);
  }, [draft, continuingId, elements, onDressPath, surface]);

  const editDraft = edit.draft;
  const editingPathId = editing?.id ?? null;
  const shownElements = useMemo(() => {
    if (continuingId) return elements.filter((el) => el.id !== continuingId);
    if (editingPathId && editDraft) {
      return elements.map((el) => {
        if (el.id !== editingPathId || el.type !== 'path') return el;
        return contourIndex === undefined
          ? reshapePath(el, editDraft, el.closed)
          : (reshapeContour(el, contourIndex, editDraft) ?? el);
      });
    }
    return elements;
  }, [elements, continuingId, editingPathId, editDraft, contourIndex]);

  const draftView: PathDraftView | null =
    draft && element
      ? {
          element,
          stroke: element.strokeColor ?? defaultStrokeColor(element, surface),
          fill: element.fillColor ?? defaultFillColor(element, surface),
          anchors: draft.anchors,
          active: draw.dragIndex ?? draft.anchors.length - 1,
          allHandles: draw.editPointer,
          band:
            draw.dragIndex === null && !draw.editPointer && draw.cursor
              ? rubberBand(draft, draw.cursor, draw.shift)
              : null,
          ring: draw.ring,
          zoom: viewportZoom,
        }
      : draw.ring
        ? {
            element: null,
            stroke: 'transparent',
            fill: 'transparent',
            anchors: [],
            active: null,
            band: null,
            ring: draw.ring,
            zoom: viewportZoom,
          }
        : null;

  const shape = contour.element;
  const editView: PathEditView | null =
    editing && shape
      ? {
          frame: editing,
          anchors: editDraft ?? pathAnchors(shape),
          closed: editing.closed,
          others: contour.others?.d ?? null,
          selected: edit.selected,
          box: edit.box,
          guides: edit.guides,
          zoom: viewportZoom,
        }
      : null;

  // The edit toolbar: above the path, or above the node a long-press chose.
  const toolbarAnchors = shape ? (editDraft ?? pathAnchors(shape)) : [];
  const heldNode = editing && edit.toolbarAt !== null ? toolbarAnchors[edit.toolbarAt] : undefined;
  const heldAt = editing && heldNode ? toWorld(editing, heldNode) : null;
  const toolbar = editing
    ? {
        view: {
          bounds: heldAt
            ? { x: heldAt.x, y: heldAt.y, width: 0, height: 0 }
            : { x: editing.x, y: editing.y, width: editing.width, height: editing.height },
          type: sharedNodeType(toolbarAnchors, edit.selected),
          hasSelection: edit.selected.size > 0,
          closed: editing.closed,
          canOpen: edit.selected.size === 1,
          // Closing and opening are the whole path's: a combined one offers neither.
          canClose: !contour.compound,
          shape: contour.compound ? { index: contour.index, count: contour.count } : null,
          canSimplify: isSimplifiable(toolbarAnchors),
        },
        onSetType: edit.setNodeType,
        onDelete: edit.deleteSelected,
        onToggleClosed: edit.toggleClosed,
        onNextShape: contour.step,
        onSimplify: () => {
          if (!shape) return;
          const simpler = simplifyContour(pathAnchors(shape), shape.closed);
          if (!simpler) {
            toast.info('Already as simple as it gets.');
            return;
          }
          edit.clearSelection();
          onCommitPathEdit(
            shape.id,
            { anchors: simpler, closed: shape.closed },
            'edit',
            contourIndex,
          );
          debugLog(`[path] simplified ${toolbarAnchors.length} -> ${simpler.length}`);
        },
        onDone: edit.done,
      }
    : null;

  return {
    toolbar,
    // Undo and Redo while a path is being drawn (docs/specs/023-draw-mode/path-tool.md "Drawing").
    history: draw.history,
    // The cursor a path in its edit mode owns (docs/specs/023-draw-mode/path-tool.md "Cursors in edit mode").
    cursor: edit.cursor ?? (draw.editPointer ? 'default' : null),
    beginPathPress: (e: React.PointerEvent) => !onToolbar(e) && draw.beginPathPress(e),
    beginEditPress: (e: React.PointerEvent) => {
      if (onToolbar(e)) return false;
      // Where a combined path is pressed picks the contour its edit mode opens on.
      if (!editing) contour.notePress(e);
      return edit.beginEditPress(e);
    },
    handlePathDoubleClick: () => draw.handlePathDoubleClick() || editing !== null,
    elements: shownElements,
    draftView,
    editView,
  };
}
