// Add a Tab from a Template (liveworkspace/docs/specs/018-automations/automations.md "Steps every app has"; blueprint
// item-engine.md "The kit": addTab): the tab is made as the app's New Tab makes it from that template and written
// last in order, and everyone with the item open sees it arrive. This module holds the order of the checks, the
// limit and the words; the app hands in how it knows a template, builds a tab from one and writes it.
import { inTabWords, type ItemWord } from '../../item';

// The most tabs an item may hold for a rule to add another: a rule that adds a tab on a schedule would otherwise add
// one for ever. Items hold under 20 tabs in practice; the safe range is 50 to the 500 a migration carries.
export const RULE_TABS_MAX = 200;

// In the item's own words: a knowledgebase's tabs are pages (tab-word.ts).
export const tabLimitWords = (itemWord: ItemWord): string =>
  inTabWords(`This ${itemWord} has ${RULE_TABS_MAX} tabs, the most a rule adds to`, itemWord);
export const TEMPLATE_GONE = 'The template is gone';
export const TEMPLATE_FAILED = "Couldn't make a tab from that template";
export const TAB_TOO_LARGE = 'The tab came out too large to store';

export interface AddTemplateTabInput<Tab> {
  itemWord: ItemWord;
  // How many tabs the item holds; null for an item not started.
  tabCount(): Promise<number | null>;
  // The template's kind as the app knows it now (a retired kind's replacement); null for one it does not know.
  kindOf(template: string): string | null;
  // The name as the app stores a tab's ('' for none).
  storedName(name: string): string;
  // The tab made from the template, or null when the app's engine refuses it.
  build(tab: { id: string; name: string; kind: string }): Tab | null;
  tooLarge(tab: Tab): boolean;
  // The tab written last in order, and told to everyone with the item open.
  write(tab: Tab, id: string, name: string): Promise<void>;
}

export async function addTemplateTab<Tab>(
  input: AddTemplateTabInput<Tab>,
  template: string,
  name: string,
): Promise<{ id: string; name: string } | { failed: string }> {
  const count = await input.tabCount();
  if (count === null) return { failed: inTabWords(TEMPLATE_FAILED, input.itemWord) };
  if (count >= RULE_TABS_MAX) return { failed: tabLimitWords(input.itemWord) };
  const kind = input.kindOf(template);
  if (!kind) return { failed: TEMPLATE_GONE };
  const id = crypto.randomUUID();
  const stored = input.storedName(name) || 'Untitled';
  const tab = input.build({ id, name: stored, kind });
  if (tab === null) return { failed: inTabWords(TEMPLATE_FAILED, input.itemWord) };
  if (input.tooLarge(tab)) return { failed: inTabWords(TAB_TOO_LARGE, input.itemWord) };
  await input.write(tab, id, stored);
  console.info('[automations] tab added', { template: kind });
  return { id, name: stored };
}
