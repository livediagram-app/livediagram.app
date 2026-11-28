// Plan AI's conversations (docs/specs/026-plan/plan-ai.md "The panel"): one a tab, kept while the editor is open (never
// saved), so closing the panel and coming back finds the thread as it was. A module store with listeners, as Ask's
// conversation is; each turn holds the instruction, the reply, what its changes did, and how many undo steps they took.
import type { AiKeyFailure } from '@liveworkspace/ai/key-failure';
import type { PlanAiLine } from './plan-ai-lines';

/** The most turns a tab's thread keeps; the oldest go first. */
export const PLAN_AI_THREAD_MAX = 30;

export type PlanAiTurnView = {
  id: string;
  instruction: string;
  status: 'asking' | 'done' | 'failed' | 'stopped';
  reply: string;
  lines: PlanAiLine[];
  // Undo steps its changes took, and whether the turn's Undo has taken them back.
  steps: number;
  undone?: true;
  provider?: string;
  failure?: { message: string; aiKey: AiKeyFailure | null };
};

type Thread = readonly PlanAiTurnView[];
const EMPTY: Thread = [];
const threads = new Map<string, Thread>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
let seq = 0;

export function subscribePlanAi(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function planAiThread(tabId: string): Thread {
  return threads.get(tabId) ?? EMPTY;
}

/** Starts a turn on `tabId`'s thread; answers its id. */
export function startPlanAiTurn(tabId: string, instruction: string): string {
  const id = `t${++seq}`;
  const turn: PlanAiTurnView = {
    id,
    instruction,
    status: 'asking',
    reply: '',
    lines: [],
    steps: 0,
  };
  threads.set(tabId, [...planAiThread(tabId), turn].slice(-PLAN_AI_THREAD_MAX));
  notify();
  return id;
}

/** Changes a turn; a turn no longer in the thread (cleared) is left alone. */
export function updatePlanAiTurn(
  tabId: string,
  id: string,
  change: Partial<Omit<PlanAiTurnView, 'id' | 'instruction'>>,
): void {
  const thread = planAiThread(tabId);
  if (!thread.some((t) => t.id === id)) return;
  threads.set(
    tabId,
    thread.map((t) => (t.id === id ? { ...t, ...change } : t)),
  );
  notify();
}

export function clearPlanAiThread(tabId: string): void {
  if (!threads.has(tabId)) return;
  threads.delete(tabId);
  notify();
}

/** For tests: every thread gone. */
export function resetPlanAiThreads(): void {
  threads.clear();
  seq = 0;
  notify();
}
