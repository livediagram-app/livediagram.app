// The document format number (docs/specs/016-platform/new-version-prompt.md): the version of the
// stored document shapes. The editor is built with it and the api serves it, from this one
// definition. Bump it only when an older editor can no longer read what the server now serves.
//   2: packed stroke points (docs/specs/006-document/stroke-points.md).
export const DOCUMENT_FORMAT = 2;

// Every api response carries the server's number in this header.
export const DOCUMENT_FORMAT_HEADER = 'X-Livedocuments-Format';

// Reading the number off the wire is liveworkspace's.
export { parseDocumentFormat } from '@liveworkspace/api-schema/document-format';
