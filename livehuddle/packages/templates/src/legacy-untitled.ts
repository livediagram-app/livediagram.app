// A document's name before anyone names it. Its own leaf module, apart from the template catalogue in
// templates.ts: the editor reads it on every load, and importing it from there drew the whole catalogue and
// its builders into the editor's first load.
// People see livehuddle's items called Spaces (docs/specs/003-system-architecture/domain-language.md "Space").
export const UNTITLED_DOCUMENT_NAME = 'Untitled Space';

// The default name was "Untitled diagram" before the container became a document
// (docs/specs/006-document/document-structure.md), then "Untitled document" until the items were called
// canvases, then "Untitled canvas" until they were called Spaces. Documents stored under any of them still count as
// untitled, so the first label still names them.

const LEGACY_UNTITLED_NAME = 'Untitled diagram';
const LEGACY_UNTITLED_DOCUMENT_NAME = 'Untitled document';
const LEGACY_UNTITLED_CANVAS_NAME = 'Untitled canvas';

// The blank was "Blank Session", then "Blank Workshop", before it became "Blank Space", so documents made from it were
// named "Untitled Session" or "Untitled Workshop". They still count as unnamed, so picking a template renames them.
const LEGACY_UNTITLED_SESSION_NAME = 'Untitled Session';
const LEGACY_UNTITLED_WORKSHOP_NAME = 'Untitled Workshop';

export function isUntitledDocumentName(name: string): boolean {
  return (
    name === UNTITLED_DOCUMENT_NAME ||
    name === LEGACY_UNTITLED_NAME ||
    name === LEGACY_UNTITLED_DOCUMENT_NAME ||
    name === LEGACY_UNTITLED_CANVAS_NAME ||
    name === LEGACY_UNTITLED_SESSION_NAME ||
    name === LEGACY_UNTITLED_WORKSHOP_NAME
  );
}
