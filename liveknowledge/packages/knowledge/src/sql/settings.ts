// The knowledgebase's AI settings (docs/specs/030-knowledgebase/search-and-ask.md "Ask"): the sealed key
// (key-seal.ts), the hint Settings shows and the model. The key is stored sealed and never read back to a client.
import type { SqlStatement } from './statement';

export const SETTING_AI_KEY = 'ai_key';
export const SETTING_AI_KEY_HINT = 'ai_key_hint';
export const SETTING_AI_MODEL = 'ai_model';
/** Whose API the key is for (model-providers.ts). No row: a key kept before there was a choice, Anthropic's. */
export const SETTING_AI_PROVIDER = 'ai_provider';

/** One setting: a row `{ value }` or none. */
export const readSetting = (name: string): SqlStatement => ({
  sql: 'SELECT value FROM knowledge_settings WHERE name = ?',
  params: [name],
});

export const putSetting = (name: string, value: string): SqlStatement => ({
  sql: `INSERT INTO knowledge_settings (name, value) VALUES (?, ?)
    ON CONFLICT (name) DO UPDATE SET value = excluded.value`,
  params: [name, value],
});

/** Stores a key's envelope, its hint and its provider together. Run in one transaction, so a key is never
 *  beside another provider's name. */
export const putAiKey = (envelope: string, hint: string, provider: string): SqlStatement[] => [
  putSetting(SETTING_AI_KEY, envelope),
  putSetting(SETTING_AI_KEY_HINT, hint),
  putSetting(SETTING_AI_PROVIDER, provider),
];

/** Forgets the chosen model: run with `putAiKey` when the provider changes, so the new provider starts on its
 *  default and never on the other's model. */
export const removeAiModel = (): SqlStatement => ({
  sql: 'DELETE FROM knowledge_settings WHERE name = ?',
  params: [SETTING_AI_MODEL],
});

/** "Remove": the key and its hint go; the provider and the model stay. */
export const removeAiKey = (): SqlStatement => ({
  sql: 'DELETE FROM knowledge_settings WHERE name IN (?, ?)',
  params: [SETTING_AI_KEY, SETTING_AI_KEY_HINT],
});
