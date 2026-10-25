// Making a document is a use of it, a bulk import is not (docs/specs/013-workspace/explorer-home.md
// "Making a document"; docs/specs/015-api/api.md "Marking a document used"). The create body's
// `markUsed` says which, read here by the api worker; the editor's imports decide it by count.

/** The 400 message for a `markUsed` that is not a boolean. */
export const MARK_USED_INVALID = 'invalid markUsed';

/** The most documents one import may make and still mark them used: the spec's "more than one
 *  document in one go" is a bulk import. */
export const MARKED_USED_IMPORT_MAX = 1;

/** The create body's `markUsed`: absent counts the making, a boolean is itself, anything else is
 *  refused whole. */
export function readMarkUsed(value: unknown): { ok: true; markUsed: boolean } | { ok: false } {
  if (value === undefined) return { ok: true, markUsed: true };
  if (typeof value === 'boolean') return { ok: true, markUsed: value };
  return { ok: false };
}

/** Whether an import setting out to make `documentCount` documents marks them used. */
export function importMarksUse(documentCount: number): boolean {
  return documentCount <= MARKED_USED_IMPORT_MAX;
}
