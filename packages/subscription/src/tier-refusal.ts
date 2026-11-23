// What a refusal says when a tier's limit caused it (liveworkspace/docs/specs/019-subscription/subscription.md "What
// people see"): the limit's name, what is used and the most the owner's tier allows, for the editor and the agents to
// word. Only with Pro on: with it off a refusal's body is as it always was.
import type { ItemTier } from './item-tier';

export type TierLimitRefusalOf<K extends string> = {
  limit: K;
  used: number;
  max: number;
  guest?: true;
};

export function tierRefusal<K extends string>(
  tier: Pick<ItemTier, 'on' | 'guest'> | null | undefined,
  limit: K,
  used: number,
  max: number,
): TierLimitRefusalOf<K> | Record<string, never> {
  return tier?.on ? { limit, used, max, ...(tier.guest ? { guest: true as const } : {}) } : {};
}
