// An app's kinds (blueprint item-engine.md "Kinds"): the ones every app has, and its own. Pure.

import { crossAppActions } from '../cross-app/kinds';
import { sharedActions } from './actions';
import { sharedConditions } from './conditions';
import { kindsOf, type ItemKinds, type ItemKindsInput, type TriggerKind } from './kinds';
import { inTabWords } from './tab-word';
import { sharedTriggers } from './triggers';
import type { ItemWord } from './types';
import { sharedValues } from './values';

// A shared kind's fixed words in the item's word for a tab (tab-word.ts): its picker name, line and group. What it
// prints at run time passes its own fixed words through the same helper.
const worded = <Kind extends { name: string; line: string; group: string }>(
  kinds: readonly Kind[],
  itemWord: ItemWord,
): Kind[] =>
  kinds.map((k) => ({
    ...k,
    name: inTabWords(k.name, itemWord),
    line: inTabWords(k.line, itemWord),
    group: inTabWords(k.group, itemWord),
  }));

// A shared trigger's own chip (the part marked `trigger`, its fixed name) in the item's words too; a chip naming a tab
// or a person keeps the name its owner gave it.
const wordedTriggers = (kinds: readonly TriggerKind[], itemWord: ItemWord): TriggerKind[] =>
  worded(kinds, itemWord).map((k) => ({
    ...k,
    words: (trigger, names) =>
      k
        .words(trigger, names)
        .map((part) =>
          'chip' in part && part.trigger
            ? { ...part, chip: inTabWords(part.chip, itemWord) }
            : part,
        ),
  }));

/** The registry an app's check, sentence, builder, agents' tools and room all read. */
export function defineItemKinds(input: ItemKindsInput): ItemKinds {
  const word = input.itemWord;
  return kindsOf(input, {
    triggers: [...wordedTriggers(sharedTriggers(input.collab), word), ...(input.triggers ?? [])],
    conditions: [...worded(sharedConditions(), word), ...(input.conditions ?? [])],
    // The steps in other apps keep their own words: a knowledgebase's "Add a Tab to a Document" names a document's tab.
    actions: [
      ...worded(sharedActions(input.tabTemplates), word),
      ...crossAppActions(),
      ...(input.actions ?? []),
    ],
    values: [
      ...sharedValues(word).map((v) => ({ ...v, label: inTabWords(v.label, word) })),
      ...(input.values ?? []),
    ],
  });
}
