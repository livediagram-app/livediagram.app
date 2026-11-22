// How the interface names the two providers a team may bring a key for (docs/specs/030-knowledgebase/
// search-and-ask.md "Providers"). The copy says "your team's AI key" wherever it does not matter which provider it
// is, and names the provider where it does: a refused key, an account out of credit, where a key is made.
import type { KnowledgeAiProvider } from '@liveknowledge/api-schema';

export type ProviderWords = {
  /** As AI Settings lists it. */
  name: string;
  /** Inside a sentence or a heading: "OpenAI Did Not Accept the Key". */
  spoken: string;
  /** Who the team pays. */
  company: string;
  /** Where a key is made, as a sentence names it. */
  console: string;
  /** How its keys begin: the key field's placeholder. */
  keyPlaceholder: string;
  /** One line under its name in AI Settings. */
  about: string;
};

export const PROVIDER_WORDS: Readonly<Record<KnowledgeAiProvider, ProviderWords>> = {
  anthropic: {
    name: 'Anthropic (Claude)',
    spoken: 'Claude',
    company: 'Anthropic',
    console: 'the Claude Console',
    keyPlaceholder: 'sk-ant-...',
    about: 'A key from the Claude Console.',
  },
  openai: {
    name: 'OpenAI',
    spoken: 'OpenAI',
    company: 'OpenAI',
    console: 'the OpenAI platform',
    keyPlaceholder: 'sk-...',
    about: 'A key from the OpenAI platform.',
  },
};

/** The words for a provider; one the editor does not know (a newer server) reads as Anthropic, the first. */
export const providerWords = (provider: KnowledgeAiProvider | undefined): ProviderWords =>
  (provider && PROVIDER_WORDS[provider]) || PROVIDER_WORDS.anthropic;

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/** "Replace the Claude Key With an OpenAI Key?" */
export function replaceProviderTitle(from: KnowledgeAiProvider, to: KnowledgeAiProvider): string {
  const next = providerWords(to).spoken;
  return `Replace the ${providerWords(from).spoken} Key With ${article(next)} ${next} Key?`;
}

/** "Add an OpenAI Key", "Add a Claude Key". */
export function addKeyLabel(provider: KnowledgeAiProvider): string {
  const { spoken } = providerWords(provider);
  return `Add ${article(spoken)} ${spoken} Key`;
}

/** What the question before a provider change says: the stored key works until the new one is saved. */
export function replaceProviderMessage(from: KnowledgeAiProvider, to: KnowledgeAiProvider): string {
  const old = providerWords(from).spoken;
  const next = providerWords(to).spoken;
  return `A knowledgebase holds one provider and one key. The ${old} key stays in use until you save ${article(next)} ${next} key; it is then removed, and everything that uses a model runs on ${next}.`;
}
