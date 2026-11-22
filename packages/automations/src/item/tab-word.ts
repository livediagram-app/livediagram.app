// What an item calls its tabs (liveworkspace/docs/specs/018-automations/automations.md "Naming"; blueprint
// item-engine.md "Tab words"): a knowledgebase's are pages, every other item's are tabs. The words change, never the
// rule: a rule's JSON names a `tab` in every app. Pure.

import type { ItemWord } from './types';

export type TabWord = 'tab' | 'page';

/** The word an item's people read for one of its tabs. */
export const tabWordOf = (itemWord: ItemWord): TabWord =>
  itemWord === 'knowledgebase' ? 'page' : 'tab';

const TAB_WORD = /\b([Tt])ab(s?)\b/g;

/** `text`, a fixed line of the engine's or the screen's, in the item's word for a tab: "Add a Tab" reads "Add a Page"
 *  for a knowledgebase. Only ever fixed words: a name a person gave is never passed through it. */
export function inTabWords(text: string, itemWord: ItemWord): string {
  if (tabWordOf(itemWord) === 'tab') return text;
  return text.replace(TAB_WORD, (_word, t: string, s: string) => `${t === 'T' ? 'P' : 'p'}age${s}`);
}
