// The default document name was "Untitled diagram" before the container became a document
// (docs/specs/006-document/document-structure.md). Documents stored under it still count as
// untitled, so the first label still names them.
import { UNTITLED_DOCUMENT_NAME } from './templates';

const LEGACY_UNTITLED_NAME = 'Untitled diagram';

export function isUntitledDocumentName(name: string): boolean {
  return name === UNTITLED_DOCUMENT_NAME || name === LEGACY_UNTITLED_NAME;
}
