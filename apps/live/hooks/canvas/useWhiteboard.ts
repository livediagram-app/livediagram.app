'use client';

// The whiteboard dock's state and actions (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard
// shows"). The dock tool in hand is DERIVED from the editor's canvas tool and
// armed intent (activeWhiteboardTool), so the dock can never disagree with the
// canvas; this hook owns only the device-local prefs (pens, recognition,
// eraser mode) and turns dock presses into ordinary editor calls.

import { useEffect, useRef, useState } from 'react';
import {
  isWhiteboardTab,
  WHITEBOARD_BACKGROUNDS,
  type BackgroundPattern,
  type Tab,
} from '@livediagram/diagram';
import type { CanvasTool } from '@/components/palette/CommandPalette.types';
import type { PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import {
  loadWhiteboardPrefs,
  penTelemetryType,
  saveWhiteboardPrefs,
  type WhiteboardEraserMode,
  type WhiteboardPenId,
  type WhiteboardPrefs,
} from '@/lib/whiteboard-prefs';
import {
  WHITEBOARD_SHAPES,
  activeWhiteboardTool,
  whiteboardPenIntent,
  type WhiteboardShapeId,
  type WhiteboardTool,
} from '@/lib/whiteboard-tool';

type Deps = {
  activeTab: Tab;
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
  setBackgroundPattern: (pattern: BackgroundPattern) => void;
};

export type WhiteboardDockModel = ReturnType<typeof useWhiteboard>;

const BACKGROUND_TOKEN = {
  plain: 'BackgroundPlain',
  dots: 'BackgroundDots',
  grid: 'BackgroundGrid',
};

export function useWhiteboard(deps: Deps) {
  const {
    activeTab,
    canvasTool,
    pendingDraw,
    editsBlocked,
    setCanvasTool,
    selectCanvasTool,
    beginDraw,
    cancelDraw,
    setBackgroundPattern,
  } = deps;
  const whiteboard = isWhiteboardTab(activeTab);
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
    if (canvasTool === 'eraser' || canvasTool === 'highlighter') setCanvasTool('select');
    beginDraw(whiteboardPenIntent(pen, next.recognise));
  };

  // Entering a whiteboard puts the active pen in hand (D2): "pick up a pen and
  // draw". Only when nothing else is held, so a mode the user chose survives.
  // Leaving one puts a whiteboard pen down, so it cannot leak onto a diagram tab.
  // "Entering" is a new active tab, or the open tab becoming a whiteboard
  // (Quick Start on a fresh tab).
  const seenRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${activeTab.id}:${whiteboard}`;
    const entered = seenRef.current !== key;
    seenRef.current = key;
    if (!whiteboard) {
      if (pendingDraw?.type === 'freehand' && pendingDraw.variant === 'whiteboard') cancelDraw();
      return;
    }
    if (!entered || editsBlocked || pendingDraw) return;
    if (canvasTool !== 'select' && canvasTool !== 'pan') return;
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
    if (pen) track('Whiteboard', 'Selected', penTelemetryType(pen));
  };

  const updatePen = (id: WhiteboardPenId, patch: { colour?: string | null; width?: number }) => {
    const next = {
      ...prefs,
      pens: prefs.pens.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    };
    setPrefs(next);
    if (tool === 'pen' && prefs.activePenId === id) armPen(next);
    if (patch.colour !== undefined) {
      const pen = next.pens.find((p) => p.id === id);
      if (pen) track('Whiteboard', 'Selected', penTelemetryType(pen));
    }
  };

  const pickHighlighter = () => {
    cancelDraw();
    selectCanvasTool('highlighter');
  };

  const pickEraser = () => {
    cancelDraw();
    selectCanvasTool('eraser');
  };

  const setEraserMode = (mode: WhiteboardEraserMode) => {
    if (mode === prefs.eraserMode) return;
    setPrefs({ ...prefs, eraserMode: mode });
    track('Whiteboard', 'Changed', mode === 'partial' ? 'EraserPartial' : 'EraserStroke');
  };

  const pickIntent = (intent: PendingDraw) => {
    setCanvasTool('select');
    beginDraw(intent);
  };

  const pickShape = (id: WhiteboardShapeId) => {
    const shape = WHITEBOARD_SHAPES.find((s) => s.id === id);
    if (shape) pickIntent(shape.intent);
  };

  const toggleRecognition = () => {
    const next = { ...prefs, recognise: !prefs.recognise };
    setPrefs(next);
    if (tool === 'pen') armPen(next);
    track('Whiteboard', 'Toggled', next.recognise ? 'RecognitionOn' : 'RecognitionOff');
  };

  const setBackground = (id: (typeof WHITEBOARD_BACKGROUNDS)[number]['id']) => {
    const bg = WHITEBOARD_BACKGROUNDS.find((b) => b.id === id);
    if (!bg || bg.pattern === (activeTab.backgroundPattern ?? 'blank')) return;
    setBackgroundPattern(bg.pattern);
    track('Whiteboard', 'Changed', BACKGROUND_TOKEN[bg.id]);
  };

  return {
    whiteboard,
    tool,
    prefs,
    activePen,
    background: activeTab.backgroundPattern ?? 'blank',
    pickSelect,
    pickPen,
    updatePen,
    pickHighlighter,
    pickEraser,
    setEraserMode,
    pickSticky: () => pickIntent({ type: 'sticky' }),
    pickText: () => pickIntent({ type: 'text' }),
    pickShape,
    toggleRecognition,
    setBackground,
  };
}
