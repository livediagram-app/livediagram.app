'use client';

// Sprint Review's parts on a Session tab's page (docs/specs/026-plan/session-tabs.md "Sprint Review"), composed here so
// SessionPage draws each in its place only for a review: the demo strip over the card, the feedback strip above the
// action bar, the Follow-up button and its dialog, the presenter disc on each row, a decided card's follow-up count
// and Session Complete's feedback and follow-ups.
import { useMemo, useState, type ReactNode } from 'react';
import { lucideSquarePlus } from '@liveworkspace/icons/lucide';
import { cardRefOrKey, typeIn, type Item } from '@liveplanner/items';
import { Tooltip, lucideGlyph } from '@liveplanner/ui';
import type { SessionTabState } from '@liveplanner/project';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { PersonDisc } from '@/components/plan/PersonDisc';
import { useCardThreadsContext } from '@/components/plan/threads/CardThreadsContext';
import { FOLLOW_UP_KEY } from '../session-kinds';
import { DemoStrip } from './DemoStrip';
import { FeedbackStrip } from './FeedbackStrip';
import { FollowUpDialog } from './FollowUpDialog';
import { ReviewSummary } from './ReviewSummary';
import { feedbackSummary } from './review-feedback';
import { useReviewRun } from './useReviewRun';

const FollowUpIcon = lucideGlyph(lucideSquarePlus, 15);

// The action bar's look for a secondary action, a square icon button on a phone (SessionActionBar's `compact`).
const BUTTON =
  'inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 max-sm:w-10 max-sm:justify-center max-sm:px-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';

export type ReviewParts = ReturnType<typeof useReviewParts>;

export function useReviewParts({
  on,
  tabId,
  session,
  plan,
  runs,
  run,
  shown,
  peeking,
  list,
  onOpen,
}: {
  // The session is a Sprint Review: otherwise every part is absent.
  on: boolean;
  tabId: string;
  session: SessionTabState;
  plan: PlanContextValue;
  runs: boolean;
  run: (tabId: string, change: (s: SessionTabState) => SessionTabState) => void;
  shown: Item | null;
  peeking: boolean;
  list: readonly Item[];
  onOpen: (itemId: string) => void;
}) {
  const review = useReviewRun({ tabId, session, plan, runs, run });
  const threads = useCardThreadsContext();
  // The card the Follow-up dialog is open for, or none.
  const [followingId, setFollowingId] = useState<string | null>(null);
  const presenterOn = session.setup.presenter !== 'none';
  const decided = shown ? session.decided?.[shown.id] : undefined;
  const threadsOf = threads?.threads.threadsOf;
  const summary = useMemo(
    () =>
      on && threadsOf
        ? feedbackSummary(
            list.map((i) => i.id),
            threadsOf,
          )
        : { comments: 0, cards: 0 },
    [on, list, threadsOf],
  );
  if (!on) return null;
  const openFollowUp = () => {
    if (runs && shown && !peeking && !decided) setFollowingId(shown.id);
  };
  const following = shown && followingId === shown.id ? shown : null;
  const ref = shown ? cardRefOrKey(shown, plan.types) : '';
  return {
    following: !!following,
    openFollowUp,
    keys: { [FOLLOW_UP_KEY]: openFollowUp } as Record<string, () => void>,
    demo: shown ? (
      <DemoStrip
        item={shown}
        type={typeIn(plan.types, shown.type)}
        presenter={review.presenter(shown)}
        presenterOn={presenterOn}
        canPick={runs && !peeking}
        people={plan.people}
        scope={plan.itemsScope}
        onPresenter={(who) => review.setPresenter(shown.id, who)}
      />
    ) : null,
    feedback: shown ? (
      <FeedbackStrip
        key={shown.id}
        cardRef={ref}
        count={review.feedbackOn(shown.id)}
        canAdd={review.canFeedback}
        onAdd={(text) => review.addFeedback(shown.id, text)}
      />
    ) : null,
    extra: (
      <Tooltip label={`Follow-up (${FOLLOW_UP_KEY.toUpperCase()})`}>
        <button
          type="button"
          className={BUTTON}
          onClick={openFollowUp}
          aria-keyshortcuts={FOLLOW_UP_KEY.toUpperCase()}
          aria-haspopup="dialog"
        >
          <FollowUpIcon aria-hidden />
          <span className="max-sm:sr-only">Follow-up</span>
        </button>
      </Tooltip>
    ) as ReactNode,
    dialog: following ? (
      <FollowUpDialog
        key={following.id}
        item={following}
        items={plan.items}
        types={plan.types}
        statusNames={plan.statusNames}
        initialTitle={review.latestFeedback(following.id)}
        onCancel={() => setFollowingId(null)}
        onCreate={(input) => {
          setFollowingId(null);
          void review.followUp({ from: following, ...input });
        }}
      />
    ) : null,
    // A row's presenter disc, when the set-up shows one and the card has one.
    aside: (item: Item) => {
      const who = presenterOn ? review.presenter(item) : null;
      return who ? (
        <span className="shrink-0" data-presenter={who.id}>
          <PersonDisc person={who} label={`Presented by ${who.name}`} />
        </span>
      ) : null;
    },
    // A decided card's follow-ups, after its outcome: "1 follow-up".
    note: (itemId: string) => {
      const n = review.followUpsOf(itemId).length;
      return n ? `${n} ${n === 1 ? 'follow-up' : 'follow-ups'}` : null;
    },
    summary: (
      <ReviewSummary
        feedback={summary}
        followUps={list.map((i) => ({ from: i.id, ids: review.followUpsOf(i.id) }))}
        items={plan.items}
        types={plan.types}
        onOpen={onOpen}
      />
    ),
  };
}
