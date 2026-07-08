import { useState } from 'react';

type Pos = { x: number; y: number };

// Floating-panel layout: where each draggable panel sits and whether the
// collapsible ones are open. A self-contained slice of the editor's UI
// state (no diagram-data coupling), lifted out of useEditorState so the
// view-model is composed from domain slices rather than one flat bag of
// useState calls.
//
// Positions are null until the user drags a panel, after which it
// remembers its spot.
export function usePanelLayout() {
  const [palettePosition, setPalettePosition] = useState<Pos | null>(null);
  const [explorerPosition, setExplorerPosition] = useState<Pos | null>(null);
  const [activityPosition, setActivityPosition] = useState<Pos | null>(null);
  const [mapPosition, setMapPosition] = useState<Pos | null>(null);
  const [commentsPanelPosition, setCommentsPanelPosition] = useState<Pos | null>(null);
  const [aiPanelPosition, setAiPanelPosition] = useState<Pos | null>(null);
  const [aiPanelVisible, setAiPanelVisible] = useState(false);
  // Activity defaults to minimised: most users only peek at it
  // occasionally, and the dock button keeps it one click away.
  const [activityMinimized, setActivityMinimized] = useState(true);
  // Layers panel (spec/74): same pattern — minimised into a bottom-right
  // dock button until the user opts in, so default chrome is unchanged.
  const [layersPanelPosition, setLayersPanelPosition] = useState<Pos | null>(null);
  const [layersMinimized, setLayersMinimized] = useState(true);
  // Zen / focus mode (spec/26): hide all floating chrome (header, tab
  // bar, panels, docks) so only the canvas content + zoom controls
  // remain. Purely a view flag — not persisted, not synced.
  const [zenMode, setZenMode] = useState(false);

  return {
    palettePosition,
    setPalettePosition,
    explorerPosition,
    setExplorerPosition,
    activityPosition,
    setActivityPosition,
    mapPosition,
    setMapPosition,
    commentsPanelPosition,
    setCommentsPanelPosition,
    aiPanelPosition,
    setAiPanelPosition,
    aiPanelVisible,
    setAiPanelVisible,
    activityMinimized,
    setActivityMinimized,
    layersPanelPosition,
    setLayersPanelPosition,
    layersMinimized,
    setLayersMinimized,
    zenMode,
    setZenMode,
  };
}
