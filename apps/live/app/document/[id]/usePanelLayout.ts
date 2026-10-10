import { useState } from 'react';

type Pos = { x: number; y: number };

// Panel layout: where each draggable panel sits and whether the AI panel
// is open. A self-contained slice of the editor's UI
// state (no document-data coupling), lifted out of useEditorState so the
// view-model is composed from domain slices rather than one flat bag of
// useState calls.
//
// Positions are null until the user drags a panel, after which it
// remembers its spot.
export function usePanelLayout() {
  // The Explorer's spot on the status screens (error, not found), where it is a corner panel.
  const [explorerPosition, setExplorerPosition] = useState<Pos | null>(null);
  const [mapPosition, setMapPosition] = useState<Pos | null>(null);
  const [commentsPanelPosition, setCommentsPanelPosition] = useState<Pos | null>(null);
  const [aiPanelPosition, setAiPanelPosition] = useState<Pos | null>(null);
  const [aiPanelVisible, setAiPanelVisible] = useState(false);
  // Avatar Panel (docs/specs/008-canvas/avatar-mode.md): present only while Avatar mode is active, so
  // position only — there is nothing to minimise when leaving the mode
  // dismisses the panel outright. (Poll and Vote open over the Session strip's buttons, so they
  // keep no position: docs/specs/012-collaboration/session-tools.md.)
  const [avatarPanelPosition, setAvatarPanelPosition] = useState<Pos | null>(null);
  // Laser Panel (docs/specs/008-canvas/laser-panel.md): the same — present only while the Laser tool is.
  const [laserPanelPosition, setLaserPanelPosition] = useState<Pos | null>(null);
  // Spotlight Panel (docs/specs/008-canvas/spotlight-panel.md): the same.
  const [spotlightPanelPosition, setSpotlightPanelPosition] = useState<Pos | null>(null);
  // Eraser Panel (docs/specs/008-canvas/eraser-panel.md): the same.
  const [eraserPanelPosition, setEraserPanelPosition] = useState<Pos | null>(null);
  const [slideDeckPanelPosition, setSlideDeckPanelPosition] = useState<Pos | null>(null);
  // Format Panel (docs/specs/008-canvas/format-panel.md): the same.
  const [formatPanelPosition, setFormatPanelPosition] = useState<Pos | null>(null);
  // Zen / focus mode (docs/specs/007-editor/zen-mode.md): hide all the chrome (header, tab
  // bar, panels, docks) so only the canvas content + zoom controls
  // remain. Purely a view flag — not persisted, not synced.
  const [zenMode, setZenMode] = useState(false);

  return {
    explorerPosition,
    setExplorerPosition,
    mapPosition,
    setMapPosition,
    commentsPanelPosition,
    setCommentsPanelPosition,
    aiPanelPosition,
    setAiPanelPosition,
    aiPanelVisible,
    setAiPanelVisible,
    avatarPanelPosition,
    setAvatarPanelPosition,
    laserPanelPosition,
    setLaserPanelPosition,
    spotlightPanelPosition,
    setSpotlightPanelPosition,
    eraserPanelPosition,
    setEraserPanelPosition,
    slideDeckPanelPosition,
    setSlideDeckPanelPosition,
    formatPanelPosition,
    setFormatPanelPosition,
    zenMode,
    setZenMode,
  };
}
