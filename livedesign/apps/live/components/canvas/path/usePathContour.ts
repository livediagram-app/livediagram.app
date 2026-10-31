'use client';

import { useMemo, useState, type RefObject } from 'react';
import {
  isCompoundPath,
  pathAnchors,
  pathContours,
  pathD,
  type Element,
  type PathElement,
} from '@livedesign/design';
import { pointerToCanvas } from '@/lib/canvas';
import { contourAt } from '@/lib/path-contour-pick';
import { PATH_NODE_HIT_PX, PATH_TOUCH_HIT_PX } from '@/lib/path-edit';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

type Point = { x: number; y: number };
type Press = { id: string; at: Point };

// The contour of a combined path in edit mode (docs/specs/023-draw-mode/path-tool.md "Combined
// paths"): which one, picked by the press that opened edit mode (a double-click's, or the last
// press on the path before Enter or Edit Points), switched by a press on another or the toolbar's
// Shape button. The edit gesture works on that contour as a path of its own (`element`), in the
// path's frame; the others show as an outline and are snapped to.
export function usePathContour({
  editing,
  elements,
  wrapperRef,
  viewportZoom,
}: {
  editing: PathElement | null;
  elements: readonly Element[];
  wrapperRef: RefObject<HTMLDivElement | null>;
  viewportZoom: number;
}) {
  // The last press on a combined path while none was in edit mode: where edit mode opens.
  const [press, setPress] = useState<Press | null>(null);
  const [picked, setPicked] = useState<{ id: string; index: number; press: Press | null } | null>(
    null,
  );
  const compound = editing !== null && isCompoundPath(editing);
  // A path opening (or reopening after a new press on it) picks its contour; reopening after
  // Undo keeps the one it had.
  if (
    editing &&
    compound &&
    (picked?.id !== editing.id || (press?.id === editing.id && picked.press !== press))
  ) {
    const index = press?.id === editing.id ? (contourAt(editing, press.at, 0, true) ?? 0) : 0;
    debugLog(`[path] contour picked: ${index}`);
    setPicked({ id: editing.id, index, press });
  }
  const contours = useMemo(() => (editing ? pathContours(editing) : []), [editing]);
  const count = contours.length;
  const index =
    compound && picked?.id === editing?.id ? Math.min(picked.index, Math.max(0, count - 1)) : 0;

  // The contour as a path of its own, in the path's frame (its box and rotation).
  const element = useMemo((): PathElement | null => {
    if (!editing || !compound) return editing;
    const { subpaths: _subpaths, ...rest } = editing;
    return { ...rest, nodes: contours[index] ?? editing.nodes };
  }, [editing, compound, contours, index]);

  // The other contours: their outline (path data in canvas px) and their nodes to snap to.
  const others = useMemo(() => {
    if (!editing || !compound) return null;
    const ds: string[] = [];
    const points: Point[] = [];
    contours.forEach((nodes, i) => {
      if (i === index) return;
      const anchors = pathAnchors({ ...editing, nodes });
      ds.push(pathD(anchors, editing.closed));
      for (const a of anchors) points.push({ x: a.x, y: a.y });
    });
    return { d: ds.join(' '), points };
  }, [editing, compound, contours, index]);

  const toCanvas = (clientX: number, clientY: number): Point | null => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    return rect ? pointerToCanvas(clientX, clientY, rect, viewportZoom) : null;
  };

  /** A press while no path is in edit mode: noted when it lands on a combined path. */
  const notePress = (e: React.PointerEvent) => {
    const id = (e.target as HTMLElement | null)
      ?.closest?.('[data-element-id]')
      ?.getAttribute('data-element-id');
    if (!id) return;
    const el = elements.find((x) => x.id === id);
    if (el?.type !== 'path' || !isCompoundPath(el)) return;
    const at = toCanvas(e.clientX, e.clientY);
    if (at) setPress({ id, at });
  };

  /** A press in edit mode on no node: true when it picked another contour. */
  const pickAt = (world: Point, touch: boolean): boolean => {
    if (!editing || !compound) return false;
    const radius = (touch ? PATH_TOUCH_HIT_PX : PATH_NODE_HIT_PX) / viewportZoom;
    const next = contourAt(editing, world, radius);
    if (next === null || next === index) return false;
    debugLog(`[path] contour switched: ${next}`);
    setPicked({ id: editing.id, index: next, press });
    return true;
  };

  const step = () => {
    if (!editing || !compound) return;
    setPicked({ id: editing.id, index: (index + 1) % count, press });
  };

  return {
    compound,
    index,
    count,
    element,
    others,
    notePress,
    pickAt,
    step,
  };
}
