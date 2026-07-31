// Sticker identity, as a lightweight first-load module — the entries
// themselves live in the async sticker-catalog (concatenated into
// icon-catalog-2). Stickers and line-art icons share one catalogue and one
// element kind by design (spec/113), so the only thing that tells them apart
// is the id prefix; this is where that prefix is written down.
//
// The prefix is `emoji-`, not `sticker-`, and stays that way: the ids shipped
// under spec/85 and are what saved elements, API payloads and MCP calls carry.
// Renaming them would blank the glyph on every diagram already using one.
export const STICKER_ID_PREFIX = 'emoji-';

// True for a sticker (colour emoji) id. Used by the palette to keep the two
// catalogues in their own tabs: the Icons tab browses and searches line art
// only, the Stickers tab owns these.
export function isStickerId(id: string): boolean {
  return id.startsWith(STICKER_ID_PREFIX);
}
