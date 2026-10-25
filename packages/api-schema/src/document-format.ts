// The document format number (docs/specs/016-platform/new-version-prompt.md): the version of the
// stored document shapes. The editor is built with it and the api serves it. Each product keeps its
// own number and header (`DOCUMENT_FORMAT` and `DOCUMENT_FORMAT_HEADER` in its api-schema, under its
// own noun); reading one off the wire is every product's.

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
