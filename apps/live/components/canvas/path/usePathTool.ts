'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import {
  continuedPath,
  defaultFillColor,
  defaultStrokeColor,
  inkWhiteboardElement,
  pathAnchors,
  pathGeometry,
  reshapePath,
  type Element,
  type PathAnchor,
  type PathElement,
} from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { rubberBand } from '@/lib/path-draw';
import { sharedNodeType, toWorld } from '@/lib/path-edit';
import type { CanvasTool } from '@/components/palette/CommandPalette.types';
import type { PathEditKind } from '@/hooks/canvas/usePathCommits';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { usePathDrawGesture, type PathCommit } from './usePathDrawGesture';
import { usePathEditGesture } from './usePathEditGesture';
import type { PathDraftView } from './PathDraftLayer';
import type { PathEditView } from './PathEditLayer';

// A press on a toolbar floating over the canvas (the selection toolbar, the edit toolbar) is a
// button press, never a node.
const onToolbar = (e: React.PointerEvent) =>
  !!(e.target as HTMLElement | null)?.closest?.('[data-canvas-toolbar]');

// The id the path being drawn renders under: it has no element yet.
export const PATH_DRAFT_ID = 'path-draft';

const identity = <T>(el: T): T => el;

// The Path tool on the canvas (docs/specs/023-whiteboard/path-tool.md): composes the drawing
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
  whiteboardInk,
  editingId,
  selectedId,
  multiSelectCount,
  onCommitPath,
  onCommitPathEdit,
  onDressPath = identity,
  onLeaveEdit,
  onDeselect,
  onBeginEdit,
  onCancelDraw,
}: {
  pendingDraw: PendingDraw | null;
  canvasTool: CanvasTool;
  elements: Element[];
  inertIds?: ReadonlySet<string>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  viewportZoom: number;
  activeTabId?: string;
  // The board's ink on a whiteboard (undefined elsewhere): an unpainted path draws in it.
  whiteboardInk?: string;
  editingId: string | null;
  selectedId: string | null;
  multiSelectCount: number;
  onCommitPath: (commit: PathCommit) => void;
  onCommitPathEdit: (
    id: string,
    next: { anchors: PathAnchor[]; closed: boolean },
    kind: PathEditKind,
  ) => void;
  onDressPath?: <T extends Element>(el: T) => T;
  onLeaveEdit: () => void;
  onDeselect: () => void;
  onBeginEdit: (id: string) => void;
  // Puts a held tool down: opening a path's edit mode puts the Path tool down first.
  onCancelDraw: () => void;
}) {
  const surface = useCanvasSurface();
  const draw = usePathDrawGesture({
    pendingDraw,
    elements,
    inertIds,
    wrapperRef,
    viewportZoom,
    activeTabId,
    onCommitPath,
    onStartPath: onDeselect,
  });
  const openEdit = (id: string) => {
    if (pendingDraw) onCancelDraw();
    onBeginEdit(id);
  };

  // Edit mode: the path being edited, while Select is in hand and it can be edited at all.
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
    console.debug(`[path] edit left: ${vanished && !stale ? 'path gone' : 'no longer editable'}`);
    onLeaveEdit();
  }, [stale, editing, editingId, onLeaveEdit]);
  const edit = usePathEditGesture({
    element: editing,
    selectedPathId:
      editingId === null && multiSelectCount === 0 ? (pathOf(selectedId)?.id ?? null) : null,
    wrapperRef,
    viewportZoom,
    onCommitPathEdit,
    onLeave: onLeaveEdit,
    onDeselect,
    onBeginEdit: openEdit,
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
        : onDressPath<PathElement>({
            id: PATH_DRAFT_ID,
            type: 'path',
            ...pathGeometry(draft.anchors, false),
            closed: false,
          });
    return whiteboardInk ? inkWhiteboardElement(base, whiteboardInk) : base;
  }, [draft, continuingId, elements, onDressPath, whiteboardInk]);

  const editDraft = edit.draft;
  const editingPathId = editing?.id ?? null;
  const shownElements = useMemo(() => {
    if (continuingId) return elements.filter((el) => el.id !== continuingId);
    if (editingPathId && editDraft) {
      return elements.map((el) =>
        el.id === editingPathId && el.type === 'path' ? reshapePath(el, editDraft, el.closed) : el,
      );
    }
    return elements;
  }, [elements, continuingId, editingPathId, editDraft]);

  const draftView: PathDraftView | null =
    draft && element
      ? {
          element,
          stroke: element.strokeColor ?? defaultStrokeColor(element, surface),
          fill: element.fillColor ?? defaultFillColor(element, surface),
          anchors: draft.anchors,
          active: draw.dragIndex ?? draft.anchors.length - 1,
          band:
            draw.dragIndex === null && draw.cursor
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

  const editView: PathEditView | null = editing
    ? {
        frame: editing,
        anchors: editDraft ?? pathAnchors(editing),
        closed: editing.closed,
        selected: edit.selected,
        box: edit.box,
        guides: edit.guides,
        zoom: viewportZoom,
      }
    : null;

  // The edit toolbar: above the path, or above the node a long-press chose.
  const toolbarAnchors = editing ? (editDraft ?? pathAnchors(editing)) : [];
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
        },
        onSetType: edit.setNodeType,
        onDelete: edit.deleteSelected,
        onToggleClosed: edit.toggleClosed,
        onDone: edit.done,
      }
    : null;

  return {
    toolbar,
    beginPathPress: (e: React.PointerEvent) => !onToolbar(e) && draw.beginPathPress(e),
    beginEditPress: (e: React.PointerEvent) => !onToolbar(e) && edit.beginEditPress(e),
    handlePathDoubleClick: () => draw.handlePathDoubleClick() || editing !== null,
    elements: shownElements,
    draftView,
    editView,
  };
}
