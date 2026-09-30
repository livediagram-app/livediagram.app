import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import {
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STROKE,
  constrain45,
  isCommittablePath,
  pathAnchors,
  type PathAnchor,
  type PathElement,
} from '@livediagram/document';
import { pointerToCanvas } from '@/lib/canvas';
import { useLatest } from '@/hooks/ui/useLatest';
import { PATH_DOUBLE_PRESS_MS, PATH_DRAG_THRESHOLD_PX } from '@/lib/path-draw';
import {
  PATH_SNAP_PX,
  bendAt,
  canJoin,
  deleteNodes,
  insertNodeAt,
  moveHandle,
  moveNodes,
  nodesInBox,
  pathEditHit,
  snapNodeDelta,
  toLocal,
  toggleSmooth,
  type HandleSide,
} from '@/lib/path-edit';
import type { PathEditKind } from '@/hooks/canvas/usePathCommits';

type Point = { x: number; y: number };

type Drag =
  | { kind: 'nodes'; pressed: number }
  | { kind: 'handle'; node: number; side: HandleSide }
  | { kind: 'segment'; segment: number; t: number }
  | { kind: 'box'; additive: boolean };

type Gesture = Drag & {
  el: PathElement;
  base: PathAnchor[];
  start: Point; // the press, in the path's own frame
  startWorld: Point;
  moved: boolean;
  alt: boolean;
  // The anchors the gesture holds now: what lands on release.
  draft: PathAnchor[] | null;
};

export type PathGuides = { x?: number; y?: number };

const NO_NODES: ReadonlySet<number> = new Set();

// A path's edit mode (docs/specs/023-whiteboard/path-tool.md "Editing"; blueprint path-tool "Edit
// mode"): every press on the canvas while a path is being edited lands here first, so the rest of
// the canvas stays inert. Each gesture holds its anchors as a draft while it runs and lands as one
// `onCommitPathEdit`, so it is one undo step.
export function usePathEditGesture({
  element,
  selectedPathId,
  wrapperRef,
  viewportZoom,
  onCommitPathEdit,
  onLeave,
  onDeselect,
  onBeginEdit,
}: {
  // The path in its edit mode, or null.
  element: PathElement | null;
  // The one path selected while nothing is being edited: Enter opens its edit mode.
  selectedPathId: string | null;
  wrapperRef: RefObject<HTMLDivElement | null>;
  viewportZoom: number;
  onCommitPathEdit: (
    id: string,
    next: { anchors: PathAnchor[]; closed: boolean },
    kind: PathEditKind,
  ) => void;
  onLeave: () => void;
  onDeselect: () => void;
  onBeginEdit: (id: string) => void;
}) {
  const editingId = element?.id ?? null;
  const [selected, setSelectedState] = useState<ReadonlySet<number>>(NO_NODES);
  const selectedRef = useRef<ReadonlySet<number>>(NO_NODES);
  const setSelected = (next: ReadonlySet<number>) => {
    selectedRef.current = next;
    setSelectedState(next);
  };
  const [draft, setDraft] = useState<PathAnchor[] | null>(null);
  const [box, setBox] = useState<{ from: Point; to: Point } | null>(null);
  const [guides, setGuides] = useState<PathGuides | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const lastNodePressRef = useRef<{ id: string; node: number; at: number } | null>(null);
  const endListenersRef = useRef<(() => void) | null>(null);
  const zoomRef = useLatest(viewportZoom);
  const commitRef = useLatest(onCommitPathEdit);
  const leaveRef = useLatest(onLeave);
  const deselectRef = useLatest(onDeselect);

  // A new path in edit mode (or none) starts with no nodes selected and no gesture.
  const [seenId, setSeenId] = useState(editingId);
  if (seenId !== editingId) {
    setSeenId(editingId);
    setSelectedState(NO_NODES);
    setDraft(null);
    setBox(null);
    setGuides(null);
  }
  const releaseGesture = useEffectEvent(() => {
    endListenersRef.current?.();
    endListenersRef.current = null;
    gestureRef.current = null;
    selectedRef.current = NO_NODES;
  });
  useEffect(() => {
    releaseGesture();
  }, [editingId]);

  const toCanvas = (clientX: number, clientY: number): Point | null => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    return rect ? pointerToCanvas(clientX, clientY, rect, zoomRef.current) : null;
  };

  const land = (el: PathElement, anchors: PathAnchor[], closed: boolean, kind: PathEditKind) => {
    commitRef.current(el.id, { anchors, closed }, kind);
    // A path left with fewer nodes than it needs is deleted, and edit mode goes with it.
    if (!isCommittablePath(anchors, closed)) {
      console.debug('[path] edit left: path deleted');
      leaveRef.current();
    }
  };

  const clearGesture = () => {
    endListenersRef.current?.();
    endListenersRef.current = null;
    gestureRef.current = null;
    setDraft(null);
    setBox(null);
    setGuides(null);
  };

  const hold = (g: Gesture, next: PathAnchor[]) => {
    g.draft = next;
    setDraft(next);
  };

  const onMove = (ev: PointerEvent) => {
    const g = gestureRef.current;
    const world = toCanvas(ev.clientX, ev.clientY);
    if (!g || !world) return;
    const q = toLocal(g.el, world);
    if (!g.moved) {
      const screen = Math.hypot(q.x - g.start.x, q.y - g.start.y) * zoomRef.current;
      if (screen < PATH_DRAG_THRESHOLD_PX) return;
      g.moved = true;
    }
    g.alt = g.alt || ev.altKey;
    const closed = g.el.closed;
    switch (g.kind) {
      case 'nodes': {
        let dx = q.x - g.start.x;
        let dy = q.y - g.start.y;
        const moving = selectedRef.current;
        if (ev.shiftKey) {
          ({ x: dx, y: dy } = constrain45({ x: 0, y: 0 }, { x: dx, y: dy }));
          setGuides(null);
        } else {
          const snap = snapNodeDelta(
            g.base,
            moving,
            g.pressed,
            dx,
            dy,
            PATH_SNAP_PX / zoomRef.current,
          );
          ({ dx, dy } = snap);
          setGuides(
            snap.guides.x !== undefined || snap.guides.y !== undefined ? snap.guides : null,
          );
        }
        hold(g, moveNodes(g.base, moving, dx, dy));
        return;
      }
      case 'handle':
        hold(g, moveHandle(g.base, g.node, g.side, q, { alt: g.alt, shift: ev.shiftKey }));
        return;
      case 'segment':
        hold(g, bendAt(g.base, closed, g.segment, g.t, q));
        return;
      case 'box':
        setBox({ from: g.startWorld, to: world });
        return;
    }
  };

  const onUp = (ev: PointerEvent) => {
    const g = gestureRef.current;
    const world = toCanvas(ev.clientX, ev.clientY);
    clearGesture();
    if (!g) return;
    const closed = g.el.closed;
    if (g.kind === 'box') {
      if (!g.moved || !world) {
        // A click on empty space leaves edit mode, as a click off a path does anywhere.
        console.debug('[path] edit left: click outside');
        leaveRef.current();
        deselectRef.current();
        return;
      }
      const rect = {
        x: Math.min(g.startWorld.x, world.x),
        y: Math.min(g.startWorld.y, world.y),
        width: Math.abs(world.x - g.startWorld.x),
        height: Math.abs(world.y - g.startWorld.y),
      };
      const inside = nodesInBox(worldPoints(g.el, g.base), rect);
      setSelected(new Set([...(g.additive ? selectedRef.current : []), ...inside]));
      return;
    }
    if (g.kind === 'segment' && !g.moved) {
      const { anchors, index } = insertNodeAt(g.base, closed, g.segment, g.t);
      land(g.el, anchors, closed, 'edit');
      setSelected(new Set([index]));
      return;
    }
    // A drag that moved something lands as one step; one that moved nothing lands nothing.
    if (g.moved && g.draft) land(g.el, g.draft, closed, 'edit');
  };

  const startGesture = (g: Gesture) => {
    clearGesture();
    gestureRef.current = g;
    const up = (ev: PointerEvent) => onUp(ev);
    const cancel = () => clearGesture();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    endListenersRef.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  };
  useEffect(() => () => endListenersRef.current?.(), []);

  /** A primary press while a path is in edit mode. True when it claimed the press (always). */
  const beginEditPress = (e: React.PointerEvent): boolean => {
    const el = element;
    if (!el || e.button !== 0) return false;
    const world = toCanvas(e.clientX, e.clientY);
    if (!world) return false;
    const p = toLocal(el, world);
    const base = pathAnchors(el);
    const strokePx = BORDER_STROKE_PX[el.strokeWidth ?? DEFAULT_BORDER_STROKE];
    const hit = pathEditHit(base, el.closed, selectedRef.current, p, viewportZoom, strokePx);
    const start = (drag: Drag) =>
      startGesture({
        ...drag,
        el,
        base,
        start: p,
        startWorld: world,
        moved: false,
        alt: e.altKey,
        draft: null,
      });
    switch (hit.kind) {
      case 'node': {
        const now = performance.now();
        const last = lastNodePressRef.current;
        const double =
          last?.id === el.id && last.node === hit.node && now - last.at <= PATH_DOUBLE_PRESS_MS;
        lastNodePressRef.current = double ? null : { id: el.id, node: hit.node, at: now };
        if (e.altKey || double) {
          // Alt-click or a double-click: corner ↔ smooth.
          land(el, toggleSmooth(base, hit.node, el.closed), el.closed, 'edit');
          setSelected(new Set([hit.node]));
          return true;
        }
        const current = selectedRef.current;
        if (e.shiftKey) {
          const next = new Set(current);
          if (next.has(hit.node)) next.delete(hit.node);
          else next.add(hit.node);
          setSelected(next);
          if (!next.has(hit.node)) return true;
        } else if (!current.has(hit.node)) {
          setSelected(new Set([hit.node]));
        }
        start({ kind: 'nodes', pressed: hit.node });
        return true;
      }
      case 'handle':
        start({ kind: 'handle', node: hit.node, side: hit.side });
        return true;
      case 'segment':
        start({ kind: 'segment', segment: hit.segment, t: hit.t });
        return true;
      case 'empty':
        start({ kind: 'box', additive: e.shiftKey });
        return true;
    }
  };

  const leave = (reason: string) => {
    console.debug(`[path] edit left: ${reason}`);
    leaveRef.current();
  };

  // Keys, in the capture phase while a path is in edit mode.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const el = element;
    if (!el || isTyping(e.target)) return;
    const claim = () => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const sel = selectedRef.current;
    const anchors = pathAnchors(el);
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Escape') {
      claim();
      if (sel.size > 0) setSelected(NO_NODES);
      else leave('escape');
      return;
    }
    if (e.key === 'Enter') {
      claim();
      leave('enter');
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      claim();
      if (sel.size === 0) return;
      setSelected(NO_NODES);
      land(el, deleteNodes(anchors, sel), el.closed, 'edit');
      return;
    }
    if (e.key.startsWith('Arrow')) {
      claim();
      if (sel.size === 0) return;
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      land(el, moveNodes(anchors, sel, dx, dy), el.closed, 'edit');
      return;
    }
    if (e.key === 'Tab') {
      claim();
      const n = anchors.length;
      const current = sel.size > 0 ? Math.max(...sel) : e.shiftKey ? 0 : -1;
      setSelected(new Set([(current + (e.shiftKey ? -1 : 1) + n) % n]));
      return;
    }
    if (mod && e.key.toLowerCase() === 'a') {
      claim();
      setSelected(new Set(anchors.map((_, i) => i)));
      return;
    }
    if (!mod && e.key.toLowerCase() === 'j') {
      claim();
      if (canJoin(anchors, el.closed, sel)) land(el, anchors, true, 'join');
    }
  });
  useEffect(() => {
    if (!editingId) return;
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', listener, { capture: true });
    return () => window.removeEventListener('keydown', listener, { capture: true });
  }, [editingId]);

  // Enter with one path selected opens its edit mode, from the keyboard.
  const onEnter = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== 'Enter' || !selectedPathId || e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTyping(e.target) || e.defaultPrevented) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    onBeginEdit(selectedPathId);
  });
  useEffect(() => {
    if (!selectedPathId || editingId) return;
    const listener = (e: KeyboardEvent) => onEnter(e);
    window.addEventListener('keydown', listener, { capture: true });
    return () => window.removeEventListener('keydown', listener, { capture: true });
  }, [selectedPathId, editingId]);

  return {
    editing: element !== null,
    selected: element ? selected : NO_NODES,
    draft: element ? draft : null,
    box: element ? box : null,
    guides: element ? guides : null,
    beginEditPress,
  };
}

// The path's nodes where they show: its own frame turned by its rotation.
function worldPoints(el: PathElement, anchors: readonly PathAnchor[]): Point[] {
  const rotation = el.rotation ?? 0;
  if (rotation % 360 === 0) return anchors.map((a) => ({ x: a.x, y: a.y }));
  const r = (rotation * Math.PI) / 180;
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return anchors.map((a) => ({
    x: cx + (a.x - cx) * Math.cos(r) - (a.y - cy) * Math.sin(r),
    y: cy + (a.x - cx) * Math.sin(r) + (a.y - cy) * Math.cos(r),
  }));
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
