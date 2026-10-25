import { useState } from 'react';

type Pos = { x: number; y: number };

// Panel layout: where each draggable panel sits. A self-contained slice of the editor's UI
// state (no project-data coupling), lifted out of useEditorState so the
// view-model is composed from domain slices rather than one flat bag of
// useState calls.
//
// Positions are null until the user drags a panel, after which it
// remembers its spot.
export function usePanelLayout() {
  const [mapPosition, setMapPosition] = useState<Pos | null>(null);
  const [commentsPanelPosition, setCommentsPanelPosition] = useState<Pos | null>(null);
  // (Timer and Vote open over the Session strip's buttons, so they keep no position:
  // docs/specs/012-collaboration/session-tools.md.)
  // Zen / focus mode (docs/specs/007-editor/zen-mode.md): hide all the chrome (header, tab
  // bar, panels, docks) so only the canvas content + zoom controls
  // remain. Purely a view flag — not persisted, not synced.
  const [zenMode, setZenMode] = useState(false);

  return {
    mapPosition,
    setMapPosition,
    commentsPanelPosition,
    setCommentsPanelPosition,
    zenMode,
    setZenMode,
  };
}
