'use client';

// The item's tier as the Automations screen reads it, in every app (liveworkspace/docs/specs/018-automations/
// automations.md "Runs, limits and loops"; 019-subscription/subscription.md "What people see"): the limits the rules
// list answered (never a number worked out here) and who is looking. The screen provides it; the rows, the builder's
// panels, the pickers and Describe a Rule read it. Absent outside the screen. The runs a day and the rules are the
// item's own fixed bounds on every tier; the owner's month of runs is read from their summary (item.summary).
// With Pro off `item.on` is false.

import { createContext, use } from 'react';
import { AUTOMATION_RULES_MAX } from '@liveworkspace/automations';
import { tierUsage, type ItemTierView } from '@liveworkspace/subscription-ui/item-tier';

export type AutomationsTier = {
  item: ItemTierView;
  runsPerDay: number;
  rulesMax: number;
};

/** What the list said of the item's limits. An api from before `rulesMax` reads as the fixed 50. */
export function automationsTierOf(
  data: { runsPerDay: number; rulesMax?: number | undefined },
  item: ItemTierView,
): AutomationsTier {
  return {
    item,
    runsPerDay: data.runsPerDay,
    rulesMax: data.rulesMax ?? AUTOMATION_RULES_MAX,
  };
}

export const AutomationsTierContext = createContext<AutomationsTier | null>(null);

export function useAutomationsTier(): AutomationsTier | null {
  return use(AutomationsTierContext);
}

/** The owner's rules over everything they own against their tier's, for the owner and the owning team alone (from
 *  their summary); null for anyone else and with Pro off. */
export function ownerRules(tier: AutomationsTier | null): { used: number; limit: number } | null {
  const summary = tier?.item.on ? tier.item.summary : null;
  if (!summary) return null;
  return { used: summary.usage.rules?.used ?? 0, limit: summary.limits.automationRules };
}

/** The owner's month of automation runs, for the owner and the owning team alone; null for anyone else and with Pro
 *  off. */
export function monthOfRuns(tier: AutomationsTier | null): { used: number; limit: number } | null {
  return tier?.item.on ? tierUsage(tier.item, 'automationRuns') : null;
}
