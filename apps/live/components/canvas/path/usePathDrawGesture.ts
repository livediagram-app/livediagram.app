import { useEffect, useEffectEvent, useMemo, useRef, useState, type RefObject } from 'react';
import { isCommittablePath, type Element, type PathAnchor } from '@livediagram/document';
import { pointerToCanvas } from '@/lib/canvas';
import { announce } from '@/lib/announcer';
import { useLatest } from '@/hooks/ui/useLatest';
import type { PendingDraw } from '@/lib/draw-mode';
import {
  PATH_NODE_HIT_PX,
  PATH_TOUCH_HIT_PX,
  moveHandle,
  pathEditHit,
  toggleSmooth,
  type HandleSide,
} from '@/lib/path-edit';
import {
  PATH_CLOSE_PX,
  PATH_DRAG_THRESHOLD_PX,
  classifyPathPress,
  continueDraft,
  cuspLast,
  openPathEnds,
  placeNode,
  removeLastPlaced,
  shapeHandles,
  translateAnchor,
  withAnchor,
  type PathDraft,
} from '@/lib/path-draw';
import { debugLog } from '@/lib/debug-log';

type Point = { x: number; y: number };

/** What the Path tool hands the editor when a path lands (docs/specs/023-draw-mode/path-tool.md). */
export type PathCommit = {
  anchors: PathAnchor[];
  closed: boolean;
  continuing: { id: string } | null;
};

/** A ring the tool shows under the pointer: closing on the first node, or continuing an end. */
export type PathRing = { kind: 'close' | 'continue'; point: Point };

type Drag = {
  index: number;
  // place: shape the node just placed; close: shape the first node as it closes; move: move a
  // placed node; handle: drag one of a placed node's handles (Ctrl held).
  kind: 'place' | 'close' | 'move' | 'handle';
  side?: HandleSide;
  // The last node, pressed: a click (no drag) makes it a cusp.
  cuspOnClick?: boolean;
  start: Point;
  last: Point;
  moved: boolean;
  // Alt breaks the mirror for the rest of the drag.
  alt: boolean;
};

const EMPTY: ReadonlySet<string> = new Set();

// The Path tool's drawing gesture (docs/specs/023-draw-mode/path-tool.md "Drawing"; blueprint
// path-tool "Drawing"). Canvas composes `beginPathPress` in front of the other draw gestures, so
// every press it claims places, shapes, closes or finishes a path; the steps themselves are the
// pure ones in lib/path-draw. The draft lives here until it lands through `onCommitPath`.
export function usePathDrawGesture({
  pendingDraw,
  elements,
  inertIds = EMPTY,
  wrapperRef,
  viewportZoom,
  activeTabId,
  onCommitPath,
  onStartPath,
  snapPoint,
}: {
  pendingDraw: PendingDraw | null;
  elements: readonly Element[];
  inertIds?: ReadonlySet<string>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  viewportZoom: number;
  activeTabId?: string;
  onCommitPath: (commit: PathCommit) => void;
  // A new path's first node: the path that landed before it is no longer the selection.
  onStartPath?: () => void;
  // Where a click lands instead, when something is near enough to snap to (a logo page's shown
  // guides, docs/specs/007-editor/logo-pages.md "Construction guides"); null to place as pressed.
  snapPoint?: (p: Point) => Point | null;
}) {
  const armed = pendingDraw?.type === 'path';
  const [draft, setDraftState] = useState<PathDraft | null>(null);
  // The draft as the window listeners must see it between renders.
  const draftRef = useRef<PathDraft | null>(null);
  const setDraft = (next: PathDraft | null) => {
    draftRef.current = next;
    setDraftState(next);
    // The nodes undone while drawing belong to this draft only.
    if (next === null) setRedo([]);
  };
  // Nodes undone while drawing (docs/specs/023-draw-mode/path-tool.md "Drawing"), last undone
  // last: redo puts them back in order until a new node is placed.
  const redoRef = useRef<PathAnchor[]>([]);
  const [redoCount, setRedoCount] = useState(0);
  const setRedo = (nodes: PathAnchor[]) => {
    redoRef.current = nodes;
    setRedoCount(nodes.length);
  };
  const [cursor, setCursor] = useState<Point | null>(null);
  const [shift, setShift] = useState(false);
  // Ctrl (Cmd) held: the edit pointer, on the path being drawn.
  const [editPointer, setEditPointer] = useState(false);
  // The node a drag is shaping, for its handles to show.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const spaceRef = useRef(false);
  const zoomRef = useLatest(viewportZoom);
  // Read when a path lands, which a window listener can do renders after it was attached.
  const commitRef = useLatest(onCommitPath);
  const endListenersRef = useRef<(() => void) | null>(null);

  const toCanvas = (clientX: number, clientY: number): Point | null => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    return rect ? pointerToCanvas(clientX, clientY, rect, zoomRef.current) : null;
  };
  const snapRef = useLatest(snapPoint);
  // A point a click would place a node at: onto what it snaps to, if anything.
  const snapped = (p: Point): Point => snapRef.current?.(p) ?? p;

  const land = (closed: boolean) => {
    const d = draftRef.current;
    endDrag();
    setDraft(null);
    if (!d || !isCommittablePath(d.anchors, closed)) {
      if (d) debugLog('[path] refused: too few nodes');
      return;
    }
    commitRef.current({ anchors: d.anchors, closed, continuing: d.continuing });
    announce(closed ? 'Path closed' : 'Path finished');
  };

  // Enter, Escape, a double-click or another tool: two nodes or more land open, fewer cancel.
  const finish = () => land(false);

  const endDrag = () => {
    endListenersRef.current?.();
    endListenersRef.current = null;
    dragRef.current = null;
    setDragIndex(null);
  };

  const onDragMove = (e: PointerEvent) => {
    const drag = dragRef.current;
    const d = draftRef.current;
    const q = toCanvas(e.clientX, e.clientY);
    if (!drag || !d || !q) return;
    if (!drag.moved) {
      const screen = Math.hypot(q.x - drag.start.x, q.y - drag.start.y) * zoomRef.current;
      if (screen < PATH_DRAG_THRESHOLD_PX) return;
      drag.moved = true;
    }
    const anchor = d.anchors[drag.index];
    if (!anchor) return;
    // A press that became a drag was no click, so it cannot start a double-click.
    const base = d.lastPlacedAt === null ? d : { ...d, lastPlacedAt: null };
    drag.alt = drag.alt || e.altKey;
    if (drag.kind === 'handle' && drag.side) {
      const anchors = moveHandle(base.anchors, drag.index, drag.side, q, {
        alt: drag.alt,
        shift: e.shiftKey,
      });
      setDraft({ ...base, anchors });
    } else if (spaceRef.current || drag.kind === 'move') {
      // Space moves the node being placed, and a placed node dragged moves too, handles with it.
      setDraft(
        withAnchor(base, drag.index, translateAnchor(anchor, q.x - drag.last.x, q.y - drag.last.y)),
      );
    } else {
      setDraft(
        withAnchor(base, drag.index, shapeHandles(anchor, q, { alt: drag.alt, shift: e.shiftKey })),
      );
    }
    drag.last = q;
  };

  const onDragUp = () => {
    const drag = dragRef.current;
    endDrag();
    const d = draftRef.current;
    if (!drag || !d) return;
    if (drag.kind === 'move' && !drag.moved && drag.cuspOnClick) setDraft(cuspLast(d));
    // A close lands when the path it makes is whole (a click on the first of two corner nodes is
    // ignored; a drag there adds the handles that make it whole).
    if (drag.kind === 'close' && isCommittablePath(d.anchors, true)) land(true);
  };

  const startDrag = (drag: Drag) => {
    endDrag();
    dragRef.current = drag;
    setDragIndex(drag.index);
    const up = () => onDragUp();
    const cancel = () => endDrag();
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    endListenersRef.current = () => {
      window.removeEventListener('pointermove', onDragMove);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  };
  useEffect(() => () => endListenersRef.current?.(), []);

  // The ends a press can pick up again: only while nothing is being drawn.
  const ends = useMemo(
    () => (armed ? openPathEnds(elements, inertIds) : []),
    [armed, elements, inertIds],
  );

  /** A primary press with the Path tool in hand. True when it claimed the press. */
  const beginPathPress = (e: React.PointerEvent): boolean => {
    if (!armed || e.button !== 0 || spaceRef.current) return false;
    const raw = toCanvas(e.clientX, e.clientY);
    if (!raw) return false;
    // The edit pointer picks what is under it; a node is placed where it snaps.
    const p = e.ctrlKey || e.metaKey ? raw : snapped(raw);
    const d = draftRef.current;
    const now = performance.now();
    const touch = e.pointerType === 'touch';
    const drag = (index: number, kind: Drag['kind'], at: Point, extra: Partial<Drag> = {}) =>
      startDrag({ index, kind, start: at, last: at, moved: false, alt: false, ...extra });
    if (d && (e.ctrlKey || e.metaKey)) {
      // The edit pointer: a placed node or handle drags; nothing is placed.
      const all = new Set(d.anchors.map((_, i) => i));
      const radiusPx = touch ? PATH_TOUCH_HIT_PX : PATH_NODE_HIT_PX;
      const hit = pathEditHit(d.anchors, false, all, p, viewportZoom, 0, radiusPx);
      if (hit.kind === 'node') drag(hit.node, 'move', p);
      if (hit.kind === 'handle') drag(hit.node, 'handle', p, { side: hit.side });
      return true;
    }
    const press = classifyPathPress(d, p, {
      zoom: viewportZoom,
      now,
      ends: d ? [] : ends,
      radiusPx: touch ? PATH_TOUCH_HIT_PX : undefined,
    });
    if (
      d &&
      e.altKey &&
      (press.kind === 'node' || press.kind === 'cusp' || press.kind === 'close')
    ) {
      // Alt-click a placed node: corner and smooth trade places.
      const index =
        press.kind === 'node' ? press.index : press.kind === 'close' ? 0 : d.anchors.length - 1;
      setDraft({ ...d, anchors: toggleSmooth(d.anchors, index, false), lastPlacedAt: null });
      return true;
    }
    switch (press.kind) {
      case 'finish':
        finish();
        return true;
      case 'cusp':
        // The last node: a drag moves it, a click makes it a cusp.
        if (d) drag(d.anchors.length - 1, 'move', p, { cuspOnClick: true });
        return true;
      case 'node':
        drag(press.index, 'move', p);
        return true;
      case 'close':
        drag(0, 'close', p);
        return true;
      case 'continue': {
        const el = elements.find((x) => x.id === press.end.id);
        if (el?.type === 'path') {
          setDraft(continueDraft(el, press.end.end));
          debugLog('[path] continued', el.id);
        }
        return true;
      }
      case 'place': {
        if (!d) onStartPath?.();
        setRedo([]);
        const next = placeNode(d, p, now, e.shiftKey);
        setDraft(next);
        const count = next.anchors.length;
        announce(count === 1 ? 'Path started' : `${count} points`);
        const placed = next.anchors[count - 1]!;
        drag(count - 1, 'place', { x: placed.x, y: placed.y });
        return true;
      }
    }
  };

  // The browser's own double-click still fires after the second press finished the path: swallow
  // it, so it never adds a text box (the polygon tool does the same).
  const handlePathDoubleClick = (): boolean => armed;

  // Another tool picked, or another tab: the gesture's own state resets as the change renders…
  const [seen, setSeen] = useState({ armed, tab: activeTabId });
  if (seen.armed !== armed || seen.tab !== activeTabId) {
    setSeen({ armed, tab: activeTabId });
    if (!armed || seen.tab !== activeTabId) {
      setDraftState(null);
      setDragIndex(null);
      setCursor(null);
      setEditPointer(false);
    }
  }
  const releaseGesture = () => {
    endListenersRef.current?.();
    endListenersRef.current = null;
    dragRef.current = null;
    const d = draftRef.current;
    draftRef.current = null;
    return d;
  };
  // …and the path it held lands (a tool change: two nodes or more, open)…
  const landOnDisarm = useEffectEvent(() => {
    const d = releaseGesture();
    if (!d || !isCommittablePath(d.anchors, false)) return;
    commitRef.current({ anchors: d.anchors, closed: false, continuing: d.continuing });
    announce('Path finished');
  });
  useEffect(() => {
    if (!armed) landOnDisarm();
  }, [armed]);
  // …or is dropped (a tab switch: it belongs to the board it was started on).
  const dropOnTabSwitch = useEffectEvent(() => {
    releaseGesture();
  });
  useEffect(() => {
    dropOnTabSwitch();
  }, [activeTabId]);

  // The rubber band and the rings follow the pointer, one render per frame.
  useEffect(() => {
    if (!armed) return;
    let raf: number | null = null;
    let latest: { p: Point; shift: boolean } | null = null;
    const onMove = (e: PointerEvent) => {
      const p = toCanvas(e.clientX, e.clientY);
      if (!p) return;
      latest = { p: snapped(p), shift: e.shiftKey };
      if (raf !== null) return;
      raf = window.requestAnimationFrame(() => {
        raf = null;
        if (!latest) return;
        setCursor(latest.p);
        setShift(latest.shift);
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf !== null) window.cancelAnimationFrame(raf);
    };
    // toCanvas reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed]);

  // Undo while drawing: the last placed node goes (handles and all) and waits for a redo; with
  // none left the path is cancelled.
  const undoNode = () => {
    const d = draftRef.current;
    if (!d) return;
    endDrag();
    const next = removeLastPlaced(d);
    if (!next) {
      debugLog('[path] undo: path cancelled');
      setDraft(null);
      return;
    }
    const removed = d.anchors[d.anchors.length - 1]!;
    setDraft(next);
    setRedo([...redoRef.current, removed]);
    announce(`${next.anchors.length} points`);
  };
  const redoNode = () => {
    const d = draftRef.current;
    const back = redoRef.current[redoRef.current.length - 1];
    if (!d || !back) return;
    endDrag();
    setRedo(redoRef.current.slice(0, -1));
    setDraft({ ...d, anchors: [...d.anchors, back], placed: d.placed + 1, lastPlacedAt: null });
    announce(`${d.anchors.length + 1} points`);
  };

  // Keys, in the capture phase so they win over the editor's own while a path is being drawn.
  const onKey = useEffectEvent((e: KeyboardEvent, down: boolean) => {
    if (e.code === 'Space') {
      spaceRef.current = down;
      // Held while dragging, Space moves the node; the canvas must not start a pan under it.
      if (dragRef.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      return;
    }
    if (e.key === 'Shift') setShift(down);
    if (e.key === 'Control' || e.key === 'Meta') setEditPointer(down);
    if (!down || !draftRef.current) return;
    const claim = () => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const lower = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (lower === 'z' || lower === 'y')) {
      // Undo and redo step through the path being drawn; the board's history waits for it.
      claim();
      if (lower === 'y' || e.shiftKey) redoNode();
      else undoNode();
      return;
    }
    if (e.key === 'Enter' || e.key === 'Escape') {
      claim();
      finish();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      claim();
      endDrag();
      const next = removeLastPlaced(draftRef.current);
      setDraft(next);
      if (next) announce(`${next.anchors.length} points`);
    }
  });
  const onBlur = useEffectEvent(() => {
    spaceRef.current = false;
    setShift(false);
    setEditPointer(false);
  });
  useEffect(() => {
    if (!armed) return;
    const down = (e: KeyboardEvent) => onKey(e, true);
    const up = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener('keydown', down, { capture: true });
    window.addEventListener('keyup', up, { capture: true });
    // Keys let go while the window was away never report their release.
    const blur = () => onBlur();
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down, { capture: true });
      window.removeEventListener('keyup', up, { capture: true });
      window.removeEventListener('blur', blur);
      spaceRef.current = false;
    };
  }, [armed]);

  // The ring under the pointer: the first node closes, an open path's end continues.
  const ring = useMemo((): PathRing | null => {
    if (!armed || !cursor || dragIndex !== null) return null;
    const radius = PATH_CLOSE_PX / viewportZoom;
    const near = (q: Point) => Math.hypot(q.x - cursor.x, q.y - cursor.y) <= radius;
    if (draft) {
      const first = draft.anchors[0];
      return draft.anchors.length >= 2 && first && near(first)
        ? { kind: 'close', point: { x: first.x, y: first.y } }
        : null;
    }
    const end = ends.find((e) => near(e.point));
    return end ? { kind: 'continue', point: end.point } : null;
  }, [armed, cursor, dragIndex, draft, ends, viewportZoom]);

  return {
    draft: armed ? draft : null,
    cursor: armed ? cursor : null,
    shift,
    dragIndex,
    editPointer: armed && editPointer,
    // The dock's Undo and Redo while a path is being drawn step through its nodes.
    history:
      armed && draft
        ? { canUndo: true, canRedo: redoCount > 0, undo: undoNode, redo: redoNode }
        : null,
    ring,
    beginPathPress,
    handlePathDoubleClick,
  };
}
