import { useState } from 'react';

type Pos = { x: number; y: number };

// Panel layout: where each draggable panel sits. A self-contained slice of the editor's UI
// state (no design-data coupling), lifted out of useEditorState so the
// view-model is composed from domain slices rather than one flat bag of
// useState calls.
//
// Positions are null until the user drags a panel, after which it
// remembers its spot.
export function usePanelLayout() {
  const [mapPosition, setMapPosition] = useState<Pos | null>(null);
  const [commentsPanelPosition, setCommentsPanelPosition] = useState<Pos | null>(null);
  // Laser Panel (docs/specs/008-canvas/laser-panel.md): present only while the Laser tool is active, so
  // position only — there is nothing to minimise when leaving the tool dismisses the panel outright.
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
    mapPosition,
    setMapPosition,
    commentsPanelPosition,
    setCommentsPanelPosition,
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
