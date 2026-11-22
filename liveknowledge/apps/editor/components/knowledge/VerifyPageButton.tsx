'use client';

// Verify in the meta row, beside Add Cover (docs/specs/030-knowledgebase/verification.md "Verify"): a quiet ghost
// button the row's own size, for whoever may verify. Pressing it never verifies straight away: a popover says what
// verifying means (the page is vouched for as it stands, and when it comes due again) and asks to Verify or Cancel.
import { useId, useState } from 'react';
import { reviewDays, type ReviewEvery } from '@liveknowledge/knowledge';
import { Button, ResponsivePopover } from '@liveknowledge/ui';
import { VerifiedRowIcon } from './knowledge-icons';

export type VerifyPageButtonProps = {
  /** The page has been verified before: the action reads "Verify Again". */
  again: boolean;
  /** "every 90 days", or undefined under a Review Period of Never. */
  period: string | undefined;
  /** The page has no owner, so verifying makes the verifier its owner. */
  becomesOwner: boolean;
  onVerify: () => void;
};

export function VerifyPageButton({ again, period, becomesOwner, onVerify }: VerifyPageButtonProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const titleId = useId();
  const open = anchor !== null;
  const close = () => setAnchor(null);
  const label = again ? 'Verify Again' : 'Verify';
  return (
    <>
      <button
        type="button"
        data-meta-verify=""
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => setAnchor(e.currentTarget)}
        // As Add Cover: the row's 13 px and slate, its padding hover room only, pulled back by its negative margin.
        className={`-mx-1.5 inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-1.5 text-[13px] font-normal leading-5 text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-600 phone:h-11 dark:text-slate-400 dark:hover:bg-brand-500/15 dark:hover:text-brand-200 ${
          open ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200' : ''
        }`}
      >
        <VerifiedRowIcon />
        {label}
      </button>
      <ResponsivePopover open={open} onClose={close} anchor={anchor} titleId={titleId} width={320}>
        <div data-verify-popover="" className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-900/50"
            >
              <VerifiedRowIcon />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {again ? 'Verify This Page Again?' : 'Verify This Page?'}
              </h2>
              <p className="mt-1 text-[13px] leading-5 text-slate-600 dark:text-slate-400">
                You are vouching that this page is right as it stands today. Readers and agents see
                it as Verified
                {period ? `, and it comes due for review again ${period}.` : '.'}
              </p>
              {becomesOwner ? (
                <p className="mt-2 text-[13px] leading-5 text-slate-600 dark:text-slate-400">
                  It has no owner yet, so you become its owner.
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={close} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                close();
                onVerify();
              }}
              className="cursor-pointer"
            >
              {label}
            </Button>
          </div>
        </div>
      </ResponsivePopover>
    </>
  );
}

/** "in 90 days", "in a year"; undefined under a Review Period of Never. */
export function periodPhrase(every: ReviewEvery): string | undefined {
  const days = reviewDays(every);
  if (days === undefined) return undefined;
  return days === 365 ? 'in a year' : `in ${days} days`;
}
