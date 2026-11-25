// Every design's drawing by id (docs/specs/011-theme/blueprints/page-designs.md "Drawing"), joined from the families'
// files. Typed against the catalogue, so a design without a drawer fails the build.
import type { PageDesignId } from './catalogue';
import { BOLD_DRAWERS } from './draw-bold';
import { FRAME_DRAWERS } from './draw-frames';
import { GEOMETRIC_DRAWERS } from './draw-geometric';
import { GRADIENT_DRAWERS } from './draw-gradients';
import type { Drawer } from './draw-kit';
import { LIGHT_DRAWERS } from './draw-light';
import { ORGANIC_DRAWERS } from './draw-organic';
import { POSTER_DRAWERS } from './draw-poster';
import { RISO_DRAWERS } from './draw-riso';
import { TECH_DRAWERS } from './draw-tech';
import { TEXTURE_DRAWERS } from './draw-texture';

export const DESIGN_DRAWERS: Record<PageDesignId, Drawer> = {
  ...GRADIENT_DRAWERS,
  ...GEOMETRIC_DRAWERS,
  ...ORGANIC_DRAWERS,
  ...TEXTURE_DRAWERS,
  ...RISO_DRAWERS,
  ...LIGHT_DRAWERS,
  ...FRAME_DRAWERS,
  ...BOLD_DRAWERS,
  ...POSTER_DRAWERS,
  ...TECH_DRAWERS,
};
