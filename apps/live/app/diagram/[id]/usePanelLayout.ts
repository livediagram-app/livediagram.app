import { useState } from 'react';

type Pos = { x: number; y: number };

// Floating-panel layout: where each draggable panel sits and whether the
// collapsible ones are open. A self-contained slice of the editor's UI
// state (no diagram-data coupling), lifted out of useEditorState so the
// view-model is composed from domain slices rather than one flat bag of
// useState calls.
//
// Positions are null until the user drags a panel, after which it
// remembers its spot. `editorExpandSignal` is a monotonic counter the
// Editor accordion watches so callers can pop it open on demand via
// `requestEditorOpen()` without holding a ref to the panel.
export function usePanelLayout() {
  const [palettePosition, setPalettePosition] = useState<Pos | null>(null);
  const [explorerPosition, setExplorerPosition] = useState<Pos | null>(null);
  const [contextPosition, setContextPosition] = useState<Pos | null>(null);
  const [activityPosition, setActivityPosition] = useState<Pos | null>(null);
  const [commentsPanelPosition, setCommentsPanelPosition] = useState<Pos | null>(null);
  const [aiPanelPosition, setAiPanelPosition] = useState<Pos | null>(null);
  const [aiPanelVisible, setAiPanelVisible] = useState(false);
  // Activity defaults to minimised: most users only peek at it
  // occasionally, and the dock button keeps it one click away.
  const [activityMinimized, setActivityMinimized] = useState(true);
  // Zen / focus mode (spec/26): hide all floating chrome (header, tab
  // bar, panels, docks) so only the canvas content + zoom controls
  // remain. Purely a view flag — not persisted, not synced.
  const [zenMode, setZenMode] = useState(false);
  const [editorExpandSignal, setEditorExpandSignal] = useState(0);
  const requestEditorOpen = () => setEditorExpandSignal((n) => n + 1);

  return {
    palettePosition,
    setPalettePosition,
    explorerPosition,
    setExplorerPosition,
    contextPosition,
    setContextPosition,
    activityPosition,
    setActivityPosition,
    commentsPanelPosition,
    setCommentsPanelPosition,
    aiPanelPosition,
    setAiPanelPosition,
    aiPanelVisible,
    setAiPanelVisible,
    activityMinimized,
    setActivityMinimized,
    zenMode,
    setZenMode,
    editorExpandSignal,
    requestEditorOpen,
  };
}
