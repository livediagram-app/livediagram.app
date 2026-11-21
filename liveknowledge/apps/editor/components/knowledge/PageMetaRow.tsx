'use client';

// The meta row under a page's title (docs/specs/030-knowledgebase/verification.md "States"): how long it takes to read
// (page-surface.md "Reading time"), the verified state,
// when the review is due, when it was last edited (where that is known) and "Changed since verified". Verifying is
// the right rail's (Page Health), never the page's own. Its height is kept whatever it holds, so nothing in the writing moves when the page's
// health arrives or its state changes, except that a row with nothing in it is not drawn at all.
import type { ReactNode } from 'react';
import { reviewDueText, trustMark, type PageTrust } from '@/lib/knowledge/page-trust';
import { relativeSince } from '@/lib/relative-time';
import { TrustBadge } from './TrustBadge';
import { ClockIcon } from './knowledge-icons';
import { pageWords, readingMinutes } from '@/lib/knowledge/reading-time';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { useKnowledgePeople, usePageKnowledge } from './usePageKnowledge';
import { savedArticleOf } from '@liveknowledge/document';
import { usePageEditors, type PageEditor } from '@/lib/page-edit/page-edit-store';
import { editorsPhrase } from '@/lib/page-edit/page-edit-text';
import { EditorDiscs } from '@/components/page-edit/EditorDiscs';
import { periodPhrase, VerifyPageButton, type VerifyPageButtonProps } from './VerifyPageButton';
import { AddCoverButton } from '@/components/page-cover/AddCoverButton';
import { useCoverEditable, usePageHasCover } from '@/components/page-cover/page-cover-state';
import { AddIconButton } from '@/components/page-icon/AddIconButton';
import { usePageIcon } from '@/components/page-icon/page-icon-state';
import { PageMakersBadges, type PageMakers } from './PageMakersBadges';
import { useCurrentApprovalMeta } from './approval/PageApprovalMeta';

const NO_EDITORS: readonly PageEditor[] = [];

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
  // The others editing the page right now (docs/specs/030-knowledgebase/editing.md "Who is editing"): shown to
  // everyone who is not editing it.
  editors?: readonly PageEditor[];
  // Add Cover after the reading time, for whoever may add one to a page with none (page-surface.md "The cover").
  addCover?: boolean;
  // Add Icon right after Add Cover, for whoever may give a page with none an icon (page-surface.md "The page icon").
  addIcon?: boolean;
  // Who made the page and who changed it last, a person or an agent (verification.md "Made by a person or an
  // agent"), with the names of the people they name.
  makers?: PageMakers;
  nameOf?: (id: string | undefined) => string | undefined;
  // Verify, after Add Cover, for whoever may verify (verification.md "Verify"); it asks before it verifies.
  verify?: VerifyPageButtonProps | undefined;
  // Approval after Verify: its pill, or Request Approval (approval.md "Where it shows").
  approval?: ReactNode;
};

export function PageMetaRowView({
  minutes = 0,
  trust,
  now,
  verifiedBy,
  changedSinceVerified,
  edited,
  editors = [],
  addCover = false,
  addIcon = false,
  makers,
  nameOf = () => undefined,
  verify,
  approval,
}: PageMetaRowProps) {
  const mark = trustMark(trust.state);
  const notes: { key: string; node: ReactNode }[] = [];
  if (minutes > 0)
    notes.push({
      key: 'read',
      node: (
        <span data-reading-time="" className="inline-flex items-center gap-1 tabular-nums">
          <span className="text-slate-400 dark:text-slate-400">
            <ClockIcon />
          </span>
          {minutes} min read
        </span>
      ),
    });
  // Add Cover and Add Icon are one pair, side by side with no dot between: the page's own dressing.
  if (addCover || addIcon)
    notes.push({
      key: 'dress',
      node: (
        <span className="inline-flex items-center gap-3">
          {addCover ? <AddCoverButton /> : null}
          {addIcon ? <AddIconButton /> : null}
        </span>
      ),
    });
  if (verify) notes.push({ key: 'verify', node: <VerifyPageButton {...verify} /> });
  if (approval) notes.push({ key: 'approval', node: approval });
  if (makers && (makers.created || makers.updated))
    notes.push({
      key: 'makers',
      node: <PageMakersBadges makers={makers} nameOf={nameOf} now={now} />,
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
  if (editors.length > 0) {
    const names = editorsPhrase(editors.map((e) => e.name));
    notes.push({
      key: 'editing',
      node: (
        <span data-page-being-edited="" className="inline-flex items-center gap-1.5">
          <EditorDiscs editors={editors} size={16} label={`Editing: ${names}`} />
          Being edited by {names}
        </span>
      ),
    });
  }
  return (
    <div
      data-page-meta=""
      // Nothing to say (a page never verified, no edit known): no row, so the writing sits right under the title.
      className={`${mark || notes.length ? 'flex min-h-7' : 'hidden'} flex-wrap items-center gap-x-[0.8rem] gap-y-1 [clip-path:inset(-1rem_-1rem_-1rem_0)] font-sans text-[13px] font-normal leading-5 tracking-normal text-slate-600 dark:text-slate-400`}
    >
      {mark ? (
        <TrustBadge mark={mark} {...(verifiedBy ? { label: `Verified by ${verifiedBy}` } : {})} />
      ) : null}
      {/* Each note's dot leads it, in the gap before it: a note that wraps to start a line has its dot clipped by the
          row's left edge, so no line ends or starts on a stray dot (owner 2026-11-21). */}
      {notes.map((note, i) => (
        <span key={note.key} data-meta-note="" className="relative">
          {i > 0 ? (
            <span aria-hidden className="absolute -left-[0.4rem] top-0 -translate-x-1/2">
              ·
            </span>
          ) : null}
          {note.node}
        </span>
      ))}
    </div>
  );
}

const makersOf = (h: {
  created?: PageMakers['created'];
  updated?: PageMakers['updated'];
}): PageMakers => ({
  ...(h.created ? { created: h.created } : {}),
  ...(h.updated ? { updated: h.updated } : {}),
});

/** The current page's meta row, from the editor's store. */
export function PageMetaRow() {
  const page = usePageKnowledge();
  const { nameOf } = useKnowledgePeople();
  // Counted from the saved blocks (cached per block list), so it moves when the writing is saved, not per key: a
  // draft is nobody's reading yet (docs/specs/030-knowledgebase/editing.md).
  const minutes = useEditorChrome((s) => {
    const article = savedArticleOf(s.pageTab);
    return article ? readingMinutes(pageWords(article.blocks)) : 0;
  });
  const tabId = useEditorChrome((s) => s.pageTab.id);
  const editingHere = useEditorChrome((s) => s.pageEditing.editing);
  const editors = usePageEditors(tabId);
  // Both hooks run every render: Edit and Save flip whether the cover may change, and a hook skipped by && would
  // change the hook count (React #300).
  const coverEditable = useCoverEditable();
  const hasCover = usePageHasCover();
  const addCover = coverEditable && !hasCover;
  const hasIcon = usePageIcon() !== undefined;
  const addIcon = coverEditable && !hasIcon;
  const health = page.health;
  const approval = useCurrentApprovalMeta();
  return (
    <PageMetaRowView
      minutes={minutes}
      trust={page.trust}
      now={page.now}
      verifiedBy={nameOf(page.trust.fields.verifiedBy)}
      changedSinceVerified={page.health?.knowledge.changedSinceVerified === true}
      editors={editingHere ? NO_EDITORS : editors}
      addCover={addCover}
      addIcon={addIcon}
      {...(health ? { makers: makersOf(health) } : {})}
      nameOf={nameOf}
      approval={approval}
      verify={
        page.rights.verify
          ? {
              again: page.trust.fields.verifiedAt !== undefined,
              period: periodPhrase(page.reviewEvery),
              becomesOwner: !page.trust.fields.owner,
              onVerify: () => page.verify(page.pageId),
            }
          : undefined
      }
    />
  );
}
