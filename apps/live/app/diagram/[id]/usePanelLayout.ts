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
  // Live poll (spec/88): position only. The panel has no minimised state
  // because it isn't always there to minimise — it exists only while a
  // poll is running, and the host's End (or a local Dismiss) removes it.
  const [pollPanelPosition, setPollPanelPosition] = useState<Pos | null>(null);
  // Live vote (spec/39): same deal — present only while a vote is running.
  const [votePanelPosition, setVotePanelPosition] = useState<Pos | null>(null);
  // Avatar Panel (spec/101): present only while Avatar mode is active, so
  // position only — there is nothing to minimise when leaving the mode
  // dismisses the panel outright.
  const [avatarPanelPosition, setAvatarPanelPosition] = useState<Pos | null>(null);
  // Laser Panel (spec/111): the same — present only while the Laser tool is.
  const [laserPanelPosition, setLaserPanelPosition] = useState<Pos | null>(null);
  // Spotlight Panel (spec/112): the same.
  const [spotlightPanelPosition, setSpotlightPanelPosition] = useState<Pos | null>(null);
  // Eraser Panel (spec/113): the same.
  const [eraserPanelPosition, setEraserPanelPosition] = useState<Pos | null>(null);
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
    pollPanelPosition,
    setPollPanelPosition,
    votePanelPosition,
    setVotePanelPosition,
    avatarPanelPosition,
    setAvatarPanelPosition,
    laserPanelPosition,
    setLaserPanelPosition,
    spotlightPanelPosition,
    setSpotlightPanelPosition,
    eraserPanelPosition,
    setEraserPanelPosition,
    zenMode,
    setZenMode,
  };
}
