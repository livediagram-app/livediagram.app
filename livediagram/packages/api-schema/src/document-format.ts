// The document format number (docs/specs/016-platform/new-version-prompt.md): the version of the
// stored document shapes. The editor is built with it and the api serves it, from this one
// definition. Bump it only when an older editor can no longer read what the server now serves.
//   2: packed stroke points (docs/specs/006-document/stroke-points.md).
export const DOCUMENT_FORMAT = 2;

// Every api response carries the server's number in this header.
export const DOCUMENT_FORMAT_HEADER = 'X-Livediagram-Format';

/** A safe positive integer (a number, or the digits of one), else null. */
export function parseDocumentFormat(value: unknown): number | null {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value)
        ? Number(value)
        : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
