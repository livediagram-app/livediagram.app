// The OpenAI models a team may choose in AI Settings (liveknowledge/docs/specs/030-knowledgebase/search-and-ask.md "Providers"):
// the general models OpenAI's model page listed under "Flagship models" on 2026-11-20
// (https://developers.openai.com/api/docs/models). The ids are complete as written.

export type OpenAiModel = { id: string; name: string };

export const OPENAI_MODELS: readonly OpenAiModel[] = [
  { id: 'gpt-6.2-astra', name: 'GPT-6.2 Astra' },
  { id: 'gpt-6.2-sol', name: 'GPT-6.2 Sol' },
  { id: 'gpt-6.1-terra', name: 'GPT-6.1 Terra' },
  { id: 'gpt-6-luna', name: 'GPT-6 Luna' },
];

/** The most capable of the list, as the model page names it. */
export const DEFAULT_OPENAI_MODEL = 'gpt-6.2-astra';

/** The model a stored setting names, or the default when it names none of the list. */
export function openAiModel(id: unknown): OpenAiModel {
  return OPENAI_MODELS.find((m) => m.id === id) ?? OPENAI_MODELS[0]!;
}
