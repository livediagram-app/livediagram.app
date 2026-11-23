// @liveworkspace/subscription-ui/item-tier: an item's tier as every app's editor shows it (liveworkspace/docs/specs/
// 019-subscription/subscription.md "Who pays for an item", "What people see"): who is looking and what they may know,
// the limits read again without a reload, the month's AI credits around an ask, and their words and parts. Nothing
// here draws or asks anything with Pro off.
export {
  ITEM_TIER_OFF,
  PLAIN_VOICE,
  tierUsage,
  useItemTier,
  useOwnTier,
  type ItemTierView,
  type TierVoice,
} from './item-tier';
export { FOCUS_REREAD_MS, SETTLE_REREAD_MS, tierKey, useTierReread } from './use-tier-reread';
export { creditsRefusal, useAiCredits, type CreditsSpent } from './use-ai-credits';
export {
  AI_DRAFT_CREDIT,
  AI_STEP_CREDIT,
  creditsLeftLine,
  creditsUsedWords,
  monthResetDay,
  offerAbove,
  tierAbove,
  tierCount,
  tierPlural,
  usedOf,
  type TierWords,
} from './tier-words';
export { AiCreditsLine, AiCreditsNotice, TierOfferButton } from './TierParts';
export { GuestLimitNote } from './GuestLimitNote';
