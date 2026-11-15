// A link that opens straight into Prototype mode (docs/specs/007-editor/wireframe-pages.md "Sharing a prototype"):
// the `prototype` parameter, read once as the editor opens, and the link Copy Prototype Link copies. The Viewer link
// it rides is Inspect's (`inspectViewLink`).
import { wantsFlag, withFlag } from './link-flag';

/** The URL parameter that opens a wireframe tab in Prototype mode. */
export const PROTOTYPE_PARAM = 'prototype';

/** Whether an address asks to open in Prototype mode (`?prototype`, `?prototype=1`; never `=0` or `=false`). */
export function wantsPrototype(search: string): boolean {
  return wantsFlag(search, PROTOTYPE_PARAM);
}

/** A link with the prototype parameter added (kept once if it is already there). */
export function withPrototype(href: string): string {
  return withFlag(href, PROTOTYPE_PARAM);
}
