'use client';

import { useEffect, useRef, useState } from 'react';
import { TIER_NAMES, type PaidTier } from '@liveworkspace/subscription';
import { CheckIcon, CloseIcon, Portal, safeInset, Tooltip } from '@liveworkspace/ui';
import { ON_INK_ICON_BUTTON } from '../on-ink';
import { ProBadge } from '../ProBadge';
import { subscribedGains } from './subscribed-gains';

// Long enough to read the three lines, then it leaves on its own. The clock waits while the pointer rests on the
// notice or the keyboard is inside it, so it never goes from under someone reading or about to press.
export const SUBSCRIBED_NOTICE_MS = 20_000;

/**
 * Back from the checkout with the subscription confirmed (subscription.md "Back from the checkout"): an ink card at
 * the foot of the page saying which tier is now on and the three things it changed, with the way to every limit. It
 * never covers the work or takes the keyboard; it leaves after a short while or when dismissed, and is read out as a
 * status.
 */
export function SubscribedNotice({
  tier,
  teamName,
  pricingHref,
  onDismiss,
}: {
  tier: PaidTier;
  /** The team's name, for a team's subscription; null for the person's own. */
  teamName: string | null;
  /** Where every limit is laid out side by side. */
  pricingHref: string;
  onDismiss: () => void;
}) {
  // The timer keeps the time it started with, whatever function it is handed on later renders: one that started
  // again with each new `onDismiss` would never run out on a page that renders often.
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });
  const [held, setHeld] = useState(false);
  const left = useRef(SUBSCRIBED_NOTICE_MS);
  useEffect(() => {
    if (held) return;
    const started = Date.now();
    const timer = setTimeout(() => dismiss.current(), left.current);
    return () => {
      clearTimeout(timer);
      left.current = Math.max(0, left.current - (Date.now() - started));
    };
  }, [held]);

  const name = TIER_NAMES[tier];
  return (
    <Portal>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-toast)] flex justify-center px-4"
        style={{ paddingBottom: `calc(${safeInset('bottom')} + 1rem)` }}
      >
        <section
          role="status"
          data-subscribed-notice={tier}
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
          className="pointer-events-auto flex w-full max-w-md animate-fade-in flex-col gap-3.5 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white shadow-2xl shadow-slate-900/30 motion-reduce:animate-none"
        >
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
              <ProBadge form="solid" ground="ink" tooltip={false} label="Pro" />
              <p className="text-lg leading-tight font-bold tracking-tight">
                {teamName ? `${teamName} Is on ${name}` : `You’re on ${name}`}
              </p>
              <p className="text-[13px] leading-normal text-slate-300">
                {teamName
                  ? 'The team’s new limits are live in every app.'
                  : 'Your new limits are live in every app.'}
              </p>
            </div>
            <Tooltip label="Dismiss">
              <button
                type="button"
                aria-label="Dismiss"
                onClick={onDismiss}
                className={`${ON_INK_ICON_BUTTON} -mt-1.5 -mr-1.5 size-8`}
              >
                <CloseIcon />
              </button>
            </Tooltip>
          </div>
          <ul className="flex flex-col gap-2 border-t border-white/10 pt-3.5">
            {subscribedGains(tier).map((gain) => (
              <li key={gain.key} className="flex items-start gap-2.5 text-[13px] leading-normal">
                <span
                  aria-hidden
                  className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"
                >
                  <CheckIcon size={11} />
                </span>
                <span className="min-w-0 text-slate-300">
                  <strong className="font-semibold text-white">{gain.lead}</strong>
                  {gain.rest}
                </span>
              </li>
            ))}
          </ul>
          <a
            href={pricingHref}
            className="touch-target-y relative self-start rounded text-[13px] font-semibold text-white underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            See Limits
          </a>
        </section>
      </div>
    </Portal>
  );
}
