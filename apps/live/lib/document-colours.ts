// Custom colours (docs/specs/004-interface-design/colour-picker.md "Custom colours"): the colours
// picked with + anywhere in the document, which every picker offers. Each tab keeps its own
// (`Tab.customColours`, newest first); the document's are the active tab's, then the others' in
// tab order, deduped, leaving out any colour the picker already offers (the theme palette's).
import { CUSTOM_COLOURS_MAX, customColoursOf, type Tab } from '@livediagram/document';

// At most this many: one picker row and a bit.
export const YOUR_COLOURS_MAX = CUSTOM_COLOURS_MAX;

/** The document's custom colours, at most YOUR_COLOURS_MAX; `firstTabId`'s first. */
export function documentColours(
  tabs: readonly Pick<Tab, 'id' | 'customColours'>[],
  offered: readonly string[] = [],
  firstTabId?: string,
): string[] {
  const skip = new Set(offered.map((c) => c.toLowerCase()));
  const first = tabs.find((t) => t.id === firstTabId);
  const ordered = first ? [first, ...tabs.filter((t) => t !== first)] : tabs;
  const out: string[] = [];
  for (const tab of ordered) {
    for (const hex of customColoursOf(tab)) {
      if (skip.has(hex) || out.includes(hex)) continue;
      out.push(hex);
      if (out.length >= YOUR_COLOURS_MAX) return out;
    }
  }
  return out;
}
