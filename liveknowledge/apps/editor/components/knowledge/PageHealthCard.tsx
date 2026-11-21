'use client';

// Page Health in the right rail (docs/specs/030-knowledgebase/verification.md "Page Health"). Quiet by design: no
// card, no borders, the page's ground showing through. It leads with the page's state beside a freshness ring (how
// much of the Review Period is left), then the owner, the review rows, the week's reads, Verify, and at its foot who
// created the page and who last updated it (as a liveplanner card's footer does). An Editor changes the owner in
// place; the Review Period is the knowledgebase's, so the rail only links to the setting. Every row keeps its height
// while the reads load and when the period changes, so nothing moves under the pointer.
import type { ReactNode } from 'react';
import { reviewDays, type ReviewEvery } from '@liveknowledge/knowledge';
import { Button, Select, Tooltip } from '@liveknowledge/ui';
import { NO_REVIEW_PERIOD, reviewPeriodLabel } from '@/lib/knowledge-settings/review-period-words';
import { shortDate, type PageTrust } from '@/lib/knowledge/page-trust';
import { relativeSince } from '@/lib/relative-time';
import { AgentsIcon, CheckIcon, PeopleIcon } from './knowledge-icons';
import type { KnowledgePerson } from './usePageKnowledge';

const NO_OWNER = '';
const DAY_MS = 86_400_000;

/** Who did something to the page, and when. `by` is a name the editor could resolve. */
export type PageStamp = { at: number; by?: string | undefined };

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
  // Who created the page and who last updated it, where the server says so.
  created?: PageStamp | undefined;
  updated?: PageStamp | undefined;
};

/** The section label, as On This Page's. */
export const RAIL_LABEL =
  'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

/** How much of the Review Period is left, 0 to 1; undefined where there is nothing to count down. */
export function freshness(trust: PageTrust, every: ReviewEvery, now: number): number | undefined {
  const days = reviewDays(every);
  if (days === undefined || trust.reviewAt === undefined) return undefined;
  return Math.min(1, Math.max(0, (trust.reviewAt - now) / (days * DAY_MS)));
}

/** The state's headline and the line under it. */
export function healthHeadline(
  trust: PageTrust,
  every: ReviewEvery,
  now: number,
): { title: string; line: string } {
  if (trust.state === 'never-verified')
    return { title: 'Not Verified Yet', line: 'Verify it once it is right.' };
  if (trust.state === 'review-due')
    return {
      title: 'Review Due',
      line:
        trust.reviewAt === undefined
          ? 'Check it is still right.'
          : `Was due ${shortDate(trust.reviewAt, now)}`,
    };
  if (every === 'never' || trust.reviewAt === undefined)
    return { title: 'Verified', line: 'No review needed' };
  const left = Math.max(1, Math.ceil((trust.reviewAt - now) / DAY_MS));
  return { title: 'Verified', line: `Fresh for ${left} more ${left === 1 ? 'day' : 'days'}` };
}

// A thin ring: the share of the period left, drawn in the state's colour over a faint track. A page never verified
// shows an empty dashed ring.
function FreshnessRing({ state, left }: { state: PageTrust['state']; left: number | undefined }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const tone =
    state === 'review-due'
      ? 'text-amber-500 dark:text-amber-400'
      : 'text-brand-600 dark:text-brand-400';
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center" aria-hidden>
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-10 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          strokeWidth="2.5"
          className="stroke-slate-200 dark:stroke-slate-700"
          {...(state === 'never-verified' ? { strokeDasharray: '3 3' } : {})}
        />
        {state === 'never-verified' ? null : (
          <circle
            data-freshness-arc=""
            cx="18"
            cy="18"
            r={r}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={`${c * (left ?? 1)} ${c}`}
            className={`${tone} motion-safe:transition-[stroke-dasharray] motion-safe:duration-500`}
          />
        )}
      </svg>
      {state === 'verified' ? (
        <span className={`${tone} flex`}>
          <CheckIcon />
        </span>
      ) : (
        <span
          className={`size-1.5 rounded-full ${
            state === 'review-due'
              ? 'bg-amber-500 dark:bg-amber-400'
              : 'bg-slate-300 dark:bg-slate-600'
          }`}
        />
      )}
    </span>
  );
}

// `wrap`: a value of two parts (a date and a name) that are each read in full: it wraps onto a second line at the
// rail's width, where a one-part value truncates.
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
      className={`flex min-h-8 justify-between gap-3 ${wrap ? 'items-baseline py-1' : 'items-center'}`}
    >
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        className={`min-w-0 text-right text-slate-800 dark:text-slate-200 ${
          wrap ? 'break-words' : 'truncate'
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

function StampRow({ what, stamp, now }: { what: string; stamp: PageStamp; now: number }) {
  return (
    <div data-page-stamp="" className="flex min-h-7 items-center gap-2">
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
      >
        {stamp.by ? initials(stamp.by) : '?'}
      </span>
      <span className="min-w-0 flex-1 truncate">
        {what} by {stamp.by ?? 'Someone'}
      </span>
      <Tooltip label={new Date(stamp.at).toLocaleString('en-GB')}>
        <time
          dateTime={new Date(stamp.at).toISOString()}
          className="shrink-0 whitespace-nowrap text-[11px] tabular-nums"
        >
          {relativeSince(stamp.at, now)}
        </time>
      </Tooltip>
    </div>
  );
}

function ReadStat({
  icon,
  value,
  unit,
  label,
}: {
  icon: ReactNode;
  value: string;
  unit: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400 dark:text-slate-500">{icon}</span>
      <dt className="sr-only">{label}</dt>
      <dd className="truncate">
        <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {value}
        </span>{' '}
        <span className="text-slate-500 dark:text-slate-400">{unit}</span>
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
  created,
  updated,
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
  const head = healthHeadline(trust, reviewEvery, now);
  return (
    <section
      aria-label="Page Health"
      data-page-health=""
      className="text-[13px] leading-5 text-slate-700 dark:text-slate-300"
    >
      <h2 className={RAIL_LABEL}>Page Health</h2>
      <div data-page-state={trust.state} className="mt-3 flex items-center gap-3">
        <FreshnessRing state={trust.state} left={freshness(trust, reviewEvery, now)} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {head.title}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{head.line}</p>
        </div>
      </div>
      <dl className="mt-3 flex flex-col">
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
        {/* The date and who verified, each whole: the name takes a line of its own rather than being cut short. */}
        <Row label="Last Verified" wrap={verifiedAt !== undefined && !!verifier}>
          {verifiedAt === undefined ? (
            'Never'
          ) : (
            <>
              <span data-verified-date="" className="block whitespace-nowrap">
                {shortDate(verifiedAt, now)}
              </span>
              {verifier ? (
                <span data-verified-by="" className="block text-slate-500 dark:text-slate-400">
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
        {/* The period and its link, each whole: the link takes a line of its own for an Editor, so the row is one
            height whatever the period. */}
        <Row label="Review Period" wrap={!!onChangeReviewPeriod}>
          <span data-review-period="" className="block whitespace-nowrap">
            {reviewPeriodLabel(reviewEvery)}
          </span>
          {onChangeReviewPeriod ? (
            <button
              type="button"
              onClick={onChangeReviewPeriod}
              aria-label="Change the Review Period"
              className="ml-auto block cursor-pointer rounded-sm text-xs font-medium text-brand-700 underline-offset-2 hover:text-brand-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
            >
              Change
            </button>
          ) : null}
        </Row>
      </dl>
      <div className="mt-4">
        <p className={RAIL_LABEL}>Read This Week</p>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          <ReadStat
            icon={<PeopleIcon />}
            value={count(reads?.people)}
            unit="people"
            label="Reads by People This Week"
          />
          <ReadStat
            icon={<AgentsIcon />}
            value={count(reads?.agents)}
            unit="agents"
            label="Reads by Agents This Week"
          />
        </dl>
      </div>
      {onVerify ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={onVerify}
          className="mt-4 w-full cursor-pointer justify-center gap-1.5 phone:min-h-11"
        >
          <CheckIcon />
          {verifiedAt === undefined ? 'Verify' : 'Verify Again'}
        </Button>
      ) : null}
      {created || updated ? (
        <div className="mt-5 flex flex-col border-t border-slate-200/70 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {created ? <StampRow what="Created" stamp={created} now={now} /> : null}
          {updated ? <StampRow what="Updated" stamp={updated} now={now} /> : null}
        </div>
      ) : null}
    </section>
  );
}
