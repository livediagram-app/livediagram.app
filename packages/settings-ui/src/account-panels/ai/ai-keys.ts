// What Settings › AI reads and sends (liveworkspace/docs/specs/003-accounts/ai-keys.md "The account API"): the state
// of a key, never the key. A key goes out once, in a PUT's body, and nothing here keeps it.

export type AiProviderId = 'anthropic' | 'openai';

export type AiKeyState = { provider: AiProviderId; model: string; hint: string; setAt: number };

export type AiProviderChoice = {
  id: AiProviderId;
  label: string;
  keyPrefix: string;
  defaultModel: string;
  models: { id: string; label: string }[];
};

export type AiTeamKey = { id: string; name: string; canManage: boolean; key: AiKeyState | null };

export type AiKeysAnswer = {
  available: boolean;
  key: AiKeyState | null;
  teams: AiTeamKey[];
  providers: AiProviderChoice[];
};

/** Where one owner's key lives on the account API. */
export const aiKeyPath = (teamId: string | null): string =>
  teamId === null ? '/ai-key' : `/teams/${encodeURIComponent(teamId)}/ai-key`;

/** "Claude Fable 5.2", or the id itself for a model the list no longer has. */
export function modelLabel(providers: readonly AiProviderChoice[], key: AiKeyState): string {
  const provider = providers.find((p) => p.id === key.provider);
  return provider?.models.find((m) => m.id === key.model)?.label ?? key.model;
}

export const providerLabel = (providers: readonly AiProviderChoice[], id: AiProviderId): string =>
  providers.find((p) => p.id === id)?.label ?? id;
