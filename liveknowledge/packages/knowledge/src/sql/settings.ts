// The knowledgebase's AI settings (docs/specs/030-knowledgebase/search-and-ask.md "Ask"): the sealed key
// (key-seal.ts), the hint Settings shows and the model. The key is stored sealed and never read back to a client.
import type { SqlStatement } from './statement';

export const SETTING_AI_KEY = 'ai_key';
export const SETTING_AI_KEY_HINT = 'ai_key_hint';
export const SETTING_AI_MODEL = 'ai_model';

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

/** Stores a key's envelope and its hint together. Run in one transaction. */
export const putAiKey = (envelope: string, hint: string): SqlStatement[] => [
  putSetting(SETTING_AI_KEY, envelope),
  putSetting(SETTING_AI_KEY_HINT, hint),
];

/** "Remove": the key and its hint go; the model stays. */
export const removeAiKey = (): SqlStatement => ({
  sql: 'DELETE FROM knowledge_settings WHERE name IN (?, ?)',
  params: [SETTING_AI_KEY, SETTING_AI_KEY_HINT],
});
