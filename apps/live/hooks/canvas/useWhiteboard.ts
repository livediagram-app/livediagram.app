'use client';

// The whiteboard dock's state and actions (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard
// shows"). The dock tool in hand is DERIVED from the editor's canvas tool and
// armed intent (activeWhiteboardTool), so the dock can never disagree with the
// canvas; this hook owns only the device-local prefs (pens, recognition,
// eraser mode) and turns dock presses into ordinary editor calls.

import { useEffect, useRef, useState } from 'react';
import type { PenCursorVariant } from '@/lib/whiteboard-pen-cursor';
import { WHITEBOARD_BACKGROUNDS, type PenColour, type Tab } from '@livediagram/document';
import type { CanvasTool } from '@/components/palette/CommandPalette.types';
import { isWhiteboardOnlyIntent, type PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import {
  DEFAULT_WHITEBOARD_PREFS,
  loadWhiteboardPrefs,
  penTelemetryType,
  saveWhiteboardPrefs,
  type WhiteboardEraserMode,
  type WhiteboardPenId,
  type WhiteboardPrefs,
} from '@/lib/whiteboard-prefs';
import {
  activeWhiteboardTool,
  whiteboardPenIntent,
  type WhiteboardTool,
} from '@/lib/whiteboard-tool';
import {
  armedWhiteboardShape,
  whiteboardShapeEntry,
  type WhiteboardShapeKey,
} from '@/lib/whiteboard-shape-catalogue';
import { useWhiteboardDockPrefs, type WhiteboardDockPrefsDeps } from './useWhiteboardDockPrefs';
import { DRAW_PATTERNS } from '@/lib/whiteboard-dock-prefs';
import { usePenColourMemory } from './usePenColourMemory';
import type { SnapColoursApi } from './useSnapColours';

type Deps = {
  activeTab: Tab;
  // The viewer works on the tab in Draw mode (docs/specs/007-editor/editor-modes.md): the dock,
  // its pens and its rules are in focus.
  drawMode: boolean;
  canvasTool: CanvasTool;
  pendingDraw: PendingDraw | null;
  // True when this viewer cannot add to the tab (read-only, locked, loading).
  editsBlocked: boolean;
  // The raw setter: dock switches are not "picked a mode from the palette".
  setCanvasTool: (tool: CanvasTool) => void;
  // The tracked setter, for the modes the palette also counts (eraser, highlighter).
  selectCanvasTool: (tool: CanvasTool) => void;
  beginDraw: (intent: PendingDraw) => void;
  cancelDraw: () => void;
  // A path is open in its edit mode (docs/specs/023-whiteboard/path-tool.md "Editing"), and how to
  // leave it: the dock presses Select with a path glyph meanwhile.
  pathEditing: boolean;
  leavePathEdit: () => void;
  // Snap colours (docs/specs/023-whiteboard/whiteboard.md "Snap colours"), for the Settings flyout.
  snapColours: SnapColoursApi;
} & WhiteboardDockPrefsDeps;

export type WhiteboardDockModel = ReturnType<typeof useWhiteboard>;

const BACKGROUND_TOKEN = {
  plain: 'BackgroundPlain',
  dots: 'BackgroundDots',
  grid: 'BackgroundGrid',
};

export function useWhiteboard(deps: Deps) {
  const {
    activeTab,
    drawMode: whiteboard,
    canvasTool,
    pendingDraw,
    editsBlocked,
    setCanvasTool,
    selectCanvasTool,
    beginDraw,
    cancelDraw,
    pathEditing,
    leavePathEdit,
  } = deps;
  // The synced dock preferences: pinned shapes and pick counts ("Shape slots").
  const dockPrefs = useWhiteboardDockPrefs(deps);
  // Your colours ("The colour picker"), synced too.
  const colourMemory = usePenColourMemory(deps);
  // S (docs/specs/023-whiteboard/whiteboard.md "Keyboard shortcuts"): each press raises this, and
  // the dock, which owns its flyouts, opens the Shapes flyout in answer.
  const [shapesRequest, setShapesRequest] = useState(0);
  // Read lazily from this browser (readLocalStorageSafe copes with no storage).
  const [prefs, setPrefsState] = useState<WhiteboardPrefs>(loadWhiteboardPrefs);
  const setPrefs = (next: WhiteboardPrefs) => {
    setPrefsState(next);
    saveWhiteboardPrefs(next);
  };
  const tool: WhiteboardTool = activeWhiteboardTool(canvasTool, pendingDraw);
  const activePen = prefs.pens.find((p) => p.id === prefs.activePenId) ?? prefs.pens[0]!;

  const armPen = (next: WhiteboardPrefs) => {
    const pen = next.pens.find((p) => p.id === next.activePenId) ?? next.pens[0]!;
    if (canvasTool !== 'select' && canvasTool !== 'pan') setCanvasTool('select');
    beginDraw(whiteboardPenIntent(pen, next.recognise));
  };

  // Entering Draw mode on an empty tab puts the active pen in hand (D2): "pick up a
  // pen and draw". A tab with content opens on Select. Only when nothing
  // else is held, so a mode the user chose survives.
  // "Entering" is a new active tab in Draw mode, or the open tab switched into it.
  // Leaving a mode puts its tool down (docs/specs/007-editor/editor-modes.md "What a mode brings
  // into focus"): a pen, the eraser or an armed shape never carries over into the other mode.
  const seenRef = useRef<string | null>(null);
  const modeRef = useRef<boolean | null>(null);
  useEffect(() => {
    const key = `${activeTab.id}:${whiteboard}`;
    const entered = seenRef.current !== key;
    seenRef.current = key;
    const switched = modeRef.current !== null && modeRef.current !== whiteboard;
    modeRef.current = whiteboard;
    const eraserCarried = switched && canvasTool === 'eraser';
    if (!whiteboard) {
      // A whiteboard pen, the Path tool or a dock shape is put down: none exists in Diagram
      // mode, and a dock shape would preview and be named the board's way there.
      if (isWhiteboardOnlyIntent(pendingDraw)) cancelDraw();
      if (eraserCarried) setCanvasTool('select');
      return;
    }
    // A shape armed from the palette is Diagram mode's own: switching into Draw puts it down.
    const shapeCarried = switched && !!pendingDraw && !isWhiteboardOnlyIntent(pendingDraw);
    if (shapeCarried) cancelDraw();
    // Draw mode has no highlighter or format painter, and the eraser does not come across a
    // switch: each is put down, and the pen picked up in its place.
    const heldElsewhere = canvasTool === 'highlighter' || canvasTool === 'format' || eraserCarried;
    if (!entered) return;
    if (heldElsewhere) setCanvasTool('select');
    if (editsBlocked || (pendingDraw && !shapeCarried)) return;
    if (canvasTool !== 'select' && canvasTool !== 'pan' && !heldElsewhere) return;
    if (activeTab.elements.length > 0) return;
    armPen(prefs);
    // Runs on a tab change only; the rest is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab.id, whiteboard, editsBlocked]);

  const pickSelect = () => {
    cancelDraw();
    setCanvasTool('select');
  };

  const pickPen = (id: WhiteboardPenId) => {
    const next = { ...prefs, activePenId: id };
    setPrefs(next);
    armPen(next);
    const pen = next.pens.find((p) => p.id === id);
    if (pen) track('Draw', 'Selected', penTelemetryType(pen));
  };

  const updatePen = (id: WhiteboardPenId, patch: { colour?: PenColour | null; width?: number }) => {
    const next = {
      ...prefs,
      pens: prefs.pens.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    };
    setPrefs(next);
    if (tool === 'pen' && prefs.activePenId === id) armPen(next);
    if (patch.colour !== undefined) {
      track('Draw', 'Changed', 'PenColour');
      colourMemory.remember(patch.colour);
    }
    if (patch.width !== undefined) track('Draw', 'Changed', 'PenWidth');
  };

  // Right-click on a pen: back to how it started, colour and width (docs/specs/023-whiteboard/whiteboard.md "Pens").
  const resetPen = (id: WhiteboardPenId) => {
    const preset = DEFAULT_WHITEBOARD_PREFS.pens.find((p) => p.id === id);
    const pen = prefs.pens.find((p) => p.id === id);
    if (!preset || !pen || (pen.colour === preset.colour && pen.width === preset.width)) return;
    const next = { ...prefs, pens: prefs.pens.map((p) => (p.id === id ? preset : p)) };
    setPrefs(next);
    if (tool === 'pen' && prefs.activePenId === id) armPen(next);
    track('Draw', 'Changed', 'PenReset');
  };

  // The Path tool (docs/specs/023-whiteboard/path-tool.md): held like a pen until another tool is picked.
  const pickPath = () => {
    setCanvasTool('select');
    beginDraw({ type: 'path' });
    track('Draw', 'Selected', 'Path');
  };

  const pickEraser = () => {
    cancelDraw();
    selectCanvasTool('eraser');
  };

  const setEraserMode = (mode: WhiteboardEraserMode) => {
    if (mode === prefs.eraserMode) return;
    setPrefs({ ...prefs, eraserMode: mode });
    track('Draw', 'Changed', mode === 'partial' ? 'EraserPartial' : 'EraserStroke');
  };

  const pickIntent = (intent: PendingDraw) => {
    setCanvasTool('select');
    beginDraw(intent);
  };

  // Any catalogue shape, from the Shapes flyout, a slot, More shapes or a key. Plain: a pen never
  // colours another tool (docs/specs/023-whiteboard/whiteboard.md "Shapes"). Every pick counts
  // towards the Shapes flyout's slots ("Shape slots").
  const pickShape = (key: WhiteboardShapeKey) => {
    const entry = whiteboardShapeEntry(key);
    if (!entry) {
      console.warn('[whiteboard] unknown shape', key);
      return;
    }
    pickIntent(entry.intent);
    dockPrefs.recordPick(key);
  };

  // A pick from the More shapes search: reported as one fixed token, never the kind.
  const pickSearchedShape = (key: WhiteboardShapeKey) => {
    pickShape(key);
    track('Draw', 'Selected', 'ShapeSearch');
  };

  const setRecognition = (on: boolean) => {
    if (on === prefs.recognise) return;
    const next = { ...prefs, recognise: on };
    setPrefs(next);
    if (tool === 'pen') armPen(next);
    track('Draw', 'Toggled', next.recognise ? 'RecognitionOn' : 'RecognitionOff');
  };

  const setCursor = (cursor: PenCursorVariant) => {
    if (cursor === prefs.cursor) return;
    setPrefs({ ...prefs, cursor });
    track('Draw', 'Changed', cursor === 'dot' ? 'CursorDot' : 'CursorCrosshair');
  };

  // The Background row writes the person's own Draw pattern, never the tab
  // (docs/specs/007-editor/editor-modes.md "One look").
  const setBackground = (id: (typeof WHITEBOARD_BACKGROUNDS)[number]['id']) => {
    const bg = WHITEBOARD_BACKGROUNDS.find((b) => b.id === id);
    const pattern = DRAW_PATTERNS.find((p) => p === bg?.pattern);
    if (!bg || !pattern || pattern === dockPrefs.pattern) return;
    track('Draw', 'Changed', BACKGROUND_TOKEN[bg.id]);
    dockPrefs.setPattern(pattern);
  };

  return {
    whiteboard,
    tool,
    prefs,
    activePen,
    background: dockPrefs.pattern,
    pickSelect,
    pickPen,
    updatePen,
    resetPen,
    colourMemory,
    pickEraser,
    setEraserMode,
    // The sticky note is a shape (docs/specs/023-whiteboard/whiteboard.md "Shape slots"): N counts
    // as a pick, like the shape keys.
    pickSticky: () => pickShape('sticky'),
    pickText: () => pickIntent({ type: 'text' }),
    pickShape,
    pickSearchedShape,
    shapesRequest,
    openShapes: () => setShapesRequest((n) => n + 1),
    // The catalogue shape in hand, if any: its slot shows pressed.
    armedShape: armedWhiteboardShape(pendingDraw),
    pinnedShapes: dockPrefs.pinned,
    slotShapes: dockPrefs.slots,
    applySlotOutcome: dockPrefs.applySlotOutcome,
    // Where the dock sits (docs/specs/023-whiteboard/whiteboard.md "Where the dock sits").
    position: dockPrefs.position,
    pickPath,
    pathEditing,
    leavePathEdit,
    setRecognition,
    setCursor,
    setBackground,
    snapColours: deps.snapColours,
  };
}
