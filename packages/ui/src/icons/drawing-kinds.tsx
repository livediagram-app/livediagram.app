import { lucideLayoutGrid, lucideWorkflow } from '@livediagram/icons/lucide';
import type { ComponentType } from 'react';

import { Glyph, type IconProps } from './Glyph';
import { lucideGlyph } from './lucide-glyph';

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

// A page with a little chart above two lines of writing, on its 24-unit grid: Illustrate mode's mark
// (docs/specs/007-editor/editor-modes.md), for the pages it lays out, infographics and articles.
export function IllustrateIcon({ size = 16, ...rest }: IconProps) {
  return (
    <Glyph size={size} units={24} {...rest}>
      <rect x="4.5" y="2.5" width="15" height="19" rx="2" />
      <path d="M8.5 11V8.5M12 11V6M15.5 11V9" />
      <path d="M8.5 15H15.5M8.5 18H13" />
    </Glyph>
  );
}

// Plan mode's mark (docs/specs/025-plan/plan-mode.md): a board of three columns, the middle one
// holding a raised card, on the 24-unit grid.
export function PlanIcon({ size = 16, ...rest }: IconProps) {
  return (
    <Glyph size={size} units={24} {...rest}>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <path d="M8.83 4V20M15.17 4V20" />
      <rect x="4.5" y="7" width="2.5" height="3" rx="0.6" />
      <rect x="10.2" y="6" width="3.6" height="5" rx="0.8" fill="currentColor" />
      <rect x="17" y="7" width="2.5" height="3" rx="0.6" />
    </Glyph>
  );
}

// Plan mode's Cards category (docs/specs/025-plan/plan-mode.md "The palette"): two item cards, one
// behind the other, each with its type stripe, on the 24-unit grid.
export function PlanCardsIcon({ size = 16, ...rest }: IconProps) {
  return (
    <Glyph size={size} units={24} {...rest}>
      <path d="M7 5.5V4.5a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 21 4.5v9a1.5 1.5 0 0 1-1.5 1.5H18" />
      <rect x="3" y="8" width="15" height="12" rx="1.5" />
      <path d="M6 8v12" />
      <path d="M9 12h6M9 15.5h4" />
    </Glyph>
  );
}

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

// Each editor mode's mark (docs/specs/007-editor/editor-modes.md "Each mode's mark"), keyed by the
// mode's id: the same glyph on the mode switch, Opens in, the tab pill, the template mode filter
// and the marketing site's mode pictures.
export const EDITOR_MODE_ICONS: Readonly<
  Record<'diagram' | 'draw' | 'illustrate' | 'plan', ComponentType<IconProps>>
> = {
  diagram: FlowchartIcon,
  draw: MarkerIcon,
  illustrate: IllustrateIcon,
  plan: PlanIcon,
};

// "Everything", every mode at once, in the template mode filter: a grid.
export const EverythingIcon = lucideGlyph(lucideLayoutGrid, 16);
