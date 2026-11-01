// A document's name before anyone names it. Its own leaf module, apart from the template catalogue in
// templates.ts: the editor reads it on every load, and importing it from there drew the whole catalogue and
// its builders into the editor's first load.
// People see livediagram's items called canvases (docs/specs/003-system-architecture/domain-language.md "Canvas").
export const UNTITLED_DOCUMENT_NAME = 'Untitled canvas';

// The default name was "Untitled diagram" before the container became a document
// (docs/specs/006-document/document-structure.md), then "Untitled document" until the items were called
// canvases. Documents stored under either still count as untitled, so the first label still names them.

const LEGACY_UNTITLED_NAME = 'Untitled diagram';
const LEGACY_UNTITLED_DOCUMENT_NAME = 'Untitled document';

// Workshop's blank was "Blank Session" before it became "Blank Workshop", so documents made from it were
// named "Untitled Session". They still count as unnamed, so picking a template renames them.
const LEGACY_UNTITLED_WORKSHOP_NAME = 'Untitled Session';

export function isUntitledDocumentName(name: string): boolean {
  return (
    name === UNTITLED_DOCUMENT_NAME ||
    name === LEGACY_UNTITLED_NAME ||
    name === LEGACY_UNTITLED_DOCUMENT_NAME ||
    name === LEGACY_UNTITLED_WORKSHOP_NAME
  );
}
