// The open design's component library for code with no React context to read it from (docs/specs/009-elements/
// components.md "Exports, thumbnails and agents"): the exporters (PNG, SVG, PDF), the tab drawings a tab window and a
// thumbnail paint, and the clipboard. The editor's library hook publishes each change here; with nothing published
// (no design open, or a page outside the editor) every instance draws as missing.
import {
  expandInstances,
  libraryLookup,
  type ComponentLibrary,
  type ComponentLookup,
  type Element,
} from '@livedesign/design';

let library: ComponentLibrary | null = null;

/** Publishes the open design's library (null when the design closes). */
export function setComponentRegistry(next: ComponentLibrary | null): void {
  library = next;
}

/** The open design's library, or null. */
export function componentRegistry(): ComponentLibrary | null {
  return library;
}

/** Finds a main in the open design's library. */
export const registryLookup: ComponentLookup = (id) => library?.get(id);

/** A tab (or anything with elements) with its instances expanded against the open design's library, or a given one;
 *  itself when it holds no instance. */
export function expandForExport<T extends { elements: Element[] }>(
  tab: T,
  lookup: ComponentLookup = library ? libraryLookup(library) : registryLookup,
): T {
  return expandInstances(tab, lookup);
}
