// The screen's fixed words for a tab in the app's own (liveworkspace/docs/specs/018-automations/automations.md
// "Naming"; blueprint item-engine.md "Tab words"): a knowledgebase's tabs are pages, every other item's are tabs.
// Only ever fixed words: a name a person gave never passes through it.
import { inTabWords, type ItemWord } from '@liveworkspace/automations/item';
import { useAutomationsKit } from '../kit-context';

/** `words(text)`: the text in the open item's word for a tab. */
export function useTabWords(): (text: string) => string {
  const { item } = useAutomationsKit().plumbing.words;
  return (text) => inTabWords(text, item as ItemWord);
}
