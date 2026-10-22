// Making a project is a use of it, unless its caller says otherwise (docs/specs/013-workspace/explorer-home.md
// "Making a project"; docs/specs/015-api/api.md "Marking a project used"). The create body's
// `markUsed` says which, read here by the api worker.

/** The 400 message for a `markUsed` that is not a boolean. */
export const MARK_USED_INVALID = 'invalid markUsed';

/** The create body's `markUsed`: absent counts the making, a boolean is itself, anything else is
 *  refused whole. */
export function readMarkUsed(value: unknown): { ok: true; markUsed: boolean } | { ok: false } {
  if (value === undefined) return { ok: true, markUsed: true };
  if (typeof value === 'boolean') return { ok: true, markUsed: value };
  return { ok: false };
}
