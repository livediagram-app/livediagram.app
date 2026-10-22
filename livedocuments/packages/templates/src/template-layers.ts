// Pre-assigned layers for templates whose scaffold stays put while
// their content moves (docs/specs/006-document/layers.md "Layered templates"). A layered
// template's builder stamps these ids onto the elements it returns,
// and `templateCanvasOverrides` ships the matching `Tab.layers` array,
// so every application path (editor picker, /new, MCP) lands scaffold
// and layers in one commit without carrying any layer logic itself.
//
// Every layered template shares the same TWO fixed sentinel ids (the
// `layer:default` pattern), not random uuids: re-applying a template
// converges, and elements copied between any two layered-template tabs
// keep their band, even across template kinds. Only the display names
// vary per template ("Frames" / "Content", "Rooms" / "Furniture"). The
// content layer is LAST (top), so it's the default active layer and
// everything the user adds lands with the content, never under the
// scaffold. Scaffold layers ship named but unlocked; locking is one
// click in the panel.

import type { Layer } from '@livedocuments/document';
import type { TemplateKind } from './templates';

export const TEMPLATE_SCAFFOLD_LAYER_ID = 'layer:template:scaffold';
export const TEMPLATE_CONTENT_LAYER_ID = 'layer:template:content';

// Bottom → top, matching Tab.layers order (docs/specs/006-document/layers.md). Built fresh per
// call so a caller mutating its tab can't corrupt the catalogue.
const layered = (scaffoldName: string, contentName: string): Layer[] => [
  { id: TEMPLATE_SCAFFOLD_LAYER_ID, name: scaffoldName },
  { id: TEMPLATE_CONTENT_LAYER_ID, name: contentName },
];

// The layers a template ships with, or undefined for the templates
// without a meaningful scaffold / content split (pages laid out from
// layouts, lockups, articles).
export function templateLayers(kind: TemplateKind): Layer[] | undefined {
  switch (kind) {
    // The frames stay put while their content moves.
    case 'slide-deck':
    case 'storyboard':
      return layered('Frames', 'Content');
    // The shell (walls, doorways, room captions) stays put while the
    // furniture is dragged around it.
    case 'floor-plan':
      return layered('Rooms', 'Furniture');
    default:
      return undefined;
  }
}
