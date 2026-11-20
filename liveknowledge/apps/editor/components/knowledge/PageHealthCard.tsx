'use client';

// The Page Health card (docs/specs/030-knowledgebase/verification.md "Page Health"): the page's owner, when it was
// last verified, when its review is due, the knowledgebase's Review Period, how many times people and agents read
// it this week, and Verify Again. An Editor changes the owner in place; the Review Period is the knowledgebase's,
// so the card has no control for it, only a link to the setting. Every row keeps its height while the reads load
// and when the period changes, so the card never grows under the pointer.
import type { ReactNode } from 'react';
import type { ReviewEvery } from '@liveknowledge/knowledge';
import { Button, Select } from '@liveknowledge/ui';
import { NO_REVIEW_PERIOD, reviewPeriodLabel } from '@/lib/knowledge-settings/review-period-words';
import { shortDate, type PageTrust } from '@/lib/knowledge/page-trust';
import type { KnowledgePerson } from './usePageKnowledge';

const NO_OWNER = '';

export type PageHealthCardProps = {
  trust: PageTrust;
  /** The knowledgebase's Review Period, which `trust` was worked out under. */
  reviewEvery: ReviewEvery;
  now: number;
  // The week's reads; absent until Page Health is read (and for a knowledgebase kept Offline).
  reads: { people: number; agents: number } | undefined;
  people: readonly KnowledgePerson[];
  nameOf: (id: string | undefined) => string | undefined;
  // Absent for anyone who may not change the fields: the rows read as text.
  onSetOwner: ((owner: string | null) => void) | undefined;
  // Opens Knowledgebase Settings; absent for anyone who may not change the Review Period.
  onChangeReviewPeriod: (() => void) | undefined;
  onVerify: (() => void) | undefined;
};

// `wrap`: a value of two parts (a date and a name) that are each read in full: it wraps onto a second line at the
// card's width, where a one-part value truncates.
function Row({
  label,
  wrap = false,
  children,
}: {
  label: string;
  wrap?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex min-h-7 justify-between gap-3 ${wrap ? 'items-baseline py-1' : 'items-center'}`}
    >
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        className={`min-w-0 text-right font-medium text-slate-900 dark:text-slate-100 ${
          wrap ? 'break-words' : 'truncate'
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

export function PageHealthCard({
  trust,
  reviewEvery,
  now,
  reads,
  people,
  nameOf,
  onSetOwner,
  onChangeReviewPeriod,
  onVerify,
}: PageHealthCardProps) {
  const { owner, verifiedAt, verifiedBy } = trust.fields;
  const ownerName = nameOf(owner);
  const verifier = nameOf(verifiedBy);
  // An owner the editor cannot name (someone outside the team it can read) still shows as chosen.
  const ownerOptions =
    owner && !people.some((p) => p.id === owner)
      ? [...people, { id: owner, name: 'Someone Else' }]
      : people;
  const count = (n: number | undefined) => (n === undefined ? '–' : n.toLocaleString('en'));
  return (
    <section
      aria-label="Page Health"
      data-page-health=""
      className="rounded-xl border border-slate-200 bg-white p-4 text-[13px] leading-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Page Health</h2>
      <dl className="mt-2 flex flex-col gap-1">
        <Row label="Owner">
          {onSetOwner ? (
            <Select
              aria-label="Owner"
              size="md"
              value={owner ?? NO_OWNER}
              onChange={(e) => onSetOwner(e.target.value === NO_OWNER ? null : e.target.value)}
              className="max-w-40 cursor-pointer"
            >
              <option value={NO_OWNER}>No Owner</option>
              {ownerOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          ) : (
            (ownerName ?? (owner ? 'Someone Else' : 'No Owner'))
          )}
        </Row>
        {/* The date and who verified, each whole: the name takes a line of its own rather than being cut short
            ("Nov 20 by Priya N…" at the card's width). */}
        <Row label="Last Verified" wrap={verifiedAt !== undefined && !!verifier}>
          {verifiedAt === undefined ? (
            'Never'
          ) : (
            <>
              <span data-verified-date="" className="block whitespace-nowrap">
                {shortDate(verifiedAt, now)}
              </span>
              {verifier ? (
                <span
                  data-verified-by=""
                  className="block font-normal text-slate-600 dark:text-slate-400"
                >
                  by {verifier}
                </span>
              ) : null}
            </>
          )}
        </Row>
        <Row label="Review Due">
          <span data-review-due="">
            {reviewEvery === 'never'
              ? NO_REVIEW_PERIOD
              : trust.reviewAt === undefined
                ? 'Once Verified'
                : shortDate(trust.reviewAt, now)}
          </span>
        </Row>
        <Row label="Review Period">
          <span data-review-period="">{reviewPeriodLabel(reviewEvery)}</span>
          {onChangeReviewPeriod ? (
            <>
              {', '}
              <button
                type="button"
                onClick={onChangeReviewPeriod}
                aria-label="Change the Review Period"
                className="cursor-pointer rounded-sm font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
              >
                Change
              </button>
            </>
          ) : null}
        </Row>
        <Row label="Reads by People This Week">
          <span className="tabular-nums">{count(reads?.people)}</span>
        </Row>
        <Row label="Reads by Agents This Week">
          <span className="tabular-nums">{count(reads?.agents)}</span>
        </Row>
      </dl>
      {onVerify ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={onVerify}
          className="mt-3 w-full cursor-pointer justify-center phone:min-h-11"
        >
          {verifiedAt === undefined ? 'Verify' : 'Verify Again'}
        </Button>
      ) : null}
    </section>
  );
}
