import { useState } from 'react';

type Pos = { x: number; y: number };

// Panel layout: where each draggable panel sits. A self-contained slice of the editor's UI
// state (no document-data coupling), lifted out of useEditorState so the
// view-model is composed from domain slices rather than one flat bag of
// useState calls.
//
// Positions are null until the user drags a panel, after which it
// remembers its spot.
export function usePanelLayout() {
  const [mapPosition, setMapPosition] = useState<Pos | null>(null);
  // Format Panel (docs/specs/008-canvas/format-panel.md): present only while the painter is on, so position only:
  // there is nothing to minimise when leaving the tool dismisses the panel outright.
  const [formatPanelPosition, setFormatPanelPosition] = useState<Pos | null>(null);

  return {
    mapPosition,
    setMapPosition,
    formatPanelPosition,
    setFormatPanelPosition,
  };
}
