// The project format number (docs/specs/016-platform/new-version-prompt.md): the version of the
// stored project shapes. The editor is built with it and the api serves it, from this one
// definition. Bump it only when an older editor can no longer read what the server now serves.
//   2: packed stroke points (docs/specs/006-project/stroke-points.md).
export const PROJECT_FORMAT = 2;

// Every api response carries the server's number in this header.
export const PROJECT_FORMAT_HEADER = 'X-Liveplanner-Format';

// Reading the number off the wire is liveworkspace's.
export { parseDocumentFormat as parseProjectFormat } from '@liveworkspace/api-schema/document-format';
