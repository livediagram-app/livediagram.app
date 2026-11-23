// A plan's tier, as its room holds it (docs/specs/026-plan/automations.md "Tiers"; blueprint automations.md "Tiers
// (Pro)"): the platform's ItemTier (@liveworkspace/subscription item-tier.ts), every app's rooms hold one. The plan's
// head is its row (room-tier.ts).
export {
  ItemTier as PlanTier,
  RECHECK_EVERY_MS,
  tierOn,
  type ItemTierDeps as PlanTierDeps,
  type TierHead,
} from '@liveworkspace/subscription';
