// What the api says of a plan's tier limits (docs/specs/026-plan/automations.md "Tiers";
// liveworkspace/docs/specs/019-subscription/subscription.md). All of it is absent with Pro off. The names are the
// subscription contract's limit keys, written here so the wire needs none of its code.

/** The tier limits liveplanner enforces. */
export const TIER_LIMIT_KEYS = [
  'automationRunsPerMonth',
  'automationRules',
  'emailToBoardPerMonth',
  'formResponsesPerMonth',
  'publicRoadmaps',
  'aiCreditsPerMonth',
] as const;
export type TierLimitKey = (typeof TIER_LIMIT_KEYS)[number];

/** On a refusal a tier limit caused: which limit, what is used and the most the owner's tier allows. `guest`: the
 *  plan's owner has no account, so the limit is Free's and nobody is offered an upgrade: signing in keeps the plan. */
export type TierLimitRefusal = { limit: TierLimitKey; used: number; max: number; guest?: true };

/** A count against a tier limit, on a read. `limit` null is unlimited. */
export type TierUsage = { used: number; limit: number | null };

/** The owner whose tier an item runs on: `p:<account id>` or `t:<team id>`, as the subscription service names one. */
export type TierOwner = string;
