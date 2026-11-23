'use client';

// The Automations screen's tier limits with Pro on, in every app (liveworkspace/docs/specs/018-automations/
// automations.md "Runs, limits and loops"; 019-subscription/subscription.md "What people see"): the owner's Runs This
// Month meter, the line under the tabs as the month runs low and once it is used, and the notice once no rule may be
// added. The month's figures are the owner's and the owning team's alone (their summary); anyone else sees the item's
// Runs today. Each offers the upgrade to the owner or a team's admin, Ask an Admin to a team's member, and says what
// happened and no more to anyone else. Every number is the api's.

import { LimitNotice, UsageMeter } from '@liveworkspace/subscription-ui';
import { usedOf } from '@liveworkspace/subscription-ui/item-tier';
import type { AutomationsTier } from './automations-tier';
import { rulesFullWords, runsNearWords, runsUsedWords } from './tier-words';

type Month = { used: number; limit: number };

export function TierRunsMeter({
  tier,
  month,
  phone,
}: {
  tier: AutomationsTier;
  // The owner's month of runs (monthOfRuns).
  month: Month;
  // The phone's footer: the count over a bar the footer's width.
  phone: boolean;
}) {
  return (
    <UsageMeter
      limitKey="automationRunsPerMonth"
      label="Runs This Month"
      used={month.used}
      limit={month.limit}
      words={usedOf(month.used, month.limit)}
      layout={phone ? 'stacked' : 'inline'}
      pro={tier.item.paid}
    />
  );
}

/** Under the tabs: from 80% of the month a quiet nudge for a Free owner, and once it is used what happened. */
export function RunsNotice({
  tier,
  month,
  now,
  className,
}: {
  tier: AutomationsTier;
  month: Month;
  // The screen's clock (useMinuteClock), for the day the month turns.
  now: number;
  className?: string;
}) {
  const { voice } = tier.item;
  if (!tier.item.settled) return null;
  const words =
    month.used >= month.limit
      ? runsUsedWords(voice, now)
      : runsNearWords(month.limit - month.used, voice);
  return (
    <LimitNotice
      limitKey="automationRunsPerMonth"
      used={month.used}
      limit={month.limit}
      owner={tier.item.owner}
      sentence={words.sentence}
      offer={words.offer}
      className={className}
    />
  );
}

/** The owner's rules over everything they own are at their tier's: why New Rule, the templates and Duplicate are
 *  off, and the way on. `held` and `max` are the owner's. */
export function RulesNotice({
  tier,
  held,
  max,
  item,
  className,
}: {
  tier: AutomationsTier;
  held: number;
  max: number;
  item: string;
  className?: string;
}) {
  if (!tier.item.settled) return null;
  return (
    <LimitNotice
      limitKey="automationRules"
      used={held}
      limit={max}
      owner={tier.item.owner}
      sentence={rulesFullWords(held, max, tier.item.voice, item, true)}
      offer=""
      near={false}
      className={className}
    />
  );
}
