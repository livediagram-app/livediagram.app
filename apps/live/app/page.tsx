'use client';

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  anchorPosition,
  bringManyToFront,
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  duplicateGroupedElements,
  endpointPosition,
  isBoxed,
  joinGroups,
  selectionMembers,
  sendManyToBack,
  snapToAlignment,
  snapToAnchor,
  ungroup,
  unionBoxedBounds,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
  deriveShapeColours,
  deriveTextColorForBg,
  type Anchor,
  type ArrowElement,
  type BackgroundPattern,
  type BoxedElement,
  type Element,
  type Endpoint,
  type ShapeKind,
  type Tab,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/diagram';
import { Canvas } from '@/components/Canvas';
import { EditorHeader } from '@/components/EditorHeader';
import { TabBar } from '@/components/TabBar';
import { useDiagramHistory } from '@/hooks/useDiagramHistory';
import { ALIGN_SNAP_THRESHOLD, SNAP_THRESHOLD, type ArrowEnd, type DragMode } from '@/lib/canvas';
import { buildTemplate, type TemplateKind } from '@/lib/templates';

function createTab(name: string): Tab {
  return { id: crypto.randomUUID(), name, elements: [] };
}

const MIN_SIZE = 20;

type ShapeBounds = { x: number; y: number; width: number; height: number };

type DragState =
  | {
      kind: 'boxed';
      primaryId: string;
      mode: DragMode;
      startClientX: number;
      startClientY: number;
      startBounds: Map<string, ShapeBounds>;
      aspectLocked: boolean;
    }
  | {
      kind: 'arrow-endpoint';
      arrowId: string;
      end: ArrowEnd;
      startClientX: number;
      startClientY: number;
      startCanvasX: number;
      startCanvasY: number;
    };

function nextBounds(
  start: ShapeBounds,
  mode: DragMode,
  dx: number,
  dy: number,
  aspectLocked: boolean,
): ShapeBounds {
  const { x, y, width, height } = start;
  if (mode === 'move') return { x: x + dx, y: y + dy, width, height };

  const freeForCorner = (signX: number, signY: number) => {
    const newW = Math.max(MIN_SIZE, width + signX * dx);
    const newH = Math.max(MIN_SIZE, height + signY * dy);
    return { newW, newH };
  };

  const lockedForCorner = (signX: number, signY: number) => {
    const candW = Math.max(MIN_SIZE, width + signX * dx);
    const candH = Math.max(MIN_SIZE, height + signY * dy);
    const ratio = width / height;
    const useW = Math.abs(candW - width) >= Math.abs(candH - height);
    const newW = useW ? candW : candH * ratio;
    const newH = useW ? candW / ratio : candH;
    return { newW: Math.max(MIN_SIZE, newW), newH: Math.max(MIN_SIZE, newH) };
  };

  const compute = aspectLocked ? lockedForCorner : freeForCorner;

  switch (mode) {
    case 'resize-se': {
      const { newW, newH } = compute(1, 1);
      return { x, y, width: newW, height: newH };
    }
    case 'resize-sw': {
      const { newW, newH } = compute(-1, 1);
      return { x: x + (width - newW), y, width: newW, height: newH };
    }
    case 'resize-ne': {
      const { newW, newH } = compute(1, -1);
      return { x, y: y + (height - newH), width: newW, height: newH };
    }
    case 'resize-nw': {
      const { newW, newH } = compute(-1, -1);
      return { x: x + (width - newW), y: y + (height - newH), width: newW, height: newH };
    }
  }
}

function arrowReferencesAny(arrow: ArrowElement, ids: Set<string>): boolean {
  return (
    (arrow.from.kind === 'pinned' && ids.has(arrow.from.elementId)) ||
    (arrow.to.kind === 'pinned' && ids.has(arrow.to.elementId))
  );
}

export default function LivePage() {
  const initialTabs: Tab[] = [createTab('Tab 1')];

  const {
    tabs,
    canUndo,
    canRedo,
    commit: commitTabs,
    tick: tickTabs,
    markCheckpoint,
    undo: undoHistory,
    redo: redoHistory,
  } = useDiagramHistory(initialTabs);

  const [activeId, setActiveId] = useState<string>(() => initialTabs[0]!.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formatSourceId, setFormatSourceId] = useState<string | null>(null);
  const [groupSourceId, setGroupSourceId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [palettePosition, setPalettePosition] = useState<{ x: number; y: number } | null>(null);
  const [paletteMinimized, setPaletteMinimized] = useState(false);
  const [diagramName, setDiagramName] = useState('Untitled diagram');
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  const [viewportZoom, setViewportZoom] = useState(1);
  const canvasMainRef = useRef<HTMLElement>(null);
  // Keep latest zoom available to drag effects without re-creating them on
  // every zoom change (which would interrupt an in-progress drag).
  const zoomRef = useRef(viewportZoom);
  useEffect(() => {
    zoomRef.current = viewportZoom;
  }, [viewportZoom]);

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0]!;

  // --- Element-scoped history helpers (active-tab aware) -------------------

  const commit = (mapElements: (els: Element[]) => Element[]) => {
    commitTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, elements: mapElements(t.elements) } : t)),
    );
  };

  const tick = (mapElements: (els: Element[]) => Element[]) => {
    tickTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, elements: mapElements(t.elements) } : t)),
    );
  };

  const undo = () => {
    undoHistory();
    setEditingId(null);
    setSelectedId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };

  const redo = () => {
    redoHistory();
    setEditingId(null);
    setSelectedId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };

  // --- Placement helpers ---------------------------------------------------

  // Centre of the currently visible canvas viewport, in canvas-local coords.
  // With transform `scale(z) translate(offset)` centred on the wrapper, the
  // canvas-coord at viewport centre is just (canvasCentre - offset) — zoom
  // doesn't enter the equation because scale is centred on the same point.
  const getViewportCenter = (): { x: number; y: number } => {
    const rect = canvasMainRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: rect.width / 2 - viewportOffset.x,
      y: rect.height / 2 - viewportOffset.y,
    };
  };

  // Compute zoom + offset so every element on the tab fits in the viewport
  // with padding, then centre the bounding box on the viewport centre.
  const fitToScreen = () => {
    const rect = canvasMainRef.current?.getBoundingClientRect();
    if (!rect) return;
    const boxedIds = new Set(activeTab.elements.filter(isBoxed).map((el) => el.id));
    if (boxedIds.size === 0) {
      setViewportOffset({ x: 0, y: 0 });
      setViewportZoom(1);
      return;
    }
    const bbox = unionBoxedBounds(activeTab.elements, boxedIds);
    if (!bbox) return;
    const padding = 60;
    const zoom = Math.max(
      0.1,
      Math.min(
        5,
        (rect.width - 2 * padding) / Math.max(1, bbox.width),
        (rect.height - 2 * padding) / Math.max(1, bbox.height),
        1,
      ),
    );
    setViewportZoom(zoom);
    setViewportOffset({
      x: rect.width / 2 - (bbox.x + bbox.width / 2),
      y: rect.height / 2 - (bbox.y + bbox.height / 2),
    });
  };

  // When a boxed element is selected, new elements inherit its size so a
  // user can rapidly build a sequence of similarly-sized nodes.
  const sizeFromSelection = (): { width: number; height: number } | null => {
    if (!selectedId) return null;
    const sel = activeTab.elements.find((el) => el.id === selectedId);
    if (!sel || !isBoxed(sel)) return null;
    return { width: sel.width, height: sel.height };
  };

  const addBoxed = <T extends BoxedElement>(make: (x: number, y: number) => T) => {
    const base = make(0, 0);
    const override = sizeFromSelection();
    let width = override?.width ?? base.width;
    let height = override?.height ?? base.height;
    // Circles and diamonds are inherently 1:1 — inheriting a non-square
    // size from the selection would squash them. Snap them back to a square
    // using the larger inherited dimension so they stay visible.
    if (base.type === 'shape' && (base.shape === 'circle' || base.shape === 'diamond')) {
      const side = Math.max(width, height);
      width = side;
      height = side;
    }
    // Derive colours from the active tab when it has been recoloured, so
    // newly added elements harmonise with the user's chosen palette instead
    // of clashing with brand defaults. Sticky notes keep their amber palette
    // because the yellow note is iconic.
    const bg = activeTab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
    const patternColor = activeTab.patternColor ?? DEFAULT_PATTERN_COLOR;
    const colours: Partial<BoxedElement> = {};
    if (base.type === 'shape') {
      const derived = deriveShapeColours(patternColor, bg);
      if (derived) {
        colours.fillColor = derived.fill;
        colours.strokeColor = derived.stroke;
        colours.textColor = derived.text;
      }
    } else if (base.type === 'text') {
      if (bg !== DEFAULT_BACKGROUND_COLOR) {
        colours.textColor = deriveTextColorForBg(bg);
      }
    }
    const centre = getViewportCenter();
    const el: T = {
      ...base,
      ...colours,
      x: centre.x - width / 2,
      y: centre.y - height / 2,
      width,
      height,
    };
    // Single commit that both adds the element and marks the template
    // picker as dismissed for this tab (if it was still showing).
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? { ...t, elements: [...t.elements, el], templateChosen: true }
          : t,
      ),
    );
    setSelectedId(el.id);
  };

  // --- Selection helpers ---------------------------------------------------

  const memberIdsOf = (id: string | null): Set<string> => {
    if (!id) return new Set();
    return new Set(selectionMembers(activeTab.elements, id));
  };

  // --- Modes ---------------------------------------------------------------

  const exitFormatPainter = () => setFormatSourceId(null);
  const exitGroupMode = () => setGroupSourceId(null);

  const applyFormatFromSource = (targetId: string) => {
    if (!formatSourceId) return;
    const source = activeTab.elements.find((el) => el.id === formatSourceId);
    const target = activeTab.elements.find((el) => el.id === targetId);
    if (!source || !target || !isBoxed(source) || !isBoxed(target) || source.id === target.id) {
      setFormatSourceId(null);
      return;
    }
    commit((els) =>
      els.map((el) =>
        el.id === targetId && isBoxed(el) ? { ...el, width: source.width, height: source.height } : el,
      ),
    );
    setFormatSourceId(null);
  };

  const completeGrouping = (targetId: string) => {
    if (!groupSourceId) return;
    commit((els) => joinGroups(els, groupSourceId, targetId));
    setSelectedId(targetId);
  };

  // --- Tab actions ---------------------------------------------------------

  const addTab = () => {
    const tab = createTab(`Tab ${tabs.length + 1}`);
    commitTabs((ts) => [...ts, tab]);
    setActiveId(tab.id);
    setSelectedId(null);
    setEditingId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };

  const renameTab = (id: string, name: string) => {
    commitTabs((ts) => ts.map((t) => (t.id === id ? { ...t, name } : t)));
  };

  const duplicateTab = (id: string) => {
    const src = tabs.find((t) => t.id === id);
    if (!src) return;
    const copy: Tab = {
      ...src,
      id: crypto.randomUUID(),
      name: `${src.name} copy`,
      elements: src.elements.map((el) => ({ ...el })),
    };
    const srcIndex = tabs.findIndex((t) => t.id === id);
    commitTabs((ts) => {
      const next = [...ts];
      next.splice(srcIndex + 1, 0, copy);
      return next;
    });
    setActiveId(copy.id);
    setSelectedId(null);
    setEditingId(null);
  };

  const deleteTab = (id: string) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    commitTabs((ts) => ts.filter((t) => t.id !== id));
    if (activeId === id) {
      const fallback = tabs[idx + 1] ?? tabs[idx - 1];
      if (fallback) setActiveId(fallback.id);
    }
    setSelectedId(null);
    setEditingId(null);
  };

  const reorderTabs = (sourceId: string, targetId: string) => {
    commitTabs((ts) => {
      const srcIdx = ts.findIndex((t) => t.id === sourceId);
      const tgtIdx = ts.findIndex((t) => t.id === targetId);
      if (srcIdx < 0 || tgtIdx < 0 || srcIdx === tgtIdx) return ts;
      const next = [...ts];
      const [moved] = next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, moved!);
      return next;
    });
  };

  const chooseTemplate = (kind: TemplateKind) => {
    const centre = getViewportCenter();
    const elements = buildTemplate(kind, centre.x, centre.y);
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId ? { ...t, elements, templateChosen: true } : t,
      ),
    );
    setSelectedId(null);
    setEditingId(null);
  };

  const clearTabContent = () => {
    commit(() => []);
    setSelectedId(null);
    setEditingId(null);
  };

  const setBackgroundPattern = (pattern: BackgroundPattern) => {
    commitTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, backgroundPattern: pattern } : t)),
    );
  };

  const setBackgroundColor = (color: string) => {
    commitTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, backgroundColor: color } : t)),
    );
  };

  const setPatternColor = (color: string) => {
    commitTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, patternColor: color } : t)),
    );
  };

  // --- Element CRUD --------------------------------------------------------

  const addShape = (kind: ShapeKind) => addBoxed((x, y) => createShape(kind, x, y));
  const addText = () => addBoxed((x, y) => createText(x, y));
  const addSticky = () => addBoxed((x, y) => createSticky(x, y));

  const handleCanvasDoubleClick = (x: number, y: number) => {
    const TEXT_W = 160;
    const TEXT_H = 48;
    const el = createText(x - TEXT_W / 2, y - TEXT_H / 2);
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? { ...t, elements: [...t.elements, el], templateChosen: true }
          : t,
      ),
    );
    setSelectedId(el.id);
    setEditingId(el.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) =>
      els.filter((el) => {
        if (ids.has(el.id)) return false;
        if (el.type === 'arrow' && arrowReferencesAny(el, ids)) return false;
        return true;
      }),
    );
    setSelectedId(null);
    setEditingId(null);
  };

  const toggleLockSelected = () => {
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source) return;
    const shouldLock = !(source.locked === true);
    const ids = memberIdsOf(selectedId);
    commit((els) => els.map((el) => (ids.has(el.id) ? { ...el, locked: shouldLock } : el)));
  };

  const toggleAspectLockSelected = () => {
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source || !isBoxed(source)) return;
    const shouldLock = !(source.aspectLocked === true);
    const ids = memberIdsOf(selectedId);
    commit((els) =>
      els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, aspectLocked: shouldLock } : el)),
    );
  };

  const bringSelectedToFront = () => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) => bringManyToFront(els, ids));
  };

  const sendSelectedToBack = () => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) => sendManyToBack(els, ids));
  };

  const setTextSizeSelected = (size: TextSize) => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) =>
      els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, textSize: size } : el)),
    );
  };

  const setTextAlignSelected = (x: TextAlignX, y: TextAlignY) => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && isBoxed(el) ? { ...el, textAlignX: x, textAlignY: y } : el,
      ),
    );
  };

  const setFillColorSelected = (color: string) => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && (el.type === 'shape' || el.type === 'sticky')
          ? { ...el, fillColor: color }
          : el,
      ),
    );
  };

  const setStrokeColorSelected = (color: string) => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && (el.type === 'shape' || el.type === 'sticky')
          ? { ...el, strokeColor: color }
          : el,
      ),
    );
  };

  const setTextColorSelected = (color: string) => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) =>
      els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, textColor: color } : el)),
    );
  };

  const setOpacitySelected = (opacity: number) => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) =>
      els.map((el) => (ids.has(el.id) ? { ...el, opacity } : el)),
    );
  };

  const duplicateSelected = () => {
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source) return;
    // Element-only duplicate: clones just this element (not arrows attached
    // to it), offset diagonally so it's visible next to the original.
    const offset = 24;
    if (isBoxed(source)) {
      const copy: BoxedElement = {
        ...source,
        id: crypto.randomUUID(),
        x: source.x + offset,
        y: source.y + offset,
        // Drop group membership — the duplicate is independent.
        groupId: undefined,
      };
      commit((els) => [...els, copy]);
      setSelectedId(copy.id);
      return;
    }
    if (source.type === 'arrow') {
      // For arrows, shift any free endpoints; pinned endpoints stay attached
      // to the same shape. The duplicate represents an extra arrow with the
      // same connection pattern as the original.
      const shift = (e: typeof source.from) =>
        e.kind === 'free' ? { ...e, x: e.x + offset, y: e.y + offset } : e;
      const copy: ArrowElement = {
        ...source,
        id: crypto.randomUUID(),
        from: shift(source.from),
        to: shift(source.to),
      };
      commit((els) => [...els, copy]);
      setSelectedId(copy.id);
    }
  };

  const duplicateConnectSelected = (
    direction: 'right' | 'below' | 'left' | 'above',
  ) => {
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source || !isBoxed(source)) return;
    const ids = memberIdsOf(selectedId);
    const groupBounds = unionBoxedBounds(activeTab.elements, ids);
    const gap = 40;
    const w = (groupBounds?.width ?? source.width) + gap;
    const h = (groupBounds?.height ?? source.height) + gap;
    const baseBounds = groupBounds ?? {
      x: source.x,
      y: source.y,
      width: source.width,
      height: source.height,
    };
    const step = {
      x: direction === 'right' ? w : direction === 'left' ? -w : 0,
      y: direction === 'below' ? h : direction === 'above' ? -h : 0,
    };
    // Step further in the same direction until the duplicate's bounding box
    // doesn't overlap any existing element. Keeps long chains of duplicates
    // properly spaced even if the user clicks faster than the selection
    // visually catches up.
    let dx = step.x;
    let dy = step.y;
    for (let attempt = 0; attempt < 20; attempt++) {
      const proposed = {
        x: baseBounds.x + dx,
        y: baseBounds.y + dy,
        width: baseBounds.width,
        height: baseBounds.height,
      };
      const overlaps = activeTab.elements.some((el) => {
        if (!isBoxed(el) || ids.has(el.id)) return false;
        return !(
          proposed.x + proposed.width <= el.x ||
          el.x + el.width <= proposed.x ||
          proposed.y + proposed.height <= el.y ||
          el.y + el.height <= proposed.y
        );
      });
      if (!overlaps) break;
      dx += step.x;
      dy += step.y;
    }
    const { newElements, idMap } = duplicateGroupedElements(activeTab.elements, ids, dx, dy);
    const sourceCopyId = idMap.get(source.id);
    if (!sourceCopyId) return;
    // Connector arrow goes between adjacent edges of source and its copy.
    const anchors: Record<typeof direction, [Anchor, Anchor]> = {
      right: ['e', 'w'],
      left: ['w', 'e'],
      below: ['s', 'n'],
      above: ['n', 's'],
    };
    const [fromAnchor, toAnchor] = anchors[direction];
    const connector = createPinnedArrow(source.id, fromAnchor, sourceCopyId, toAnchor);
    commit((els) => [...els, ...newElements, connector]);
    setSelectedId(sourceCopyId);
  };

  const beginFormatPainter = () => {
    if (!selectedId) return;
    setFormatSourceId(selectedId);
    setGroupSourceId(null);
  };

  const beginGroup = () => {
    if (!selectedId) return;
    setGroupSourceId(selectedId);
    setFormatSourceId(null);
  };

  const ungroupSelected = () => {
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source || !isBoxed(source) || source.groupId === undefined) return;
    const groupId = source.groupId;
    commit((els) => ungroup(els, groupId));
  };

  const beginEdit = (elementId: string) => {
    if (formatSourceId !== null) return;
    setGroupSourceId(null);
    setSelectedId(elementId);
    setEditingId(elementId);
  };

  const commitLabel = (elementId: string, label: string) => {
    commit((els) => els.map((el) => (el.id === elementId && isBoxed(el) ? { ...el, label } : el)));
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  // --- Drag handlers -------------------------------------------------------

  const beginDrag = (elementId: string, mode: DragMode, e: ReactPointerEvent) => {
    if (formatSourceId !== null && mode === 'move') {
      applyFormatFromSource(elementId);
      return;
    }
    if (groupSourceId !== null && mode === 'move') {
      completeGrouping(elementId);
      return;
    }
    if (editingId === elementId) return;
    const element = activeTab.elements.find((el) => el.id === elementId);
    if (!element || !isBoxed(element)) return;
    setSelectedId(elementId);
    if (element.locked === true) return;

    const ids =
      mode === 'move' && element.groupId
        ? new Set(selectionMembers(activeTab.elements, elementId))
        : new Set<string>([elementId]);

    const startBounds = new Map<string, ShapeBounds>();
    for (const el of activeTab.elements) {
      if (ids.has(el.id) && isBoxed(el)) {
        startBounds.set(el.id, { x: el.x, y: el.y, width: el.width, height: el.height });
      }
    }

    markCheckpoint();
    setDrag({
      kind: 'boxed',
      primaryId: elementId,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBounds,
      aspectLocked: element.aspectLocked === true,
    });
  };

  const beginAnchorDrag = (elementId: string, anchor: Anchor, e: ReactPointerEvent) => {
    if (formatSourceId !== null || groupSourceId !== null) return;
    const element = activeTab.elements.find((el) => el.id === elementId);
    if (!element || !isBoxed(element) || element.locked === true) return;
    const start = anchorPosition(element, anchor);
    const arrow: ArrowElement = {
      id: crypto.randomUUID(),
      type: 'arrow',
      from: { kind: 'pinned', elementId, anchor },
      to: { kind: 'free', x: start.x, y: start.y },
    };
    commit((els) => [...els, arrow]);
    setSelectedId(arrow.id);
    setDrag({
      kind: 'arrow-endpoint',
      arrowId: arrow.id,
      end: 'to',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCanvasX: start.x,
      startCanvasY: start.y,
    });
  };

  const selectElement = (id: string) => {
    if (formatSourceId !== null) {
      setFormatSourceId(null);
      return;
    }
    if (groupSourceId !== null) {
      setGroupSourceId(null);
      return;
    }
    setSelectedId(id);
  };

  const beginEndpointDrag = (arrowId: string, end: ArrowEnd, e: ReactPointerEvent) => {
    if (formatSourceId !== null || groupSourceId !== null) return;
    const arrow = activeTab.elements.find((el) => el.id === arrowId);
    if (!arrow || arrow.type !== 'arrow') return;
    setSelectedId(arrowId);
    if (arrow.locked === true) return;
    const start = endpointPosition(end === 'from' ? arrow.from : arrow.to, activeTab.elements);
    markCheckpoint();
    setDrag({
      kind: 'arrow-endpoint',
      arrowId,
      end,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCanvasX: start.x,
      startCanvasY: start.y,
    });
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      // Screen-pixel delta → canvas-coord delta, accounting for current zoom.
      const dx = (e.clientX - drag.startClientX) / zoomRef.current;
      const dy = (e.clientY - drag.startClientY) / zoomRef.current;

      if (drag.kind === 'boxed') {
        if (drag.mode === 'move') {
          // Snap the primary's candidate bounds to align with other
          // elements' edges/centres; apply the same nudge to every group
          // member so they translate together.
          const primaryStart = drag.startBounds.get(drag.primaryId);
          const memberIds = new Set(drag.startBounds.keys());
          let snapDx = 0;
          let snapDy = 0;
          if (primaryStart) {
            const candidate = {
              x: primaryStart.x + dx,
              y: primaryStart.y + dy,
              width: primaryStart.width,
              height: primaryStart.height,
            };
            const snap = snapToAlignment(
              candidate,
              activeTab.elements,
              memberIds,
              ALIGN_SNAP_THRESHOLD,
            );
            snapDx = snap.dx;
            snapDy = snap.dy;
          }
          tick((els) =>
            els.map((el) => {
              if (!isBoxed(el)) return el;
              const start = drag.startBounds.get(el.id);
              if (!start) return el;
              return { ...el, x: start.x + dx + snapDx, y: start.y + dy + snapDy };
            }),
          );
        } else {
          const start = drag.startBounds.get(drag.primaryId);
          if (!start) return;
          const next = nextBounds(start, drag.mode, dx, dy, drag.aspectLocked);
          tick((els) =>
            els.map((el) =>
              el.id === drag.primaryId && isBoxed(el) ? { ...el, ...next } : el,
            ),
          );
        }
        return;
      }

      const cursor = { x: drag.startCanvasX + dx, y: drag.startCanvasY + dy };
      tick((els) => {
        const snap = snapToAnchor(cursor, els, SNAP_THRESHOLD);
        const endpoint: Endpoint = snap
          ? { kind: 'pinned', elementId: snap.elementId, anchor: snap.anchor }
          : { kind: 'free', x: cursor.x, y: cursor.y };
        return els.map((el) =>
          el.id === drag.arrowId && el.type === 'arrow' ? { ...el, [drag.end]: endpoint } : el,
        );
      });
    };
    const onUp = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, activeId]);

  useEffect(() => {
    if (formatSourceId === null && groupSourceId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFormatSourceId(null);
        setGroupSourceId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [formatSourceId, groupSourceId]);

  return (
    <div className="flex h-dvh flex-col">
      <EditorHeader diagramName={diagramName} onRename={setDiagramName} />
      <Canvas
        tabName={activeTab.name}
        tabBackgroundPattern={activeTab.backgroundPattern ?? 'grid'}
        tabBackgroundColor={activeTab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR}
        tabPatternColor={activeTab.patternColor ?? DEFAULT_PATTERN_COLOR}
        mainRef={canvasMainRef}
        viewportZoom={viewportZoom}
        setViewportZoom={setViewportZoom}
        onFitToScreen={fitToScreen}
        viewportOffset={viewportOffset}
        setViewportOffset={setViewportOffset}
        elements={activeTab.elements}
        selectedId={selectedId}
        editingId={editingId}
        formatSourceId={formatSourceId}
        groupSourceId={groupSourceId}
        palettePosition={palettePosition}
        paletteMinimized={paletteMinimized}
        canUndo={canUndo}
        canRedo={canRedo}
        onAddShape={addShape}
        onAddText={addText}
        onAddSticky={addSticky}
        onUndo={undo}
        onRedo={redo}
        onMovePalette={(x, y) => setPalettePosition({ x, y })}
        onToggleMinimized={() => setPaletteMinimized((v) => !v)}
        onDeselect={() => {
          setSelectedId(null);
          setEditingId(null);
          setFormatSourceId(null);
          setGroupSourceId(null);
        }}
        onSelect={selectElement}
        onBeginDrag={beginDrag}
        onBeginAnchorDrag={beginAnchorDrag}
        onBeginEdit={beginEdit}
        onCommitLabel={commitLabel}
        onCancelEdit={cancelEdit}
        onBeginEndpointDrag={beginEndpointDrag}
        onBeginFormatPainter={beginFormatPainter}
        onCancelFormatPainter={exitFormatPainter}
        onBeginGroup={beginGroup}
        onCancelGroup={exitGroupMode}
        onUngroup={ungroupSelected}
        onBringToFront={bringSelectedToFront}
        onSendToBack={sendSelectedToBack}
        onSetTextSize={setTextSizeSelected}
        onSetTextAlign={setTextAlignSelected}
        onSetFillColor={setFillColorSelected}
        onSetStrokeColor={setStrokeColorSelected}
        onSetTextColor={setTextColorSelected}
        onSetOpacity={setOpacitySelected}
        onDuplicateSelected={duplicateSelected}
        showTemplatePicker={
          activeTab.elements.length === 0 && activeTab.templateChosen !== true
        }
        onChooseTemplate={chooseTemplate}
        onSetBackgroundPattern={setBackgroundPattern}
        onClearTabContent={clearTabContent}
        onSetBackgroundColor={setBackgroundColor}
        onSetPatternColor={setPatternColor}
        onToggleAspectLock={toggleAspectLockSelected}
        onDuplicateConnect={duplicateConnectSelected}
        onToggleLockSelected={toggleLockSelected}
        onDeleteSelected={deleteSelected}
        onCanvasDoubleClick={handleCanvasDoubleClick}
      />
      <TabBar
        tabs={tabs}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id);
          setSelectedId(null);
          setEditingId(null);
          setFormatSourceId(null);
          setGroupSourceId(null);
        }}
        onAdd={addTab}
        onRename={renameTab}
        onDuplicate={duplicateTab}
        onDelete={deleteTab}
        onReorder={reorderTabs}
      />
    </div>
  );
}
