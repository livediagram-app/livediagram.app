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

export const BUILT_IN_LABEL = 'Built-In AI';

const KEY_WORDS = {
  knowledgebase: 'Knowledgebase Key',
  team: 'Team Key',
  personal: 'Your Key',
} as const;

/** The key that answers, named by its model and whose it is (search-and-ask.md "Which key answers"): "Claude Fable
 *  5.2 (Team Key)", "(Your Key)", "(Knowledgebase Key)"; the source alone for a model not known. */
export function keyChoiceLabel(
  settings: Pick<KnowledgeAiSettings, 'hasKey' | 'model' | 'models' | 'uses' | 'usesModelLabel'>,
): string {
  const source = settings.hasKey ? 'knowledgebase' : settings.uses === 'team' ? 'team' : 'personal';
  const label =
    settings.usesModelLabel ??
    (settings.hasKey ? settings.models.find((m) => m.id === settings.model)?.label : undefined);
  return label ? `${label} (${KEY_WORDS[source]})` : KEY_WORDS[source];
}

/** What choosing the key means, under its name. */
export function keyChoiceDescription(
  settings: Pick<KnowledgeAiSettings, 'hasKey' | 'uses'>,
): string {
  if (settings.hasKey)
    return "This knowledgebase's own AI key, billed to your team. Applies to your next question.";
  if (settings.uses === 'team')
    return "Your team's AI key, billed to your team. Applies to your next question.";
  return 'Your own AI key, billed to you. Applies to your next question.';
}

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
