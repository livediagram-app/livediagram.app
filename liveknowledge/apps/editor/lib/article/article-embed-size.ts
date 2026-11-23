// A live embed placed in a page's writing (docs/specs/030-knowledgebase/links-and-embeds.md "Embeds from other apps",
// Work Tracker 1386): it spans the text column, three quarters as tall as it is wide, so the item it shows reads at a
// useful size where the embed's own default (480 by 270) was a small card.
export const LIVE_EMBED_PAGE_ASPECT = 4 / 3;

/** The size of a new live embed in a text column of the given width, in whole canvas pixels. */
export function liveEmbedPageSize(textWidth: number): { width: number; height: number } {
  const width = Math.round(textWidth);
  return { width, height: Math.round(width / LIVE_EMBED_PAGE_ASPECT) };
}
