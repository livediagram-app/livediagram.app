// The knock on show in the mini view (docs/specs/008-canvas/avatar-mode.md "The mini view", docs/specs/
// 012-collaboration/knock.md "Being knocked"; blueprint: space-mini-view.md "Knocks"): at most one, with the same
// answer the toast's buttons call, gone after the toast's own answer timeout. Memory only.
import { useSyncExternalStore } from 'react';
import type { KnockAnswer } from '@livehuddle/api-schema';
import { TOAST_ANSWER_TIMEOUT_MS } from '@liveworkspace/ui/toast';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

export type MiniKnock = {
  // The knocker's presence id.
  from: string;
  name: string;
  answer: (value: KnockAnswer) => void;
};

let knock: MiniKnock | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = createListeners();

function set(next: MiniKnock | null): void {
  if (timer) clearTimeout(timer);
  timer = next ? setTimeout(() => set(null), TOAST_ANSWER_TIMEOUT_MS) : null;
  knock = next;
  listeners.notify();
}

/** A knock reached you: it replaces any on show, for the toast's ten seconds. */
export function showMiniKnock(next: MiniKnock): void {
  set(next);
}

/** Answered (from the toast or the mini view): cleared, if the one on show is still that person's. */
export function clearMiniKnock(from: string): void {
  if (knock?.from === from) set(null);
}

export function miniKnock(): MiniKnock | null {
  return knock;
}

const serverKnock = () => null;

export function useMiniKnock(): MiniKnock | null {
  return useSyncExternalStore(listeners.subscribe, miniKnock, serverKnock);
}

/** Tests: nothing on show, no timer. */
export function resetMiniKnock(): void {
  set(null);
}
