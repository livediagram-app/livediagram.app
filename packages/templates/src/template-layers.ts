// Pre-assigned layers for templates whose scaffold stays put while
// their content moves (spec/74 "Layered templates"). A layered
// template's builder stamps these ids onto the elements it returns,
// and `templateCanvasOverrides` ships the matching `Tab.layers` array,
// so every application path (editor picker, /new, MCP) lands scaffold
// and layers in one commit without carrying any layer logic itself.
//
// Ids are FIXED sentinels (the `layer:default` pattern), not random
// uuids: re-applying the same template converges, and elements copied
// between two tabs cut from the same template keep their band. The
// content layer is LAST (top), so it's the default active layer and
// everything the user adds lands with the content, never under the
// scaffold. Scaffold layers ship named but unlocked; locking is one
// click in the panel.

import type { Layer } from '@livediagram/diagram';
import type { TemplateKind } from './templates';

// Kanban (spec/09): the stationary board under the tickets users drag
// between lanes.
export const KANBAN_BOARD_LAYER_ID = 'layer:template:board';
export const KANBAN_CARDS_LAYER_ID = 'layer:template:cards';

// The layers a template ships with, ordered bottom → top like
// `Tab.layers`, or undefined for the (majority of) templates without a
// meaningful scaffold / content split. Returns a fresh array per call
// so a caller mutating its tab can't corrupt the catalogue.
export function templateLayers(kind: TemplateKind): Layer[] | undefined {
  switch (kind) {
    case 'kanban':
      return [
        { id: KANBAN_BOARD_LAYER_ID, name: 'Board' },
        { id: KANBAN_CARDS_LAYER_ID, name: 'Cards' },
      ];
    default:
      return undefined;
  }
}
