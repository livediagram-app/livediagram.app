// Which AI answers a person's questions (liveworkspace/docs/specs/019-ask/ask.md "Choosing which AI answers"):
// built-in AI, or the key that applies to them. Kept in this browser, per app (its origin's own storage); the key
// until the person picks otherwise. Storage that throws or a value it does not know reads as the key.
import { useSyncExternalStore } from 'react';

export type AskAiChoice = 'built-in' | 'key';

export const ASK_AI_CHOICE_KEY = 'liveworkspace:ask-ai:v1';
const DEFAULT_CHOICE: AskAiChoice = 'key';

let held: AskAiChoice | null = null;
const listeners = new Set<() => void>();

function read(): AskAiChoice {
  try {
    return localStorage.getItem(ASK_AI_CHOICE_KEY) === 'built-in' ? 'built-in' : DEFAULT_CHOICE;
  } catch {
    return DEFAULT_CHOICE;
  }
}

export const askAiChoiceStore = {
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: (): AskAiChoice => (held ??= read()),
  set(choice: AskAiChoice): void {
    if (askAiChoiceStore.get() === choice) return;
    held = choice;
    try {
      localStorage.setItem(ASK_AI_CHOICE_KEY, choice);
    } catch {
      // A private window that refuses writes keeps the choice for this tab alone.
    }
    listeners.forEach((listener) => listener());
  },
  /** Forget what was read (tests). */
  reset(): void {
    held = null;
  },
};

/** The person's choice, as it changes. */
export const useAskAiChoice = (): AskAiChoice =>
  // The tool is drawn in the browser alone (it loads when its row is opened), so one read serves both.
  useSyncExternalStore(askAiChoiceStore.subscribe, askAiChoiceStore.get, askAiChoiceStore.get);
