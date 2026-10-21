// The machine that just gave a character a drink (docs/specs/009-elements/office.md "Using it"), so it answers:
// bubbles in the cooler, a drip in the coffee machine. Kept in a module store keyed by machine, so the one that
// answers is the one view that re-renders; a value threaded through the canvas re-rendered every element on the tab
// for each drink.

import { useSyncExternalStore } from 'react';
import { createListeners } from '@/lib/listeners';

const answered = new Map<string, number>();
const listeners = createListeners();

/** The machine answers: its count goes up by one. */
export function answerMachine(elementId: string): void {
  answered.set(elementId, (answered.get(elementId) ?? 0) + 1);
  listeners.notify();
}

/** How many times this machine has answered, 0 when it never has; changes only for this machine. */
export function useMachineAnswered(elementId: string): number {
  return useSyncExternalStore(
    listeners.subscribe,
    () => answered.get(elementId) ?? 0,
    () => 0,
  );
}

/** Forgets every machine's count (tests). */
export function resetMachineAnswers(): void {
  answered.clear();
}
