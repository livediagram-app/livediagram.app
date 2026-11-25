// Which AI answers a person's questions in one knowledgebase (docs/specs/030-knowledgebase/search-and-ask.md
// "Choosing which AI answers"): built-in AI, or the team's key. Kept in this browser beside the chats, per person and
// knowledgebase; the team's key until the person picks otherwise. Storage that throws or a value it does not know
// reads as the team's key.
import { useSyncExternalStore } from 'react';
import type { AskAiChoice, KnowledgeAiSettings } from '@liveknowledge/api-schema';
import type { KnowledgeCaller } from '@/lib/api/knowledge';

export const ASK_AI_CHOICE_PREFIX = 'liveknowledge:ask-ai:v1:';
const DEFAULT_CHOICE: AskAiChoice = 'key';

const held = new Map<string, AskAiChoice>();
const listeners = new Set<() => void>();
const keyOf = (who: KnowledgeCaller, documentId: string) =>
  `${ASK_AI_CHOICE_PREFIX}${who.ownerId}:${documentId}`;

function read(key: string): AskAiChoice {
  try {
    return localStorage.getItem(key) === 'built-in' ? 'built-in' : DEFAULT_CHOICE;
  } catch {
    return DEFAULT_CHOICE;
  }
}

export const askAiChoiceStore = {
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get(who: KnowledgeCaller, documentId: string): AskAiChoice {
    const key = keyOf(who, documentId);
    let choice = held.get(key);
    if (!choice) {
      choice = read(key);
      held.set(key, choice);
    }
    return choice;
  },
  set(who: KnowledgeCaller, documentId: string, choice: AskAiChoice): void {
    const key = keyOf(who, documentId);
    if (held.get(key) === choice) return;
    held.set(key, choice);
    try {
      localStorage.setItem(key, choice);
    } catch {
      // A private window that refuses writes keeps the choice for this tab alone.
    }
    listeners.forEach((listener) => listener());
  },
  /** Forget what was read (tests). */
  reset(): void {
    held.clear();
  },
};

/** The person's choice in this knowledgebase, as it changes. */
export function useAskAiChoice(who: KnowledgeCaller, documentId: string): AskAiChoice {
  return useSyncExternalStore(
    askAiChoiceStore.subscribe,
    () => askAiChoiceStore.get(who, documentId),
    () => DEFAULT_CHOICE,
  );
}

/** Whether there is a choice to make: a key answers (the knowledgebase's, the team's or the person's) and this
 *  server has built-in AI too. */
export const offersAiChoice = (
  settings: Pick<KnowledgeAiSettings, 'hasKey' | 'builtIn' | 'uses'>,
): boolean =>
  settings.builtIn && (settings.hasKey || settings.uses === 'team' || settings.uses === 'personal');

/** The AI a question asks for: the person's choice, but the key wherever this server has no built-in AI (the menu
 *  then holds the key alone), so a choice kept from before is never sent to a server that would refuse it. Until
 *  `GET ai` answers, the choice stands. */
export const askAiOf = (
  choice: AskAiChoice,
  settings: Pick<KnowledgeAiSettings, 'builtIn'> | null,
): AskAiChoice => (settings && !settings.builtIn ? 'key' : choice);

export const BUILT_IN_LABEL = 'Built-In AI';

/** Which AI answered a turn, for its card: "Built-In AI", the model's label, or nothing for a turn kept from before
 *  the choice. */
export function answeredByLabel(
  turn: { provider?: string; model: string },
  settings: Pick<KnowledgeAiSettings, 'models' | 'usesModel' | 'usesModelLabel'>,
): string | null {
  if (turn.provider === 'built-in') return BUILT_IN_LABEL;
  if (!turn.provider) return null;
  return (
    settings.models.find((m) => m.id === turn.model)?.label ??
    (turn.model === settings.usesModel ? settings.usesModelLabel : undefined) ??
    'AI Key'
  );
}
