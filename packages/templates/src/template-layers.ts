// Pre-assigned layers for templates whose scaffold stays put while
// their content moves (spec/74 "Layered templates"). A layered
// template's builder stamps these ids onto the elements it returns,
// and `templateCanvasOverrides` ships the matching `Tab.layers` array,
// so every application path (editor picker, /new, MCP) lands scaffold
// and layers in one commit without carrying any layer logic itself.
//
// Every layered template shares the same TWO fixed sentinel ids (the
// `layer:default` pattern), not random uuids: re-applying a template
// converges, and elements copied between any two layered-template tabs
// keep their band, even across template kinds. Only the display names
// vary per template ("Board" / "Cards", "Axes" / "Items", ...). The
// content layer is LAST (top), so it's the default active layer and
// everything the user adds lands with the content, never under the
// scaffold. Scaffold layers ship named but unlocked; locking is one
// click in the panel.

import type { Layer } from '@livediagram/diagram';
import type { TemplateKind } from './templates';

export const TEMPLATE_SCAFFOLD_LAYER_ID = 'layer:template:scaffold';
export const TEMPLATE_CONTENT_LAYER_ID = 'layer:template:content';

// Bottom → top, matching Tab.layers order (spec/74). Built fresh per
// call so a caller mutating its tab can't corrupt the catalogue.
const layered = (scaffoldName: string, contentName: string): Layer[] => [
  { id: TEMPLATE_SCAFFOLD_LAYER_ID, name: scaffoldName },
  { id: TEMPLATE_CONTENT_LAYER_ID, name: contentName },
];

// The layers a template ships with, or undefined for the templates
// without a meaningful scaffold / content split (single-plane
// node-and-arrow diagrams, tables, lockups).
export function templateLayers(kind: TemplateKind): Layer[] | undefined {
  switch (kind) {
    // Boards: the stationary lanes / quadrants / axes under the cards,
    // stickies and items users drag around.
    case 'kanban':
      return layered('Board', 'Cards');
    case 'retrospective':
      return layered('Board', 'Stickies');
    case 'prioritization-matrix':
      return layered('Axes', 'Items');
    case 'affinity-map':
      return layered('Board', 'Stickies');
    case 'user-story-map':
      return layered('Backbone', 'Stories');
    case 'roadmap':
      return layered('Lanes', 'Cards');
    // Fixed grids / frameworks with sliding or fill-in content.
    case 'gantt':
      return layered('Grid', 'Bars');
    case 'swot':
      return layered('Quadrants', 'Notes');
    case 'business-model-canvas':
      return layered('Canvas', 'Notes');
    case 'empathy-map':
      return layered('Quadrants', 'Notes');
    case 'sequence-diagram':
      return layered('Lifelines', 'Messages');
    // Frame-and-content design templates.
    case 'mobile-wireframe':
    case 'laptop-wireframe':
    case 'browser-wireframe':
      return layered('Frames', 'UI');
    case 'slide-deck':
    case 'storyboard':
      return layered('Frames', 'Content');
    case 'timeline':
    case 'milestone-timeline':
      return layered('Spine', 'Milestones');
    case 'journey':
      return layered('Stages', 'Notes');
    default:
      return undefined;
  }
}
