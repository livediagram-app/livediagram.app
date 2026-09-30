import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import {
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STROKE,
  isCommittablePath,
  pathAnchors,
  type PathAnchor,
  type PathElement,
} from '@livediagram/document';
import { pointerToCanvas } from '@/lib/canvas';
import { useLatest } from '@/hooks/ui/useLatest';
import { PATH_DOUBLE_PRESS_MS, PATH_DRAG_THRESHOLD_PX } from '@/lib/path-draw';

// How long a finger rests on a node before it is a long-press (the canvas long-press's own).
export const PATH_LONG_PRESS_MS = 500;
import {
  PATH_NODE_HIT_PX,
  PATH_SNAP_PX,
  PATH_TOUCH_HIT_PX,
  openPathAt,
  setNodeType as setTypeOf,
  bendAt,
  deleteNodes,
  dragNodes,
  insertNodeAt,
  moveHandle,
  nodesInBox,
  pathEditHit,
  toLocal,
  toWorld,
  toggleSmooth,
  type HandleSide,
} from '@/lib/path-edit';
import type { PathEditKind } from '@/hooks/canvas/usePathCommits';
import { pathEditKey } from '@/lib/path-edit-keys';

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
  // A finger held still on a node: the long-press took the press.
  held: boolean;
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
  // The node a long-press chose: the toolbar comes to it (null: over the path).
  const [toolbarAt, setToolbarAt] = useState<number | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const lastNodePressRef = useRef<{ id: string; node: number; at: number } | null>(null);
  const endListenersRef = useRef<(() => void) | null>(null);
  const zoomRef = useLatest(viewportZoom);
  const commitRef = useLatest(onCommitPathEdit);
  const leaveRef = useLatest(onLeave);
  const deselectRef = useLatest(onDeselect);
  const beginEditRef = useLatest(onBeginEdit);

  // A new path in edit mode (or none) starts with no nodes selected and no gesture.
  const [seenId, setSeenId] = useState(editingId);
  if (seenId !== editingId) {
    setSeenId(editingId);
    setSelectedState(NO_NODES);
    setDraft(null);
    setBox(null);
    setGuides(null);
    setToolbarAt(null);
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
    if (longPressRef.current !== null) clearTimeout(longPressRef.current);
    longPressRef.current = null;
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
      if (g.held) return;
      g.moved = true;
      if (longPressRef.current !== null) clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    g.alt = g.alt || ev.altKey;
    const closed = g.el.closed;
    switch (g.kind) {
      case 'nodes': {
        const step = dragNodes(
          g.base,
          selectedRef.current,
          g.pressed,
          { x: q.x - g.start.x, y: q.y - g.start.y },
          ev.shiftKey,
          PATH_SNAP_PX / zoomRef.current,
        );
        setGuides(step.guides);
        hold(g, step.anchors);
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
    if (!g || g.held) return;
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
      const inside = nodesInBox(
        g.base.map((a) => toWorld(g.el, a)),
        rect,
      );
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
  useEffect(
    () => () => {
      endListenersRef.current?.();
      if (longPressRef.current !== null) clearTimeout(longPressRef.current);
    },
    [],
  );

  /** A primary press while a path is in edit mode. True when it claimed the press (always). */
  const beginEditPress = (e: React.PointerEvent): boolean => {
    const el = element;
    if (!el || e.button !== 0) return false;
    const world = toCanvas(e.clientX, e.clientY);
    if (!world) return false;
    const p = toLocal(el, world);
    const base = pathAnchors(el);
    const strokePx = BORDER_STROKE_PX[el.strokeWidth ?? DEFAULT_BORDER_STROKE];
    const radiusPx = e.pointerType === 'touch' ? PATH_TOUCH_HIT_PX : PATH_NODE_HIT_PX;
    const hit = pathEditHit(
      base,
      el.closed,
      selectedRef.current,
      p,
      viewportZoom,
      strokePx,
      radiusPx,
    );
    const start = (drag: Drag) =>
      startGesture({
        ...drag,
        el,
        base,
        start: p,
        startWorld: world,
        moved: false,
        alt: e.altKey,
        held: false,
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
        if (e.pointerType === 'touch') {
          // A finger held still selects the node and brings the toolbar to it.
          const node = hit.node;
          longPressRef.current = setTimeout(() => {
            longPressRef.current = null;
            const g = gestureRef.current;
            if (!g || g.moved) return;
            g.held = true;
            setSelected(new Set([node]));
            setToolbarAt(node);
          }, PATH_LONG_PRESS_MS);
        }
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
    // On the edit toolbar its buttons keep Tab, Enter and Space; Escape still leaves.
    const onBar = (e.target as HTMLElement | null)?.closest?.('[data-canvas-toolbar]');
    if (onBar && e.key !== 'Escape') return;
    const out = pathEditKey(
      { key: e.key, shiftKey: e.shiftKey, mod: e.metaKey || e.ctrlKey },
      pathAnchors(el),
      el.closed,
      selectedRef.current,
    );
    if (out.claim) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    if (out.focusToolbar) {
      const first = document.querySelector<HTMLButtonElement>(
        '[data-path-edit-toolbar] button:not([disabled])',
      );
      // No toolbar to move on to: wrap round to the first node.
      if (first) first.focus();
      else setSelected(new Set([0]));
    }
    if (out.select) setSelected(out.select);
    if (out.land) land(el, out.land.anchors, out.land.closed, out.land.kind);
    if (out.leave) leave(out.leave);
    if (out.reopen) {
      // Undo and redo stay in edit mode, as in Figma: the editor's own undo leaves every edit
      // mode, so the path's reopens once it has run (unless the step took the path away).
      const id = el.id;
      window.setTimeout(() => beginEditRef.current(id), 0);
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

  // The edit toolbar's actions (docs/specs/023-whiteboard/path-tool.md "Editing").
  const setNodeType = (type: PathAnchor['mode']) => {
    const el = element;
    const sel = selectedRef.current;
    if (!el || sel.size === 0) return;
    land(el, setTypeOf(pathAnchors(el), sel, type, el.closed), el.closed, 'edit');
  };
  const deleteSelected = () => {
    const el = element;
    const sel = selectedRef.current;
    if (!el || sel.size === 0) return;
    setSelected(NO_NODES);
    land(el, deleteNodes(pathAnchors(el), sel), el.closed, 'edit');
  };
  const toggleClosed = () => {
    const el = element;
    if (!el) return;
    const anchors = pathAnchors(el);
    if (!el.closed) {
      land(el, anchors, true, 'join');
      return;
    }
    const sel = selectedRef.current;
    if (sel.size !== 1) return;
    land(el, openPathAt(anchors, [...sel][0]!), false, 'edit');
    setSelected(new Set([0]));
  };
  const done = () => leave('done');

  return {
    editing: element !== null,
    toolbarAt: element ? toolbarAt : null,
    setNodeType,
    deleteSelected,
    toggleClosed,
    done,
    selected: element ? selected : NO_NODES,
    draft: element ? draft : null,
    box: element ? box : null,
    guides: element ? guides : null,
    beginEditPress,
  };
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
