// Which AI a feature runs on, as its source line says it (liveworkspace/docs/specs/003-accounts/ai-keys.md "The source
// line (AiSource)"): worked out in the page from the same `GET /api/account/ai-key` Settings › AI reads, by the same
// order the servers follow (the item's team's key for a joined member, else the person's own, else built-in AI). Pure,
// apart from the change event's two lines. Nothing here ever holds a key: the answer has none.
import { aiKeyFailureWords, type AiKeyFailure } from '@liveworkspace/ai';
import { modelLabel, type AiKeysAnswer, type AiProviderId } from '../account-panels/ai/ai-keys';

/** Whose key a line names. */
export type AiSourceOwner = 'you' | 'team' | 'item';

export type AiSourceLine =
  // Not read yet: the line keeps its height, with no words.
  | { kind: 'loading' }
  // Built-in AI. `canChange`: whoever can add a key of their own (a signed-in account).
  | { kind: 'built-in'; canChange: boolean }
  // A key: whose, its provider and model by name, and whether this person may change it.
  | {
      kind: 'key';
      owner: AiSourceOwner;
      provider: AiProviderId;
      model: string;
      canChange: boolean;
    }
  // A key that failed on the last call, in the failure's fixed words.
  | { kind: 'failed'; owner: AiSourceOwner; provider: AiProviderId | null; words: string; canChange: boolean };

/** The window event Settings › AI raises after each change it makes, so every mounted line reads again. No payload. */
export const AI_KEY_CHANGED_EVENT = 'liveworkspace:ai-key-changed';

/** Says a key, a model or a team's key changed. */
export function announceAiKeyChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AI_KEY_CHANGED_EVENT));
}

/** The provider as a line names it: the company, short. */
export const PROVIDER_NAMES: Readonly<Record<AiProviderId, string>> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
};

const OWNER_OF: Readonly<Record<AiKeyFailure['source'], AiSourceOwner>> = {
  item: 'item',
  team: 'team',
  account: 'you',
};

/** The line for `teamId`'s work (null: the person's own, as before an item exists), from Settings' answer. A key that
 *  failed on the last call (`failure`) wins until the next answer, so the line says so and offers to fix it. */
export function aiSourceOf(
  answer: AiKeysAnswer,
  teamId: string | null,
  failure: AiKeyFailure | null = null,
): AiSourceLine {
  const team = teamId ? answer.teams.find((t) => t.id === teamId) : undefined;
  if (failure) {
    const owner = OWNER_OF[failure.source];
    return {
      kind: 'failed',
      owner,
      provider: failure.provider,
      words: aiKeyFailureWords(failure),
      // A team's key is its admins' to fix; the item's own is the app's (it passes its own action).
      canChange: owner === 'you' || (owner === 'team' && team?.canManage === true),
    };
  }
  if (team?.key)
    return {
      kind: 'key',
      owner: 'team',
      provider: team.key.provider,
      model: modelLabel(answer.providers, team.key),
      canChange: team.canManage,
    };
  if (answer.key)
    return {
      kind: 'key',
      owner: 'you',
      provider: answer.key.provider,
      model: modelLabel(answer.providers, answer.key),
      canChange: true,
    };
  // A deployment that keeps no keys has none to add: the line says built-in AI with no action.
  return { kind: 'built-in', canChange: answer.available };
}
