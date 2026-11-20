// What AI Settings says (docs/specs/030-knowledgebase/search-and-ask.md "Ask", "Providers"): the key's state, and
// a refused write in words. Nothing here is handed the key, so no message can hold it.
import type { KnowledgeAiProvider, KnowledgeAiSettings } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { providerWords } from './provider-words';

/** "No Key Yet", "Key Ending 4f2a", or "Key Added" for someone the route does not tell the ending. */
export function keyStateText(settings: Pick<KnowledgeAiSettings, 'hasKey' | 'keyHint'>): string {
  if (!settings.hasKey) return 'No Key Yet';
  return settings.keyHint ? `Key Ending ${settings.keyHint}` : 'Key Added';
}

export const KEY_ENCRYPTED_NOTE =
  'The key is encrypted when it is saved and is never shown again, here or anywhere else.';
/** Who pays: liveknowledge for no model, the team its provider for what it uses. */
export const teamPaysNote = (provider: KnowledgeAiProvider): string =>
  `liveknowledge pays for no model: your team pays ${providerWords(provider).company} for what it uses.`;
/** The same where no provider is chosen yet, or it does not matter which. */
export const TEAM_PAYS_ANY_NOTE =
  'liveknowledge pays for no model: your team pays its provider for what it uses.';

export type AiSettingsAction = 'save-key' | 'remove-key' | 'set-model';

const FALLBACK: Record<AiSettingsAction, string> = {
  'save-key': 'The key could not be saved. Check your connection and try again.',
  'remove-key': 'The key could not be removed. Check your connection and try again.',
  'set-model': 'The model could not be changed. Check your connection and try again.',
};

/** A refused or failed write, by its code and status alone. `provider`: the one the key was typed for. */
export function aiSettingsFailureText(
  err: unknown,
  action: AiSettingsAction,
  provider: KnowledgeAiProvider,
): string {
  if (err instanceof ApiError) {
    const words = providerWords(provider);
    if (err.code === 'invalid_key')
      return `That is not ${/^[aeiou]/i.test(words.spoken) ? 'an' : 'a'} ${words.spoken} API key. Copy it again from ${words.console} and paste it whole.`;
    if (err.code === 'invalid_model') return 'Choose one of the listed models.';
    if (err.code === 'invalid_provider') return 'Choose Anthropic or OpenAI.';
    if (err.code === 'ask_unavailable')
      return 'This server is not set up to keep a key, so Ask is not available on it.';
    if (err.status === 403) return 'Only an Editor can change the AI settings.';
    if (err.status === 429) return 'Too many changes at once. Wait a moment and try again.';
  }
  return FALLBACK[action];
}
