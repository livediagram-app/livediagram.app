import { createContext, useContext } from 'react';

// Which form Draw mode's tools take (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard
// shows"): the Toolbar layout's floating `dock` across the top or bottom of the canvas, or the
// Floating layout's Palette `panel`. The groups, buttons and flyouts are the same; the variant
// changes only how they are laid out and where a flyout opens.
export type DockVariant = 'dock' | 'panel';

export const DockVariantContext = createContext<DockVariant>('dock');

export function useDockVariant(): DockVariant {
  return useContext(DockVariantContext);
}
