// What a refusal says when a tier's limit caused it (docs/specs/026-plan/automations.md "Tiers"): the platform's
// `tierRefusal` (@liveworkspace/subscription), in liveplanner's limit names.
import type { TierLimitKey, TierLimitRefusal } from '@liveplanner/api-schema';
import { tierRefusal as shared } from '@liveworkspace/subscription';
import type { PlanTier } from './plan-tier';

export function tierRefusal(
  tier: Pick<PlanTier, 'on' | 'guest'> | null | undefined,
  limit: TierLimitKey,
  used: number,
  max: number,
): TierLimitRefusal | Record<string, never> {
  return shared(tier, limit, used, max);
}
