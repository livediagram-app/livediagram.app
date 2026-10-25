// An Offline Mode conversion (docs/specs/006-design/offline-mode.md), declared by the editor on the request
// that performs it, so the index's Timeline can say what actually happened.
//
// It has to be declared because the two conversions reuse ordinary endpoints
// and are indistinguishable from them at the boundary: "Take offline" is a
// plain DELETE /designs/:id, and "Sync design" is a plain POST /designs. So
// the worker recorded them as a deletion and `design_created` — a Timeline
// that told the owner a design they had just moved into this browser was
// gone, and that one they had just uploaded was newly *created*; the index records `design_offline` and
// `design_synced` instead.
//
// Header name + values live here because
// this is a two-sided contract and the alternative is the client and the worker
// each holding a copy of the string.
export const DESIGN_CONVERSION_HEADER = 'X-Design-Conversion';

export type DesignConversion = 'offline' | 'sync';

/** Reads the conversion a request declares, or null when it declares none. */
export function readDesignConversion(value: string | null): DesignConversion | null {
  return value === 'offline' || value === 'sync' ? value : null;
}
