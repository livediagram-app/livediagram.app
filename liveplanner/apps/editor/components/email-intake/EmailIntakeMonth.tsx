'use client';

// Email to Board's month with Pro on (docs/specs/026-plan/email-to-board.md "Tiers", "What the dialog shows"): how
// many of the owner's emails to boards became cards this month against their tier's limit, over every plan they own,
// shown only to the owner or the owning team (their own subscription says it), and once the month is used (as the
// read answered it) what happens to the mail that follows. The owner (or a team's admin) is offered the upgrade, a
// team's member Ask an Admin, and anyone else is told what happened and no more.

import { LimitNotice, UsageMeter } from '@liveworkspace/subscription-ui';
import { useState } from 'react';
import { tierUsage, type PlanTier } from '@/components/tier/plan-tier';
import { SeeAllLimitsButton } from '@/components/tier/TierParts';
import { emailsSpentWords, usedOf } from '@/components/tier/tier-words';

export function EmailIntakeMonth({
  tier,
  month,
}: {
  tier: PlanTier;
  month: { limit: number; full: boolean };
}) {
  // The clock as it first drew: the day the month starts again.
  const [now] = useState(() => Date.now());
  const usage = tierUsage(tier, 'emailToBoard');
  // Used once a message was refused (the plan remembers it), or as soon as the owner's own count reaches the limit:
  // the owner never sees a full meter with no word of the mail that follows.
  const full = month.full || (!!usage && usage.used >= usage.limit);
  if (!usage && !full) return null;
  const words = emailsSpentWords(usage?.limit ?? month.limit, tier.voice, now);
  return (
    <div className="flex flex-col gap-2" data-email-intake-month="">
      {usage ? (
        <UsageMeter
          limitKey="emailToBoardPerMonth"
          label="Emails to boards this month"
          used={usage.used}
          limit={usage.limit}
          words={usedOf(usage.used, usage.limit)}
          layout="stacked"
          pro={tier.paid}
        />
      ) : null}
      {full && tier.settled ? (
        <LimitNotice
          limitKey="emailToBoardPerMonth"
          used={usage?.limit ?? month.limit}
          limit={usage?.limit ?? month.limit}
          owner={tier.owner}
          sentence={words.sentence}
          offer={words.offer}
          near={false}
        />
      ) : null}
      {/* Under the notice, its words lined up with the notice's edge: inside it, it wrapped alone under the sentence. */}
      {full && tier.settled ? (
        <div className="-ml-2 flex">
          <SeeAllLimitsButton tier={tier} />
        </div>
      ) : null}
    </div>
  );
}
