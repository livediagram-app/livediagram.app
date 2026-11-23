// The owner's AI credits as the last built-in answer told them (docs/specs/030-knowledgebase/tiers.md "Built-in AI on
// AI credits"): Ask's `X-AI-Credits` header and the setup answer's `credits`, or used up when a call was refused for
// the month. Per knowledgebase, for this page. Nothing is held with Pro off: no answer carries a figure.
import type { KnowledgeAiCredits } from '@liveknowledge/api-schema';
import { usesAiCredits } from '@liveworkspace/subscription';

export type CreditsState = KnowledgeAiCredits & { usedUp: boolean };

const credits = new Map<string, CreditsState>();
const listeners = new Set<() => void>();
const tell = () => {
  for (const listener of listeners) listener();
};

/** A built-in answer's figure: the month after it spent one. */
export function noteAiCredits(documentId: string, figure: KnowledgeAiCredits | null): void {
  if (!figure) return;
  credits.set(documentId, { ...figure, usedUp: figure.used >= figure.limit });
  tell();
}

/** A built-in call refused for the month (`ai_credits_used`). The tier's numbers come to the owner or the owning
 *  team alone; anyone else is told only that the month is used, which the notice says all the same. */
export function noteAiCreditsUsed(documentId: string, used?: unknown, limit?: unknown): void {
  const figures =
    typeof used === 'number' && typeof limit === 'number' ? { used, limit } : { used: 0, limit: 0 };
  credits.set(documentId, { ...figures, usedUp: true });
  tell();
}

export function aiCreditsOf(documentId: string | null | undefined): CreditsState | null {
  return (documentId && credits.get(documentId)) || null;
}

/** Hears every change to the store; the hooks' `subscribe`. */
export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** "Uses 2 AI credits" (the operation's cost), then "· 962 left this month" once an answer has told the month. */
export function creditsLine(state: CreditsState | null, cost = 1): string {
  if (!state) return usesAiCredits(cost);
  const left = Math.max(0, state.limit - state.used).toLocaleString('en-US');
  return `${usesAiCredits(cost)} · ${left} left this month`;
}

/** The first of next month in UTC, "1 December", when the credits start again. */
export function creditsResetWords(now: Date = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return `1 ${next.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })}`;
}

/** The used-up notice's sentence: for someone who may act, with the ways on; for anyone else, the plain fact. */
export function creditsUsedSentence(
  mayAct: boolean,
  doing: 'ask' | 'set up',
  proCredits: number,
  now?: Date,
): string {
  if (!mayAct) return "The owner's AI credits for this month are used.";
  return `This month's AI credits are used. They start again on ${creditsResetWords(now)}. Add your own Claude key to ${doing} now, or Pro gives ${proCredits.toLocaleString('en-US')} a month.`;
}

/** Tests only. */
export function forgetAiCreditsForTests(): void {
  credits.clear();
}
