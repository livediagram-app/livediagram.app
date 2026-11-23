'use client';

// An AI step's panel with Pro on, in every app's kit (liveworkspace/docs/specs/019-subscription/subscription.md "Tiers
// and limits"): under its fields, what a run of the step spends, the month's credits for someone who may see them,
// and what happens once they are used. Nothing with Pro off.

import {
  AI_STEP_CREDIT,
  AiCreditsLine,
  AiCreditsNotice,
  useAiCredits,
  type ItemTierView,
} from '@liveworkspace/subscription-ui/item-tier';
import { useAutomationsTier } from './automations-tier';

export function AiStepCredits() {
  const tier = useAutomationsTier()?.item;
  if (!tier?.on) return null;
  return <AiStepCreditsOn tier={tier} />;
}

function AiStepCreditsOn({ tier }: { tier: ItemTierView }) {
  const credits = useAiCredits(tier);
  return (
    <div className="flex flex-col gap-2">
      <AiCreditsLine tier={tier} cost={AI_STEP_CREDIT} />
      <AiCreditsNotice tier={tier} spent={credits.spent} step />
    </div>
  );
}
