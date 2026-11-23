'use client';

// Under a message step with Pro on, in every app (liveworkspace/docs/specs/004-index/webhooks.md "Messages count as
// Automation Runs (Pro)"): what each message the step sends costs. Nothing with Pro off.

import { useAutomationsTier } from './automations-tier';
import { MESSAGE_RUN_COST } from './tier-words';

export function MessageRunCost() {
  if (!useAutomationsTier()?.item.on) return null;
  return (
    <p data-message-run-cost="" className="text-[12px] text-slate-500 dark:text-slate-400">
      {MESSAGE_RUN_COST}
    </p>
  );
}
