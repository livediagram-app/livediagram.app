'use client';

import { useState, type ReactNode } from 'react';
import { dayKey, limitRow, limitReached, type LimitKey } from '@liveworkspace/subscription';
import { Button } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { proOn } from './flag';
import {
  ASK_ADMIN_SENTENCE,
  limitReachedSentence,
  nearLimitSentence,
  offerSentence,
  upgradeLabel,
} from './limit-copy';
import { useUpgrade } from './provider/hooks';
import { ownerViewOf, type OwnerViewInput } from './state';
import { meterState } from './usage';

export type LimitNoticeProps = {
  /** The limit that was met. Its row words the default sentences. */
  limitKey: LimitKey;
  /** What the owner has used of it, as the server reported it. */
  used: number;
  /** The open item's owner, as `useOwnerView(scope)` answers (or the view itself). It decides the action: Upgrade for
   *  someone who may, Ask an Admin for a team's member, and no offer for anyone else. */
  owner: OwnerViewInput;
  /** The limit to count against, where the caller holds a truer one (the server's refusal). The owner view's own
   *  when not given. */
  limit?: number | null;
  /** What happened, in one sentence, in place of the row's own: "Daily limit reached: rules run again tomorrow." */
  sentence?: string;
  /** What the higher tier gives, in place of the row's own: "Pro runs 10,000 a month." Shown only to someone who may
   *  upgrade. */
  offer?: string;
  /** Also nudge from 80% of the limit, quietly and once a day, someone on Free who may upgrade (default true). */
  near?: boolean;
  /** A heading over the sentence, where the notice stands alone: "Image Storage Is Full". */
  title?: string;
  /** The way on that is not an upgrade, drawn first: "Choose Another", "Watch It". With one, the offer steps back to
   *  a quiet **See Pro** beside it. Shown to everyone. */
  primaryAction?: ReactNode;
  /** A second way on, after the offer: "Manage Images". Shown to everyone. */
  secondaryAction?: ReactNode;
  className?: string;
};

const NEAR_SEEN_PREFIX = 'liveworkspace:subscription:near:';

function nearSeenToday(id: string): boolean {
  try {
    return localStorage.getItem(NEAR_SEEN_PREFIX + id) === dayKey(Date.now());
  } catch {
    return false;
  }
}

function markNearSeen(id: string): void {
  try {
    localStorage.setItem(NEAR_SEEN_PREFIX + id, dayKey(Date.now()));
  } catch {
    // Without storage the nudge comes back on the next page; it is never an error.
  }
}

// The words beside their button: the button drops under them where the row is too narrow for both.
const ROW = 'flex flex-wrap items-center gap-x-3 gap-y-2';
// text-pretty: a short sentence never leaves its unit alone on the last line ("Pro takes 25 / MB." on a phone).
const WORDS = 'min-w-0 flex-1 basis-56 text-pretty';
const ACTION = 'relative touch-target shrink-0';

/**
 * The one callout every app shows when a limit is met (subscription.md "Who pays for an item"): what happened in one
 * sentence, then the right action for this person. The owner, or a team's admin, is offered the upgrade; a team's
 * member is pointed at an admin; anyone else is told the limit was reached and nothing more. Someone already on the
 * top tier for the item gets the sentence alone.
 *
 * Renders nothing below the limit (but for the quiet 80% nudge), while the owner is not known, and with Pro off.
 */
export function LimitNotice({
  limitKey,
  used,
  owner,
  limit: given,
  sentence,
  offer,
  near = true,
  title,
  primaryAction,
  secondaryAction,
  className,
}: LimitNoticeProps) {
  const upgrade = useUpgrade();
  const view = ownerViewOf(owner);
  const row = limitRow(limitKey);
  const nearId = `${view?.owner ?? 'unknown'}:${limitKey}`;
  // Dismissed on this page, or earlier today in this browser.
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!proOn()) return null;
  const own = view?.limits ? view.limits[limitKey] : undefined;
  const limit = given !== undefined ? given : typeof own === 'number' ? own : null;
  if (limit === null) return null;

  const action = view?.action ?? 'none';
  const target = view ? { owner: view.owner, limit: limitKey } : {};

  if (!limitReached(used, limit)) {
    // The nudge is an offer, so it is only for someone on Free who may take it.
    const nudge =
      near &&
      view !== null &&
      view.tier === 'free' &&
      action === 'upgrade' &&
      meterState(used, limit) === 'near';
    if (!nudge || dismissed === nearId || nearSeenToday(nearId)) return null;
    const more = offer ?? offerSentence(row, view);
    return (
      <Callout
        tone="info"
        size="md"
        role="status"
        className={className}
        onClose={() => {
          markNearSeen(nearId);
          setDismissed(nearId);
        }}
      >
        <div className={ROW}>
          <span className={WORDS}>
            {sentence ?? nearLimitSentence(row, used, limit)}
            {more ? ` ${more}` : ''}
          </span>
          <Button
            variant="secondary"
            size="xs"
            className={ACTION}
            onClick={() => upgrade.openUpgrade(target)}
          >
            See Pro
          </Button>
        </div>
      </Callout>
    );
  }

  const what = sentence ?? limitReachedSentence(row, limit);
  const more =
    action === 'upgrade' && view
      ? (offer ?? offerSentence(row, view))
      : action === 'ask_admin'
        ? ASK_ADMIN_SENTENCE
        : null;
  return (
    <Callout tone="warning" size="md" role="status" title={title} className={className}>
      <div className={ROW}>
        <span className={WORDS}>
          {what}
          {more ? ` ${more}` : ''}
        </span>
        {primaryAction}
        {action === 'upgrade' && view ? (
          <Button
            variant={primaryAction ? 'secondary' : 'primary'}
            size="xs"
            className={ACTION}
            onClick={() => upgrade.openUpgrade(target)}
          >
            {primaryAction ? 'See Pro' : upgradeLabel(view)}
          </Button>
        ) : action === 'ask_admin' ? (
          <Button
            variant="secondary"
            size="xs"
            className={ACTION}
            onClick={() => upgrade.openAskAdmin(target)}
          >
            Ask an Admin
          </Button>
        ) : null}
        {secondaryAction}
      </div>
    </Callout>
  );
}
