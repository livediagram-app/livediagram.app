'use client';

// The small parts every app's tier touchpoints share (liveworkspace/docs/specs/019-subscription/subscription.md "What
// people see"): the right offer for whoever is looking, the AI credits line, and the notice once they are used. They
// load with the dialogs that show them, never on the first load; all of them are nothing with Pro off.

import type { LimitKey } from '@liveworkspace/subscription';
import { parseOwnerScope } from '@liveworkspace/subscription';
import { useState, type ReactNode } from 'react';
import { Button, type ButtonSize } from '@liveworkspace/ui';
import { LimitNotice } from '../LimitNotice';
import { useUpgrade } from '../provider';
import { UsageMeter } from '../UsageMeter';
import type { ItemTierView } from './item-tier';
import { creditsLeftLine, creditsUsedWords } from './tier-words';
import type { CreditsSpent } from './use-ai-credits';

/** The offer alone, where a panel lays its own actions out: Upgrade to Pro (Upgrade Team for a team's admin), Ask an
 *  Admin for a team's member, nothing for anyone else or an owner with nowhere higher to go. */
export function TierOfferButton({
  tier,
  limitKey,
  size = 'xs',
}: {
  tier: ItemTierView;
  limitKey: LimitKey;
  size?: ButtonSize;
}) {
  const upgrade = useUpgrade();
  const view = tier.owner.status === 'ready' ? tier.owner.view : null;
  if (!tier.on || !view) return null;
  const target = { owner: view.owner, limit: limitKey };
  if (tier.voice.offer)
    return (
      <Button size={size} onClick={() => upgrade.openUpgrade(target)}>
        {parseOwnerScope(view.owner)?.kind === 'team' ? 'Upgrade Team' : 'Upgrade to Pro'}
      </Button>
    );
  if (tier.action === 'ask_admin')
    return (
      <Button variant="secondary" size={size} onClick={() => upgrade.openAskAdmin(target)}>
        Ask an Admin
      </Button>
    );
  return null;
}

/** The quiet credits line under an AI ask: what it costs, and what is left for someone who may know. */
export function AiCreditsLine({
  tier,
  cost,
}: {
  tier: ItemTierView;
  // "A draft uses 1 AI credit."
  cost: string;
}) {
  if (!tier.on) return null;
  const limit = tier.summary?.limits.aiCreditsPerMonth;
  const used = tier.summary?.usage.aiCredits?.used ?? 0;
  return (
    <div
      data-ai-credits=""
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-slate-500 dark:text-slate-400"
    >
      {limit === undefined ? null : (
        <UsageMeter
          limitKey="aiCreditsPerMonth"
          used={used}
          limit={limit}
          label="AI Credits"
          showLabel={false}
          layout="inline"
          // The meter's label is hidden, so its words name what is counted: "38 of 50 AI credits left this month".
          words={creditsLeftLine(used, limit)}
        />
      )}
      <span>{cost}</span>
    </div>
  );
}

/** The month's AI credits are used (use-ai-credits.ts): when they start again, the offer for someone who may take
 *  it, and a way on that needs no AI where there is one ("Build the Rule by Hand"). */
export function AiCreditsNotice({
  tier,
  spent,
  step = false,
  byHand,
  className,
}: {
  tier: ItemTierView;
  spent: CreditsSpent | null;
  // In an AI step's panel: the step is skipped meanwhile.
  step?: boolean;
  byHand?: ReactNode;
  className?: string;
}) {
  // The clock as the notice first drew: the day the month starts again.
  const [now] = useState(() => Date.now());
  if (!tier.on || !tier.settled || !spent) return null;
  const words = creditsUsedWords(tier.voice, now, step);
  return (
    <LimitNotice
      limitKey="aiCreditsPerMonth"
      used={spent.used}
      limit={spent.max}
      owner={tier.owner}
      sentence={words.sentence}
      offer={words.offer}
      near={false}
      secondaryAction={byHand}
      className={className}
    />
  );
}
