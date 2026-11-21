'use client';

// Page Health in the right rail (docs/specs/030-knowledgebase/verification.md "Page Health"). It leads with a status
// panel washed in the state's colour (a freshness ring round the state's glyph, how much of the Review Period is left,
// and Verify), then the owner and review facts, each with its glyph. The week's reads and who created and last
// updated the page are PageActivity, held at the rail's foot (as a liveplanner card's footer is). An Editor changes the owner in
// place, and the Review Period (the knowledgebase's, every page's) beside its row. Every row keeps its height
// while the reads load and when the period changes, so nothing moves under the pointer.
import { GUEST_DISC_TINT, isGuestName } from './guest-disc';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type { ReactNode } from 'react';
import { reviewDays, type ReviewEvery } from '@liveknowledge/knowledge';
import { Button, Select, Tooltip } from '@liveknowledge/ui';
import { NO_REVIEW_PERIOD, reviewPeriodLabel } from '@/lib/knowledge-settings/review-period-words';
import { shortDate, type PageTrust } from '@/lib/knowledge/page-trust';
import { relativeSince } from '@/lib/relative-time';
import {
  AgentsIcon,
  CheckIcon,
  DueIcon,
  DueRowIcon,
  OwnerIcon,
  PeopleIcon,
  PeriodIcon,
  UnverifiedIcon,
  VerifiedIcon,
  VerifiedRowIcon,
  MakerPersonIcon,
} from './knowledge-icons';
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
  people: readonly KnowledgePerson[];
  nameOf: (id: string | undefined) => string | undefined;
  // Absent for anyone who may not change the fields: the rows read as text.
  onSetOwner: ((owner: string | null) => void) | undefined;
  onVerify: (() => void) | undefined;
  /** Change, beside the Review Period: absent for anyone who may not change it (anyone but an Editor of the whole
   *  knowledgebase). */
  periodControl?: ReactNode;
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
    return { title: 'Not Verified', line: "Verify once it's right." };
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
  // The rail's clock ticks once a minute, so just after a verify it can read earlier than the verify itself: counted
  // from no earlier than the verify, a page verified now reads its whole period, never a day more.
  const from = Math.max(now, trust.fields.verifiedAt ?? now);
  const left = Math.max(1, Math.ceil((trust.reviewAt - from) / DAY_MS));
  return { title: 'Verified', line: `Fresh for ${left} more ${left === 1 ? 'day' : 'days'}` };
}

// The state's tone: a soft wash behind the status panel, the ring's arc and the glyph's ink.
const TONE: Record<PageTrust['state'], { wash: string; ink: string }> = {
  verified: {
    wash: 'bg-gradient-to-br from-brand-50 via-brand-50/50 to-white ring-brand-100 dark:from-brand-950/60 dark:via-brand-950/25 dark:to-transparent dark:ring-brand-900/50',
    ink: 'text-brand-700 dark:text-brand-300',
  },
  'review-due': {
    wash: 'bg-gradient-to-br from-amber-50 via-amber-50/50 to-white ring-amber-100 dark:from-amber-950/50 dark:via-amber-950/20 dark:to-transparent dark:ring-amber-900/40',
    ink: 'text-amber-700 dark:text-amber-300',
  },
  'never-verified': {
    wash: 'bg-gradient-to-br from-slate-50 via-slate-50/60 to-white ring-slate-200/70 dark:from-slate-900/70 dark:via-slate-900/30 dark:to-transparent dark:ring-slate-800',
    ink: 'text-slate-500 dark:text-slate-400',
  },
};

// The ring: the share of the Review Period left, in the state's colour over a faint track, around the state's glyph.
// A page never verified shows an empty dashed ring.
function FreshnessRing({ state, left }: { state: PageTrust['state']; left: number | undefined }) {
  const r = 21;
  const c = 2 * Math.PI * r;
  const { ink } = TONE[state];
  return (
    <span
      className={`relative flex size-12 shrink-0 items-center justify-center ${ink}`}
      aria-hidden
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-12 -rotate-90">
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          strokeWidth="3"
          className="stroke-white/90 dark:stroke-slate-800"
          {...(state === 'never-verified' ? { strokeDasharray: '3 4' } : {})}
        />
        {state === 'never-verified' ? null : (
          <circle
            data-freshness-arc=""
            cx="24"
            cy="24"
            r={r}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={`${c * Math.max(0.02, left ?? 1)} ${c}`}
            className="motion-safe:transition-[stroke-dasharray] motion-safe:duration-200"
          />
        )}
      </svg>
      {state === 'verified' ? (
        <VerifiedIcon />
      ) : state === 'review-due' ? (
        <DueIcon />
      ) : (
        <UnverifiedIcon />
      )}
    </span>
  );
}

// One fact: a quiet glyph, its label, and the value at the right. `wrap`: a value of two parts (a date and a name)
// that are each read in full, on two lines, where a one-part value truncates. `whole`: a value never cut short (the
// Review Period beside its pencil): it stays on the label's line when it fits, and takes a line of its own, at the
// right, when it does not.
function Row({
  icon,
  label,
  wrap = false,
  whole = false,
  children,
}: {
  icon: ReactNode;
  label: string;
  wrap?: boolean;
  whole?: boolean;
  children: ReactNode;
}) {
  if (whole)
    return (
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-1 py-1">
        <dt className="flex shrink-0 items-center gap-2 text-slate-500 dark:text-slate-400">
          <span className="flex text-slate-400 dark:text-slate-400/60">{icon}</span>
          {label}
        </dt>
        <dd className="ml-auto whitespace-nowrap text-right font-medium text-slate-800 dark:text-slate-200">
          {children}
        </dd>
      </div>
    );
  return (
    <div
      className={`flex min-h-9 justify-between gap-3 ${wrap ? 'items-baseline py-1.5' : 'items-center'}`}
    >
      <dt className="flex shrink-0 items-center gap-2 text-slate-500 dark:text-slate-400">
        <span
          className={`flex text-slate-400 dark:text-slate-400/60 ${wrap ? 'translate-y-0.5 self-start' : ''}`}
        >
          {icon}
        </span>
        {label}
      </dt>
      <dd
        className={`min-w-0 text-right font-medium text-slate-800 dark:text-slate-200 ${
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

// A person's disc, tinted by their name so the same person reads the same everywhere in the rail.
const DISC_TINTS = [
  'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
  'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200',
];
const NO_TINT = 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';

function tintOf(name: string | undefined): string {
  if (!name) return NO_TINT;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return DISC_TINTS[Math.abs(h) % DISC_TINTS.length]!;
}

function Disc({ name, size = 'size-6' }: { name: string | undefined; size?: string }) {
  return (
    <span
      aria-hidden
      className={`flex ${size} shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-white dark:ring-slate-950 ${isGuestName(name) ? GUEST_DISC_TINT : tintOf(name)}`}
    >
      {isGuestName(name) ? (
        <MakerPersonIcon />
      ) : (
        <span className="text-optical-centre">{name ? initials(name) : '?'}</span>
      )}
    </span>
  );
}

function StampRow({ what, stamp, now }: { what: string; stamp: PageStamp; now: number }) {
  // Two lines, so a whole name fits the rail: who, then what they did and when.
  return (
    <div data-page-stamp="" className="flex min-h-9 items-center gap-2.5">
      <Disc name={!stamp.by || stamp.by === 'Someone' ? 'Guest' : stamp.by} />
      <span className="min-w-0 flex-1 leading-4">
        <span className="block truncate text-[13px] font-medium text-slate-800 dark:text-slate-200">
          {/* A guest's stamp, and one written before guests were named so, reads "Guest" (owner 2026-11-21). */}
          {!stamp.by || stamp.by === 'Someone' ? 'Guest' : stamp.by}
        </span>
        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
          {what}{' '}
          <Tooltip label={new Date(stamp.at).toLocaleString('en-GB')}>
            <time dateTime={new Date(stamp.at).toISOString()} className="tabular-nums">
              {relativeSince(stamp.at, now)}
            </time>
          </Tooltip>
        </span>
      </span>
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
    <div className="flex items-center gap-2 rounded-lg bg-white/80 px-2.5 py-2 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-900/60 dark:ring-slate-800">
      <span className="flex text-slate-400 dark:text-slate-400/60">{icon}</span>
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 truncate">
        <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {value}
        </span>{' '}
        <span className="text-slate-500 dark:text-slate-400">{unit}</span>
      </dd>
    </div>
  );
}

/** Read This Week's drawing: an open book in the theme's ink, its lines read off as dots, behind the counts. */
function ReadWeekArt() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 120 64"
      className="pointer-events-none absolute -right-3 -top-2 -z-10 h-20 w-36 text-brand-600/25 dark:text-brand-300/20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M60 18c-9-6-22-8-36-6v40c14-2 27 0 36 6 9-6 22-8 36-6V12c-14-2-27 0-36 6Z" />
      <path d="M60 18v40" />
      <path d="M32 22h18M32 29h20M32 36h14M68 22h20M68 29h16M68 36h19" opacity=".7" />
      <path d="M32 43h1M38 43h1M44 43h1M68 43h1M74 43h1M80 43h1" strokeWidth="2.5" />
      <path d="M100 8l2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" fill="currentColor" stroke="none" />
      <path
        d="M14 50l1.2 2.4 2.4 1.2-2.4 1.2L14 57.2l-1.2-2.4-2.4-1.2 2.4-1.2Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export type PageActivityProps = {
  now: number;
  reads: { people: number; agents: number } | undefined;
  created?: PageStamp | undefined;
  updated?: PageStamp | undefined;
  /** In the docked rail's foot: the week's reads fill it to its edges. */
  fill?: boolean;
};

/**
 * The rail's foot, held at the bottom of the docked rail while the rest scrolls: who created the page and who last
 * updated it, then the week's reads.
 */
export function PageActivity({ now, reads, created, updated, fill = false }: PageActivityProps) {
  // Before Page Health is read (and Offline) the week's reads count as none yet.
  const count = (n: number | undefined) => (n ?? 0).toLocaleString('en');
  return (
    <section
      aria-label="Page Activity"
      data-page-activity=""
      className="text-[13px] leading-5 text-slate-700 dark:text-slate-300"
    >
      {/* Who created and last updated the page, above the week's reads (owner 2026-11-21). */}
      {created || updated ? (
        <div className="mb-3 flex flex-col gap-0.5">
          {created ? <StampRow what="Created" stamp={created} now={now} /> : null}
          {updated ? <StampRow what="Updated" stamp={updated} now={now} /> : null}
        </div>
      ) : null}
      {/* The week's reads on the theme's tint, with a quiet open book and its reading lines drawn behind. */}
      <div
        data-read-week=""
        className={`relative isolate overflow-hidden bg-gradient-to-br from-brand-50 via-brand-50/40 to-white dark:from-brand-950/50 dark:via-brand-950/20 dark:to-slate-900 ${
          // In the docked rail's foot it fills the foot to its edges (owner 2026-11-21); elsewhere a soft panel.
          fill
            ? '-mx-6 -mb-4 border-t border-brand-100 px-6 py-4 first:-mt-4 first:border-t-0 dark:border-brand-900/40'
            : 'rounded-2xl p-3 ring-1 ring-inset ring-brand-100 dark:ring-brand-900/40'
        }`}
      >
        <ReadWeekArt />
        <p className={RAIL_LABEL}>Read This Week</p>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          <ReadStat
            icon={<PeopleIcon />}
            value={count(reads?.people)}
            unit={reads?.people === 1 ? 'Person' : 'People'}
            label="Reads by People This Week"
          />
          <ReadStat
            icon={<AgentsIcon />}
            value={count(reads?.agents)}
            unit={reads?.agents === 1 ? 'Agent' : 'Agents'}
            label="Reads by Agents This Week"
          />
        </dl>
      </div>
    </section>
  );
}

export function PageHealthCard({
  trust,
  reviewEvery,
  now,
  people,
  nameOf,
  onSetOwner,
  onVerify,
  periodControl,
}: PageHealthCardProps) {
  const { owner, verifiedAt, verifiedBy } = trust.fields;
  const ownerName = nameOf(owner);
  const verifier = nameOf(verifiedBy);
  // An owner the editor cannot name (someone outside the team it can read) still shows as chosen.
  const ownerOptions =
    owner && !people.some((p) => p.id === owner)
      ? [...people, { id: owner, name: 'Someone Else' }]
      : people;
  const head = healthHeadline(trust, reviewEvery, now);
  const tone = TONE[trust.state];
  // Verify leads where the page needs it (never verified, or due); a fresh page offers it quietly.
  const urgent = trust.state !== 'verified';
  return (
    <section
      aria-label="Page Health"
      data-page-health=""
      className="text-[13px] leading-5 text-slate-700 dark:text-slate-300"
    >
      <h2 className={RAIL_LABEL}>Page Health</h2>
      <div className={`mt-3 rounded-2xl p-4 ring-1 ring-inset ${tone.wash}`}>
        <div data-page-state={trust.state} className="flex items-center gap-3.5">
          <FreshnessRing state={trust.state} left={freshness(trust, reviewEvery, now)} />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1">
              <p className="truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                {head.title}
              </p>
              <HelpArticleLink article="verifying" />
            </div>
            <p className="truncate text-xs text-slate-600 dark:text-slate-400">{head.line}</p>
          </div>
        </div>
        {onVerify ? (
          <Button
            variant={urgent ? 'primary' : 'secondary'}
            size="sm"
            onClick={onVerify}
            className="mt-4 w-full cursor-pointer justify-center gap-1.5 phone:min-h-11"
          >
            <CheckIcon />
            {verifiedAt === undefined ? 'Verify' : 'Verify Again'}
          </Button>
        ) : null}
      </div>
      <dl className="mt-3 flex flex-col divide-y divide-slate-100 dark:divide-slate-800/70">
        <Row icon={<OwnerIcon />} label="Owner">
          {onSetOwner ? (
            <Select
              aria-label="Owner"
              size="md"
              value={owner ?? NO_OWNER}
              onChange={(e) => onSetOwner(e.target.value === NO_OWNER ? null : e.target.value)}
              className="max-w-40 cursor-pointer"
            >
              <option value={NO_OWNER}>Nobody</option>
              {ownerOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          ) : (
            <span className="inline-flex max-w-full items-center gap-2">
              {owner ? <Disc name={ownerName} size="size-5" /> : null}
              <span className="truncate">{ownerName ?? (owner ? 'Someone Else' : 'Nobody')}</span>
            </span>
          )}
        </Row>
        {/* One line (owner 2026-11-21): the date, and the verifier as their disc, named on hover. */}
        <Row icon={<VerifiedRowIcon />} label="Last Verified">
          {verifiedAt === undefined ? (
            'Never'
          ) : (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span data-verified-date="">{shortDate(verifiedAt, now)}</span>
              {verifier ? (
                <Tooltip label={`Verified by ${verifier}`}>
                  <span
                    data-verified-by=""
                    tabIndex={0}
                    role="img"
                    aria-label={`Verified by ${verifier}`}
                    className="inline-flex cursor-default rounded-full focus-visible:outline-2 focus-visible:outline-brand-600"
                  >
                    <Disc name={verifier} size="size-5" />
                  </span>
                </Tooltip>
              ) : null}
            </span>
          )}
        </Row>
        <Row icon={<DueRowIcon />} label="Review Due">
          <span data-review-due="">
            {reviewEvery === 'never'
              ? NO_REVIEW_PERIOD
              : trust.reviewAt === undefined
                ? 'Not Verified'
                : shortDate(trust.reviewAt, now)}
          </span>
        </Row>
        {/* The knowledgebase's Review Period; an Editor changes it from the pencil before the value (owner 2026-11-21). */}
        <Row icon={<PeriodIcon />} label="Review Period" whole={!!periodControl}>
          {periodControl ? (
            // Tight enough that "Every 90 Days" and its pencil keep the label's line in the docked rail, a scrollbar
            // beside it included.
            <span className="flex items-center justify-end gap-1">
              {periodControl}
              <span data-review-period="" className="tracking-tight">
                {reviewPeriodLabel(reviewEvery)}
              </span>
            </span>
          ) : (
            <span data-review-period="">{reviewPeriodLabel(reviewEvery)}</span>
          )}
        </Row>
      </dl>
    </section>
  );
}
