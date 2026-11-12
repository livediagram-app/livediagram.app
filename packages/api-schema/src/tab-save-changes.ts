// What a tab save changed, beside the whole tab it sends (each product's docs/specs/012-collaboration/
// collab-race-hardening.md "A save is merged with the stored tab"). The tab PUT carries the saver's whole tab, and the
// api used to store it as sent, so of two Editors adding a page or writing in one article in the same second, the
// later save erased the other's (Work Tracker #669, #670). With this header the api applies only what this save
// changed (its pages and its articles' blocks, by id) over the tab it has stored, and keeps the rest as stored.
//
// A header rather than a body field, so an api from before it, during a deploy, ignores it and stores the tab as it
// always did, and never keeps an unknown field inside a tab. URI-encoded JSON: ids may be any text, and a header
// carries Latin-1 only. What it holds is each product's (its `tab-save-changes.ts`); this is the envelope.

export const TAB_SAVE_CHANGES_HEADER = 'X-Save-Changes';

/** The longest header value sent: well inside every proxy's header limit. A save whose changes would pass it sends
 *  less detail (the product's encoder), or no header, and is then stored as sent. */
export const TAB_SAVE_CHANGES_MAX_CHARS = 8_000;

/** The header value for `changes`, or null when it would pass TAB_SAVE_CHANGES_MAX_CHARS. */
export function encodeTabSaveChanges(changes: object): string | null {
  const value = encodeURIComponent(JSON.stringify(changes));
  return value.length <= TAB_SAVE_CHANGES_MAX_CHARS ? value : null;
}

/** The header read back as a JSON object, or null (absent, too long, or not an object): the product parses it. */
export function decodeTabSaveChanges(header: string | null): Record<string, unknown> | null {
  if (header === null || header.length > TAB_SAVE_CHANGES_MAX_CHARS) return null;
  try {
    const v: unknown = JSON.parse(decodeURIComponent(header));
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
