// What AI Settings says (docs/specs/030-knowledgebase/search-and-ask.md "Ask"): the key's state, and a refused
// write in words. Nothing here is handed the key, so no message can hold it.
import type { KnowledgeAiSettings } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';

/** "No Key Yet", "Key Ending 4f2a", or "Key Added" for someone the route does not tell the ending. */
export function keyStateText(settings: Pick<KnowledgeAiSettings, 'hasKey' | 'keyHint'>): string {
  if (!settings.hasKey) return 'No Key Yet';
  return settings.keyHint ? `Key Ending ${settings.keyHint}` : 'Key Added';
}

export const KEY_ENCRYPTED_NOTE =
  'The key is encrypted when it is saved and is never shown again, here or anywhere else.';
export const TEAM_PAYS_NOTE =
  'liveknowledge is free and pays for no model: your team pays Anthropic for what Ask uses.';

export type AiSettingsAction = 'save-key' | 'remove-key' | 'set-model';

const FALLBACK: Record<AiSettingsAction, string> = {
  'save-key': 'The key could not be saved. Check your connection and try again.',
  'remove-key': 'The key could not be removed. Check your connection and try again.',
  'set-model': 'The model could not be changed. Check your connection and try again.',
};

/** A refused or failed write, by its code and status alone. */
export function aiSettingsFailureText(err: unknown, action: AiSettingsAction): string {
  if (err instanceof ApiError) {
    if (err.code === 'invalid_key')
      return 'That is not a Claude API key. Copy it again from the Claude Console and paste it whole.';
    if (err.code === 'invalid_model') return 'Choose one of the listed Claude models.';
    if (err.code === 'ask_unavailable')
      return 'This server is not set up to keep a key, so Ask is not available on it.';
    if (err.status === 403) return 'Only an Editor can change the AI settings.';
    if (err.status === 429) return 'Too many changes at once. Wait a moment and try again.';
  }
  return FALLBACK[action];
}
