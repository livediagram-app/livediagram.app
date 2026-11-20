'use client';

// The Page Health card (docs/specs/030-knowledgebase/verification.md "Page Health"): the page's owner, when it was
// last verified, how often it is reviewed, how many times people and agents read it this week, and Verify Again.
// An Editor changes the owner and the interval in place; everyone else reads them. Every row keeps its height
// while the reads load, so the card never grows under the pointer.
import type { ReactNode } from 'react';
import type { KnowledgeReviewEvery } from '@liveknowledge/api-schema';
import { Button, Select } from '@liveknowledge/ui';
import {
  REVIEW_OPTIONS,
  reviewEveryOf,
  shortDate,
  type PageTrust,
} from '@/lib/knowledge/page-trust';
import type { KnowledgePerson } from './usePageKnowledge';

const NO_OWNER = '';

export type PageHealthCardProps = {
  trust: PageTrust;
  now: number;
  // The week's reads; absent until Page Health is read (and for a knowledgebase kept Offline).
  reads: { people: number; agents: number } | undefined;
  people: readonly KnowledgePerson[];
  nameOf: (id: string | undefined) => string | undefined;
  // Absent for anyone who may not change the fields: the rows read as text.
  onSetOwner: ((owner: string | null) => void) | undefined;
  onSetReviewEvery: ((every: KnowledgeReviewEvery) => void) | undefined;
  onVerify: (() => void) | undefined;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3">
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-slate-900 dark:text-slate-100">
        {children}
      </dd>
    </div>
  );
}

export function PageHealthCard({
  trust,
  now,
  reads,
  people,
  nameOf,
  onSetOwner,
  onSetReviewEvery,
  onVerify,
}: PageHealthCardProps) {
  const { owner, verifiedAt, verifiedBy, reviewEvery } = trust.fields;
  const every = reviewEvery ?? 90;
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
        <Row label="Last Verified">
          {verifiedAt === undefined
            ? 'Never'
            : `${shortDate(verifiedAt, now)}${verifier ? ` by ${verifier}` : ''}`}
        </Row>
        <Row label="Review">
          {onSetReviewEvery ? (
            <Select
              aria-label="Review Interval"
              size="md"
              value={String(every)}
              onChange={(e) => {
                const next = reviewEveryOf(e.target.value);
                if (next !== undefined) onSetReviewEvery(next);
              }}
              className="cursor-pointer"
            >
              {REVIEW_OPTIONS.map((option) => (
                <option key={option.value} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </Select>
          ) : (
            REVIEW_OPTIONS.find((option) => option.value === every)?.label
          )}
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
