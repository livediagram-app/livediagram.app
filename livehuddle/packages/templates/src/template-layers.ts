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
// vary per template ("Board" / "Cards", "Axes" / "Items", ...). The
// content layer is LAST (top), so it's the default active layer and
// everything the user adds lands with the content, never under the
// scaffold. Scaffold layers ship named but unlocked; locking is one
// click in the panel.

import type { Layer } from '@livehuddle/document';
import type { TemplateKind } from './templates';

export const TEMPLATE_SCAFFOLD_LAYER_ID = 'layer:template:scaffold';
export const TEMPLATE_CONTENT_LAYER_ID = 'layer:template:content';


// The layers a template ships with, or undefined for a template without a meaningful scaffold / content split. None of
// the catalogue's is layered (docs/specs/007-editor/templates-by-mode.md "The catalogue"): the Spaces are one floor of
// rooms and furniture, and Blank Space is empty. The layered boards (the retrospectives, the matrices and the rest)
// left with Work Tracker #423; the ids above stay, so a stored board's layers read as they always did.
export function templateLayers(_kind: TemplateKind): Layer[] | undefined {
  return undefined;
}
