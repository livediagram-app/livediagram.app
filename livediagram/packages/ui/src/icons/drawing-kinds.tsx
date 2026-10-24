import { lucideWorkflow } from '@liveworkspace/icons/lucide';
import type { EditorMode } from '@livediagram/document';
import type { ComponentType } from 'react';

import { Glyph, type IconProps, lucideGlyph } from '@liveworkspace/ui';

// The three kinds of drawing a visitor can start (docs/specs/019-marketing/marketing-site.md "Hero"):
// a marker for freehand drawing, a flowchart for a diagram, a mind map for a brainstorm.

// The whiteboard dock's marker silhouette (docs/specs/023-draw-mode/draw-mode.md "Pens") on its
// 24-unit grid, body, nib and the band below, in the text colour and centred in its box.
export function MarkerIcon({ size = 16, ...rest }: IconProps) {
  return (
    <Glyph size={size} units={24} {...rest}>
      <path d="M7 13 L15.5 4.5 L18 7 L9.5 15.5 L6.4 16 Z" />
      <path d="M6.4 16 L7 13 L9.5 15.5 Z" fill="currentColor" />
      <path d="M4 19.5 H20" />
    </Glyph>
  );
}

// Two steps joined by a connector.
export const FlowchartIcon = lucideGlyph(lucideWorkflow, 16);

// Workshop mode's mark (docs/specs/012-collaboration/workshop-mode.md): a flipchart on an
// easel, its pad holding two lines of writing, on the 24-unit grid.
export function FlipchartIcon({ size = 16, ...rest }: IconProps) {
  return (
    <Glyph size={size} units={24} {...rest}>
      <path d="M3 3.5H21" />
      <rect x="4.5" y="3.5" width="15" height="12" rx="1" />
      <path d="M8 8H16M8 11.5H13" />
      <path d="M12 15.5V21M8 15.5L5.5 21M16 15.5L18.5 21" />
    </Glyph>
  );
}

// Each editor mode's mark (docs/specs/007-editor/editor-modes.md "Each mode's mark"), keyed by the
// mode's id: the same glyph on the mode switch, Opens in, the tab pill, the template mode filter
// and the marketing site's mode pictures.
export const EDITOR_MODE_ICONS: Readonly<Record<EditorMode, ComponentType<IconProps>>> = {
  diagram: FlowchartIcon,
  draw: MarkerIcon,
  workshop: FlipchartIcon,
};
