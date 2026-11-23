'use client';

// The owner's month of form responses with Pro on (docs/specs/030-forms/forms.md "Abuse and limits → Tiers", "What
// the editor shows"): what the owner's forms took this month against their tier's limit, over every form they own,
// shown only to the owner or the owning team (their own subscription says it), and once the month is used (as the
// link read answered it) why this form is paused and when it takes responses again. The owner (or a team's admin)
// is offered the upgrade, a team's member Ask an Admin, anyone else the sentence alone. The public page says none of
// this: it shows one neutral closed message.

import type { FormLinkResponse } from '@liveplanner/api-schema';
import { LimitNotice, UsageMeter } from '@liveworkspace/subscription-ui';
import { Button } from '@liveworkspace/ui';
import { useState } from 'react';
import { tierUsage, usePlanTier } from '@/components/tier/plan-tier';
import { formMonthFullWords, usedOf } from '@/components/tier/tier-words';

/** Whether the form's month is full, as the editor may say it: with Pro on here and on the server. */
export function useFormMonth(link: FormLinkResponse | null) {
  const tier = usePlanTier(link?.owner);
  const month = tier.on ? (link?.month ?? null) : null;
  // Used once a response was turned away (the link read says so), or as soon as the owner's own count reaches the
  // limit: the owner never sees a full meter beside "Accepting Responses".
  const usage = month ? tierUsage(tier, 'formResponses') : null;
  return { tier, month, full: !!month?.full || (!!usage && usage.used >= usage.limit) };
}

export function FormMonth({
  link,
  onViewResponses,
  className,
}: {
  link: FormLinkResponse | null;
  // Opens the tab the responses go to, beside the offer once the month is full.
  onViewResponses?: (() => void) | null | undefined;
  className?: string;
}) {
  const { tier, month, full } = useFormMonth(link);
  // The clock as it first drew: the day the month starts again.
  const [now] = useState(() => Date.now());
  if (!month) return null;
  // The owner's own count, where this person may see it.
  const usage = tierUsage(tier, 'formResponses');
  if (!usage && !full) return null;
  return (
    <div data-form-month="" className={`flex flex-col gap-2${className ? ` ${className}` : ''}`}>
      {usage ? (
        <UsageMeter
          limitKey="formResponsesPerMonth"
          label="Form responses this month"
          used={usage.used}
          limit={usage.limit}
          words={usedOf(usage.used, usage.limit)}
          layout="stacked"
          pro={tier.paid}
        />
      ) : null}
      {full && tier.settled ? (
        <LimitNotice
          limitKey="formResponsesPerMonth"
          used={usage?.limit ?? month.limit}
          limit={usage?.limit ?? month.limit}
          owner={tier.owner}
          sentence={formMonthFullWords(usage?.limit ?? month.limit, tier.voice, now)}
          offer=""
          near={false}
          secondaryAction={
            onViewResponses ? (
              <Button variant="secondary" size="xs" onClick={onViewResponses}>
                View Responses
              </Button>
            ) : undefined
          }
        />
      ) : null}
    </div>
  );
}
