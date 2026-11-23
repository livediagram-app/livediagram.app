'use client';

// Call Minutes, at the foot of Collaborators (docs/specs/012-collaboration/call-minutes.md "What people see"): what
// the Space's owner has used of the month's call minutes, for the owner and the owning team's members. Read from the
// api when the dialog opens (it gives the numbers to those people alone), with the owner's own count from their
// Subscription where it is ahead (another Space of theirs spent since this one last did). Nobody else sees the
// section, and nothing is asked or drawn with Pro off.
import { useEffect, useId, useState } from 'react';
import type { CallMinutesResponse } from '@livehuddle/api-schema';
import { Button } from '@livehuddle/ui';
import { isOwnerScope } from '@liveworkspace/subscription';
import {
  ownerViewOf,
  proOn,
  upgradeTier,
  UsageMeter,
  useOwnerView,
  useSubscription,
  useUpgrade,
} from '@liveworkspace/subscription-ui';
import { apiCallMinutes, type CallsCaller } from '@/lib/api/calls';
import {
  CALL_MINUTES_ABOUT,
  CALL_MINUTES_TITLE,
  callMinutesCount,
  callMinutesOffer,
  callMinutesOfUsed,
  callMinutesResets,
  callMinutesUsedOf,
} from '@/lib/calls/call-minutes-words';

const OFFER_BUTTON = 'relative touch-target shrink-0';

export function CallMinutesSection({ caller }: { caller: CallsCaller | null }) {
  const titleId = useId();
  const [read, setRead] = useState<CallMinutesResponse | null>(null);
  // By its parts, so a caller made afresh each render asks once.
  const ownerId = proOn() ? (caller?.ownerId ?? null) : null;
  const documentId = caller?.documentId ?? null;
  const shareCode = caller?.shareCode ?? null;
  useEffect(() => {
    if (!ownerId || !documentId) return;
    let live = true;
    void apiCallMinutes({ ownerId, documentId, shareCode })
      .then((answer) => {
        if (live) setRead(answer);
      })
      // A read that fails draws no section: the dialog is about the people in the Space first.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [ownerId, documentId, shareCode]);
  const owner = read?.metered && isOwnerScope(read.owner) ? read.owner : null;
  const load = useOwnerView(owner);
  const mine = useSubscription();
  const upgrade = useUpgrade();
  // The clock as the section first drew: the day the month starts again.
  const [now] = useState(() => Date.now());
  const view = ownerViewOf(load);
  if (!read?.metered || !view || view.action === 'none' || read.limit === null) return null;
  // The owner's own count, where this person may see it: theirs, or their team's.
  const me = mine.status === 'ready' ? mine.me : null;
  const summary =
    me?.personal.owner === view.owner
      ? me.personal
      : (me?.teams.find((team) => team.owner === view.owner) ?? null);
  // The service's limit as the page holds it, read again after an upgrade; the api's answers from a minute's cache.
  const limit =
    summary?.limits.callMinutesPerMonth ?? view.limits?.callMinutesPerMonth ?? read.limit;
  const used = Math.max(read.used ?? 0, summary?.usage.callMinutes?.used ?? 0);
  // The tier above is named only to someone on Free who may move to it.
  const offer = view.tier === 'free' && view.action === 'upgrade' ? upgradeTier(view) : null;
  const target = { owner: view.owner, limit: 'callMinutesPerMonth' as const };
  return (
    <section
      aria-labelledby={titleId}
      data-call-minutes={view.action}
      className="flex shrink-0 flex-col gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800"
    >
      <div className="flex flex-col gap-0.5">
        <h3 id={titleId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {CALL_MINUTES_TITLE}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{CALL_MINUTES_ABOUT}</p>
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className="text-[28px] leading-none font-bold tabular-nums text-slate-900 dark:text-slate-100">
          {callMinutesCount(used)}
        </span>
        <span className="text-[13px] text-slate-500 dark:text-slate-400">
          {callMinutesOfUsed(limit)}
        </span>
      </p>
      <UsageMeter
        limitKey="callMinutesPerMonth"
        label={CALL_MINUTES_TITLE}
        showLabel={false}
        showWords={false}
        layout="stacked"
        used={used}
        limit={limit}
        words={`${callMinutesUsedOf(used, limit)} used`}
        pro={view.tier !== null && view.tier !== 'free'}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1 basis-48 text-xs text-slate-600 dark:text-slate-300">
          {callMinutesResets(now)}
          {offer ? ` ${callMinutesOffer(offer)}` : ''}
        </span>
        {offer ? (
          <Button
            variant="secondary"
            size="xs"
            className={OFFER_BUTTON}
            onClick={() => upgrade.openUpgrade(target)}
          >
            See Pro
          </Button>
        ) : view.action === 'ask_admin' && view.tier === 'free' ? (
          <Button
            variant="secondary"
            size="xs"
            className={OFFER_BUTTON}
            onClick={() => upgrade.openAskAdmin(target)}
          >
            Ask an Admin
          </Button>
        ) : null}
      </div>
    </section>
  );
}
