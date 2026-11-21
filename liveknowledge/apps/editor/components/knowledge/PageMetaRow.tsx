'use client';

// The meta row under a page's title (docs/specs/030-knowledgebase/verification.md "States"): how long it takes to read
// (page-surface.md "Reading time"), the verified state,
// when the review is due, when it was last edited (where that is known) and "Changed since verified". Verifying is
// the right rail's (Page Health), never the page's own. Its height is kept whatever it holds, so nothing in the writing moves when the page's
// health arrives or its state changes, except that a row with nothing in it is not drawn at all.
import { Fragment, type ReactNode } from 'react';
import { reviewDueText, trustMark, type PageTrust } from '@/lib/knowledge/page-trust';
import { relativeSince } from '@/lib/relative-time';
import { TrustBadge } from './TrustBadge';
import { ClockIcon } from './knowledge-icons';
import { pageWords, readingMinutes } from '@/lib/knowledge/reading-time';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { useKnowledgePeople, usePageKnowledge } from './usePageKnowledge';

export type PageMetaRowProps = {
  /** Whole minutes the page takes to read (reading-time.ts); 0 for an empty page, which shows none. */
  minutes?: number;
  trust: PageTrust;
  now: number;
  // The verifier's name, where the editor knows it.
  verifiedBy: string | undefined;
  changedSinceVerified: boolean;
  // When the writing was last edited and by whom, where a route says so.
  edited?: { at: number; by?: string } | undefined;
};

export function PageMetaRowView({
  minutes = 0,
  trust,
  now,
  verifiedBy,
  changedSinceVerified,
  edited,
}: PageMetaRowProps) {
  const mark = trustMark(trust.state);
  const notes: { key: string; node: ReactNode }[] = [];
  if (minutes > 0)
    notes.push({
      key: 'read',
      node: (
        <span data-reading-time="" className="inline-flex items-center gap-1 tabular-nums">
          <span className="text-slate-400 dark:text-slate-500">
            <ClockIcon />
          </span>
          {minutes} min read
        </span>
      ),
    });
  if (trust.reviewAt !== undefined)
    notes.push({ key: 'review', node: reviewDueText(trust.reviewAt, now) });
  if (edited)
    notes.push({
      key: 'edited',
      node: `Edited ${relativeSince(edited.at, now)}${edited.by ? ` by ${edited.by}` : ''}`,
    });
  if (mark && changedSinceVerified)
    notes.push({
      key: 'changed',
      node: <span className="text-amber-800 dark:text-amber-300">Changed since verified</span>,
    });
  return (
    <div
      data-page-meta=""
      // Nothing to say (a page never verified, no edit known): no row, so the writing sits right under the title.
      className={`${mark || notes.length ? 'flex min-h-7' : 'hidden'} flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[13px] font-normal leading-5 tracking-normal text-slate-600 dark:text-slate-400`}
    >
      {mark ? (
        <TrustBadge mark={mark} {...(verifiedBy ? { label: `Verified by ${verifiedBy}` } : {})} />
      ) : null}
      {notes.map((note, i) => (
        <Fragment key={note.key}>
          {i > 0 ? <span aria-hidden>·</span> : null}
          <span>{note.node}</span>
        </Fragment>
      ))}
    </div>
  );
}

/** The current page's meta row, from the editor's store. */
export function PageMetaRow() {
  const page = usePageKnowledge();
  const { nameOf } = useKnowledgePeople();
  // Counted from the committed blocks (cached per block list), so it moves when the writing commits, not per key.
  const minutes = useEditorChrome((s) => {
    const article = Object.values(s.activeTab.articles ?? {})[0];
    return article ? readingMinutes(pageWords(article.blocks)) : 0;
  });
  return (
    <PageMetaRowView
      minutes={minutes}
      trust={page.trust}
      now={page.now}
      verifiedBy={nameOf(page.trust.fields.verifiedBy)}
      changedSinceVerified={page.health?.knowledge.changedSinceVerified === true}
    />
  );
}
