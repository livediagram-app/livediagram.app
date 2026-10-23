// A document's name before anyone names it. Its own leaf module, apart from the template catalogue in
// templates.ts: the editor reads it on every load, and importing it from there drew the whole catalogue and
// its builders into the editor's first load.
export const UNTITLED_DOCUMENT_NAME = 'Untitled document';

export function isUntitledDocumentName(name: string): boolean {
  return name === UNTITLED_DOCUMENT_NAME;
}
