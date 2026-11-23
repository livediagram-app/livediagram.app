// An AI draft's credit (docs/specs/026-plan/describe-a-plan.md "Limits and cost"; docs/specs/030-forms/
// describe-a-form.md): with Pro on, Describe a Plan and Describe a Form each spend one AI credit for the month before
// the model is asked. Who pays follows the one rule (liveworkspace 019 "Who pays for an item"): a draft for an
// existing plan (Describe a Form on one of its tabs) spends its OWNER's credit, its team's for a team's plan, and a
// draft that is nobody's plan yet (Describe a Plan, a form with no plan) spends the signed-in person's own. With Pro
// off nothing is asked.
import type { TierLimitRefusal } from '@liveplanner/api-schema';
import {
  AI_CREDIT_COSTS,
  personScope,
  refusedByService,
  type OwnerScope,
} from '@liveworkspace/subscription';
import { subscriptionOf } from '../subscription';
import type { Env } from '../types';

/**
 * One credit spent from `payer`'s month (the person's own when no payer is named): null when the draft may go ahead,
 * the refusal's fields when the month is used, and `unavailable` when the subscription service refused this Worker's
 * request (its key, never the payer's month), so nothing is drafted uncounted and no upgrade is offered.
 */
export async function spendDraftCredit(
  env: Env,
  accountId: string,
  payer: OwnerScope | 'nobody' | null = null,
): Promise<TierLimitRefusal | 'unavailable' | null> {
  const client = subscriptionOf(env);
  // A guest's plan has nobody to charge (019 "A guest's item"): nothing is spent or asked, and the day's cap holds.
  if (!client.enabled || payer === 'nobody') return null;
  const spent = await client.spend(
    payer ?? personScope(accountId),
    'aiCredits',
    AI_CREDIT_COSTS.planDraft,
  );
  if (spent.ok) return null;
  if (refusedByService(spent)) {
    console.error('[draft] credits not checked: the subscription service refused the request');
    return 'unavailable';
  }
  return { limit: 'aiCreditsPerMonth', used: spent.used, max: spent.limit ?? 0 };
}
