// Built-in AI on AI credits (docs/specs/030-knowledgebase/tiers.md "Built-in AI on AI credits"; blueprint tiers.md):
// with Pro on, each built-in call spends one credit from the knowledgebase's payer's month, after the built-in caps
// passed and before the model is asked. A team's own key never comes here. With Pro off, for a guest's knowledgebase
// and for one that is nobody's, nothing is spent.
import {
  AI_CREDITS_HEADER,
  type KnowledgeAiCredits,
  type KnowledgeTierRefusal,
} from '@liveknowledge/api-schema';
import { bumpCounter, dayOf, readCounter } from '@liveknowledge/knowledge';
import { AI_CREDIT_COSTS, refusedByService, type SpendResult } from '@liveworkspace/subscription';
import { json } from '../responses';
import type { DocumentEnv } from '../types';
import { rowsOf, runAll } from './knowledge-db';
import { workerTierOf } from './tier-limits';

export const AI_CREDITS_USED_WORDS = "This month's AI credits are used.";
export const AI_CREDITS_UNCHECKED_WORDS = 'AI credits could not be checked. Try again in a moment.';
export const AI_BY_OTHERS_WORDS =
  'Built-in AI here has had its fill for today. Try again tomorrow, or add your own AI key.';

/**
 * The most built-in AI operations a day that people who are NOT the knowledgebase's owner (or a member of its owning
 * team) may charge to that owner (tiers.md "Built-in AI on AI credits"; 019 "A share link is never a way to spend its
 * owner's month unbounded"). As livediagram's photo reads by others: twenty a day is a busy day's questions, and at
 * most 600 of the owner's credits a month from one knowledgebase. Safe range 5..100.
 */
export const OWNER_CREDITS_BY_OTHERS_PER_DAY = 20;
/** The counter the operations charged to the owner by others are kept under, per day. */
export const BY_OTHERS_SCOPE = 'ai-credits-by-others';

/** Who asked: the person and the teams they have joined, or null for no one (an edit's own conflict check). */
export type CreditCaller = { personId: string; teams: readonly string[] } | null;

/** The caller of a route, as the spend weighs it. */
export const creditCallerOf = (
  ctx: { teams?: readonly { id: string }[] | null },
  personId: string,
): CreditCaller => ({ personId, teams: (ctx.teams ?? []).map((t) => t.id) });

/** Whether the owner's month is the caller's own to see and spend unbounded: the owner, or one of the owning team. */
export function theirs(
  head: { ownerId?: string | null; teamId?: string | null },
  caller: CreditCaller,
): boolean {
  if (!caller) return false;
  return head.teamId ? caller.teams.includes(head.teamId) : head.ownerId === caller.personId;
}

export type CreditSpend =
  // Go ahead: `credits` the owner's month after this spend, or null when nothing is metered.
  { ok: true; credits: KnowledgeAiCredits | null } | { ok: false; response: Response };

/** The answer to one spend: what the route goes on with, or the refusal it sends. */
// The owner's numbers (what is used of the month, and the month) go to the owner or the owning team alone (019 "What
// a collaborator is told"); anyone else gets the go-ahead or the refusal, never a figure.
export function creditOutcome(spent: SpendResult | null, own = true): CreditSpend {
  if (!spent) return { ok: true, credits: null };
  if (spent.ok)
    return {
      ok: true,
      credits:
        !own || spent.limit === null || spent.limit === undefined
          ? null
          : { used: spent.used, limit: spent.limit },
    };
  // The service refused the api's own request (its key, never the owner's month): not asked, and no offer.
  if (refusedByService(spent))
    return {
      ok: false,
      response: json(
        { error: 'ai_unavailable', message: AI_CREDITS_UNCHECKED_WORDS },
        { status: 503 },
      ),
    };
  const body: { error: string; message: string } & Partial<KnowledgeTierRefusal> = {
    error: 'ai_credits_used',
    message: AI_CREDITS_USED_WORDS,
    limit: 'aiCreditsPerMonth',
    ...(own ? { used: spent.used, max: spent.limit ?? 0 } : {}),
  };
  console.info('[knowledge] ai credits used');
  return { ok: false, response: json(body, { status: 429 }) };
}

/** The liveknowledge operations that spend AI credits. */
export type KnowledgeAiOperation = 'knowledgeAsk' | 'knowledgeConflictCheck' | 'knowledgeSetup';

/** What a built-in call costs from the knowledgebase's payer's month (019 "What an AI operation costs"). */
// `caller` is who asked, or 'edit' for a conflict check an edit started (bounded by its own daily cap, and its
// figures never leave the api). Someone else's operation on the owner's month first passes the by-others cap.
export async function spendBuiltInCredit(
  env: DocumentEnv,
  head: { ownerId?: string | null; teamId?: string | null },
  operation: KnowledgeAiOperation,
  caller: CreditCaller | 'edit',
  now = Date.now(),
): Promise<CreditSpend> {
  const tier = await workerTierOf(env, head);
  if (!tier) return { ok: true, credits: null };
  const own = caller !== 'edit' && theirs(head, caller);
  const byOthers = caller !== 'edit' && !own;
  const day = dayOf(now);
  if (byOthers) {
    const used =
      (await rowsOf<{ used: number }>(env, readCounter(BY_OTHERS_SCOPE, day)))[0]?.used ?? 0;
    if (used >= OWNER_CREDITS_BY_OTHERS_PER_DAY) {
      console.info('[knowledge] ai credits by others capped');
      return {
        ok: false,
        response: json(
          { error: 'ai_by_others_limit', message: AI_BY_OTHERS_WORDS },
          { status: 429 },
        ),
      };
    }
  }
  const spent = await tier.spend('aiCredits', AI_CREDIT_COSTS[operation]);
  const outcome = creditOutcome(spent, own);
  if (outcome.ok && byOthers && spent && !spent.unmetered)
    await runAll(env, [bumpCounter(BY_OTHERS_SCOPE, day)]);
  return outcome;
}

/** The header a built-in answer carries the owner's month in, when one was spent. */
export const creditsHeader = (credits: KnowledgeAiCredits | null): Record<string, string> =>
  credits ? { [AI_CREDITS_HEADER]: `${credits.used}/${credits.limit}` } : {};
