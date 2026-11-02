// The names a document carries before anyone names it, one per mode's blank (docs/specs/007-editor/templates-by-mode.md
// "The document's name"). A light leaf on purpose: the editor checks it on every first label, and each product's
// template catalogue, which builds these names from its own titles, is loaded lazily and must stay out of the
// editor's first load. The catalogues import this list so a name added here is a default there too.
export const UNTITLED_DOCUMENT_NAMES: ReadonlySet<string> = new Set([
  // livediagram: a Diagram, Whiteboard and Workshop blank, and the names the first and last had before.
  'Untitled canvas',
  'Untitled diagram',
  'Untitled Whiteboard',
  'Untitled Workshop',
  'Untitled Session',
  // livedocuments: a blank tab and each blank page kind.
  'Untitled document',
  'Untitled Illustration',
  'Untitled Slide Deck',
  'Untitled Article',
  'Untitled Infographic',
  'Untitled Flashcards',
  // liveplanner.
  'Untitled Plan',
]);

/** Whether a document still carries a blank's default name, so the first thing written in it may name it. */
export function isUntitledName(name: string): boolean {
  return UNTITLED_DOCUMENT_NAMES.has(name);
}
