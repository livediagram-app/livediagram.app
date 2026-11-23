'use client';

// The small parts liveplanner's tier touchpoints share (docs/specs/026-plan/automations.md "What the editor shows"):
// the shared offer and AI credits parts (@liveworkspace/subscription-ui/item-tier), and See All Limits, which opens
// the workbench's Settings. All of them are nothing with Pro off.

import { Button } from '@liveworkspace/ui';
import { requestOpenSettings } from '@liveworkspace/workbench/lib/open-settings';
import type { PlanTier } from './plan-tier';

export {
  AiCreditsLine,
  AiCreditsNotice,
  TierOfferButton,
} from '@liveworkspace/subscription-ui/item-tier';

/** Opens Settings at Subscription, where every limit is listed beside what is used. For someone with a subscription
 *  of their own to look at there: the owner and the owning team, never a collaborator. */
export function SeeAllLimitsButton({ tier }: { tier: PlanTier }) {
  if (!tier.on || tier.action === 'none') return null;
  return (
    <Button variant="ghost" size="xs" onClick={() => requestOpenSettings('subscription')}>
      See All Limits
    </Button>
  );
}
