// What a rule's words name things by (blueprint item-engine.md "Words"): the item's tabs, people, snapshots,
// connections and templates by id. A list the caller lacks reads as its plain noun; an id the list lacks reads as
// gone; an empty id as not picked yet. Pure.

import { inTabWords } from './tab-word';
import type { ItemOutline, ItemWord } from './types';

export type ItemRefKind = 'tab' | 'snapshot' | 'connection' | 'template' | 'person';

export interface ItemNames {
  itemWord: ItemWord;
  tabs?: ReadonlyMap<string, string>;
  people?: ReadonlyMap<string, string>;
  snapshots?: ReadonlyMap<string, string>;
  connections?: ReadonlyMap<string, string>;
  templates?: ReadonlyMap<string, string>;
}

const LISTS: Readonly<Record<ItemRefKind, keyof Omit<ItemNames, 'itemWord'>>> = {
  tab: 'tabs',
  snapshot: 'snapshots',
  connection: 'connections',
  template: 'templates',
  person: 'people',
};

export const UNPICKED_NAMES: Readonly<Record<ItemRefKind, string>> = {
  tab: 'a tab',
  snapshot: 'a snapshot',
  connection: 'a connection',
  template: 'a template',
  person: 'someone',
};

export const GONE_NAMES: Readonly<Record<ItemRefKind, string>> = {
  tab: "a tab that's gone",
  snapshot: "a snapshot that's gone",
  connection: "a connection that's gone",
  template: "a template that's gone",
  person: "someone who's gone",
};

/** The name `id` has among the item's `kind`s. */
export function refName(names: ItemNames, kind: ItemRefKind, id: string): string {
  const list = names[LISTS[kind]];
  if (id === '' || !list) return inTabWords(UNPICKED_NAMES[kind], names.itemWord);
  return list.get(id) ?? inTabWords(GONE_NAMES[kind], names.itemWord);
}

/** The names a run reads: the outline's tabs and people, and whatever else the caller knows. */
export function itemNames(
  itemWord: ItemWord,
  outline: Pick<ItemOutline, 'tabs' | 'people'>,
  more: Pick<ItemNames, 'snapshots' | 'connections' | 'templates'> = {},
): ItemNames {
  return {
    itemWord,
    tabs: new Map(outline.tabs.map((t) => [t.id, t.name])),
    people: new Map(outline.people.map((p) => [p.id, p.name])),
    ...more,
  };
}

/** The app's word with a capital, for a label ("Document Name", "Space Name"). */
export const itemWordTitle = (itemWord: ItemWord): string =>
  itemWord.charAt(0).toUpperCase() + itemWord.slice(1);
