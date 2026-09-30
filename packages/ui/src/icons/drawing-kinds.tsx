import { lucideWorkflow } from '@livediagram/icons/lucide';

import { Glyph, type IconProps } from './Glyph';
import { lucideGlyph } from './lucide-glyph';

// The three kinds of drawing a visitor can start (docs/specs/019-marketing/marketing-site.md "Hero"):
// a marker for freehand drawing, a flowchart for a diagram, a mind map for a brainstorm.

// The whiteboard dock's marker silhouette (docs/specs/023-whiteboard/whiteboard.md "Pens") on its
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

// A hub with four branches, on a 16-unit grid.
export function MindmapIcon({ size = 16, ...rest }: IconProps) {
  return (
    <Glyph size={size} units={16} {...rest}>
      <circle cx="8" cy="8" r="2.2" />
      <circle cx="2.8" cy="3" r="1.4" />
      <circle cx="13.2" cy="3" r="1.4" />
      <circle cx="2.8" cy="13" r="1.4" />
      <circle cx="13.2" cy="13" r="1.4" />
      <path d="M6.5 6.6L3.8 4M9.5 6.6L12.2 4M6.5 9.4L3.8 12M9.5 9.4L12.2 12" />
    </Glyph>
  );
}
