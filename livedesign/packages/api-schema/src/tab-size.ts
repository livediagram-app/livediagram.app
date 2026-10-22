// A tab's size cap (docs/specs/015-api/api.md "Tab size"). A tab is stored as one text value
// (`tabs.data`, the tab's JSON without its id and name) in one D1 row, and Cloudflare D1 caps a
// string, a BLOB and a row at 2,000,000 bytes:
// https://developers.cloudflare.com/d1/platform/limits/. Local `wrangler dev` does not enforce it,
// so the worker does, and the editor checks the same numbers before it sends: one definition here.

/** D1's cap on one row (and on one string or BLOB in it), in bytes. */
export const D1_MAX_ROW_BYTES = 2_000_000;

/**
 * Room for the row's other columns beside `data`: the tab id (a UUID, 36 bytes), the name (at most
 * NAME_MAX_LENGTH = 60 characters, so at most 240 bytes of UTF-8), `updated_at` (an integer) and
 * SQLite's record header (a few bytes a column). 8 KiB covers them many times over.
 */
export const D1_ROW_HEADROOM_BYTES = 8 * 1024;

/** The largest tab data, in bytes of UTF-8 JSON, a tab may store: 1,991,808. */
export const MAX_TAB_BYTES = D1_MAX_ROW_BYTES - D1_ROW_HEADROOM_BYTES;

/** The bytes a tab's data takes in its row: its UTF-8 JSON without the id and name. */
export function tabDataBytes(tab: object): number {
  const { id: _id, name: _name, ...rest } = tab as { id?: unknown; name?: unknown };
  return new TextEncoder().encode(JSON.stringify(rest)).length;
}

/** Whether a tab's data would not fit its D1 row. */
export function tabTooLarge(tab: object): boolean {
  return tabDataBytes(tab) > MAX_TAB_BYTES;
}
