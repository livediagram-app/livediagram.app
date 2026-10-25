// An Offline Mode conversion (docs/specs/006-document/offline-mode.md), declared by the editor on the request
// that performs it, so the feed can say what actually happened.
//
// It has to be declared because the two conversions reuse ordinary endpoints
// and are indistinguishable from them at the boundary: "Take offline" is a
// plain DELETE /documents/:id, and "Sync document" is a plain POST /documents. So
// the worker recorded them as a deletion and `document_created` — a Timeline
// that told the owner a document they had just moved into this browser was
// gone, and that one they had just uploaded was newly *created*. The Timeline's events (`document_offline`, `document_synced`)
// and their wire format are liveworkspace's index's (docs/specs/013-workspace/timeline.md).
//
// Header name + values live here because this is a two-sided contract and the alternative is the client and the worker
// each holding a copy of the string.
export const DOCUMENT_CONVERSION_HEADER = 'X-Document-Conversion';

export type DocumentConversion = 'offline' | 'sync';

/** Reads the conversion a request declares, or null when it declares none. */
export function readDocumentConversion(value: string | null): DocumentConversion | null {
  return value === 'offline' || value === 'sync' ? value : null;
}
