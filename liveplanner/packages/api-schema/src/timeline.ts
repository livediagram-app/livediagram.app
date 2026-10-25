// The Timeline's side of an Offline Mode conversion (docs/specs/013-workspace/timeline.md). The feed itself, its
// event vocabulary and its scopes live in the liveworkspace index; the editor's own timeline components went with
// the Explorer's move there.

// An Offline Mode conversion (docs/specs/006-project/offline-mode.md), declared by the editor on the request
// that performs it, so the feed can say what actually happened.
//
// It has to be declared because the two conversions reuse ordinary endpoints
// and are indistinguishable from them at the boundary: "Take offline" is a
// plain DELETE /projects/:id, and "Sync project" is a plain POST /projects. So
// the worker recorded them as a deletion and `project_created` — a Timeline
// that told the owner a project they had just moved into this browser was
// gone, and that one they had just uploaded was newly *created*.
//
// Header name + values live here because this is a two-sided contract and the alternative is the client and the worker
// each holding a copy of the string.
export const PROJECT_CONVERSION_HEADER = 'X-Project-Conversion';

export type ProjectConversion = 'offline' | 'sync';

/** Reads the conversion a request declares, or null when it declares none. */
export function readProjectConversion(value: string | null): ProjectConversion | null {
  return value === 'offline' || value === 'sync' ? value : null;
}
