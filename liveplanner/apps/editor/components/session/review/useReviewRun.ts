'use client';

// Running a Sprint Review (docs/specs/026-plan/session-tabs.md "Sprint Review"): who presents each card, the room's
// feedback kept as Review Feedback comments on the real card, and follow-up cards made from it and linked back. The
// presenter and follow-ups are the facilitator's and ride the tab; feedback is anyone's who may comment.
import { useCallback, useState } from 'react';
import {
  cardRefOrKey,
  followUpFieldOf,
  followUpStatus,
  followUpTitle,
  holdsSeveral,
  itemTitle,
  newItemId,
  typeIn,
  type Item,
  type ItemFields,
  type ItemPerson,
} from '@liveplanner/items';
import {
  presenterOf,
  withFollowUp,
  withPresenter,
  type SessionTabState,
} from '@liveplanner/project';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { newCardStatus } from '@/components/plan/new-card-status';
import { useCardThreadsContext } from '@/components/plan/threads/CardThreadsContext';
import { track } from '@/lib/telemetry';
import { FEEDBACK_THREAD_TITLE, feedbackCount, feedbackThreadOf } from './review-feedback';

export type ReviewRun = ReturnType<typeof useReviewRun>;

// What a follow-up is made of: the card it comes from, its title and its type.
export type FollowUpInput = { from: Item; title: string; typeId: string };

export function useReviewRun({
  tabId,
  session,
  plan,
  runs,
  run,
}: {
  tabId: string;
  session: SessionTabState;
  plan: PlanContextValue;
  runs: boolean;
  run: (tabId: string, change: (s: SessionTabState) => SessionTabState) => void;
}) {
  const threads = useCardThreadsContext();
  // The newest feedback this screen added per card: what Follow-up's title starts from.
  const [latest, setLatest] = useState<Readonly<Record<string, string>>>({});

  const presenter = (item: Item): ItemPerson | null => presenterOf(session, item);
  const setPresenter = (itemId: string, who: ItemPerson | null) => {
    if (runs) run(tabId, (s) => withPresenter(s, itemId, who));
  };

  const canFeedback = !!threads?.canComment;
  const feedbackOn = (itemId: string): number =>
    threads ? feedbackCount(threads.threads.threadsOf(itemId)) : 0;

  // Feedback on `itemId`: a reply in its open feedback thread, else a new one; whether it was kept.
  const addFeedback = useCallback(
    async (itemId: string, raw: string): Promise<boolean> => {
      const text = raw.trim();
      if (!threads?.canComment || !text) return false;
      const open = feedbackThreadOf(threads.threads.threadsOf(itemId));
      const out = await threads.threads.act(
        open
          ? { kind: 'reply', threadId: open.id, text, label: 'review' }
          : { kind: 'start', itemId, text, title: FEEDBACK_THREAD_TITLE, label: 'review' },
      );
      if (out === false) {
        debugLog('[session] feedback.failed', { itemId });
        return false;
      }
      setLatest((l) => ({ ...l, [itemId]: text }));
      plan.announce('Feedback added');
      return true;
    },
    [threads, plan],
  );

  // A follow-up of `typeId` made from `from`, in its type's Backlog-like stage at the column's top, linked back
  // through a follow-up Card field when the type has one, else by a line in its description. Answers its id, or null
  // when it could not be made.
  const followUp = async ({ from, title, typeId }: FollowUpInput): Promise<string | null> => {
    const name = followUpTitle(title);
    if (!runs || !name) return null;
    const type = typeIn(plan.types, typeId);
    const field = followUpFieldOf(type, from.type);
    const link: ItemFields = field
      ? { [field.id]: holdsSeveral(field) ? [from.id] : from.id }
      : type.fields.includes('description')
        ? {
            description: `Follow-up from ${cardRefOrKey(from, plan.types)}: ${itemTitle(from)}`,
          }
        : {};
    const id = newItemId();
    const made = await plan.addItem({
      type: typeId,
      fields: { title: name, ...link },
      status: followUpStatus(type, plan.statusNames) ?? newCardStatus(type, plan.statusNames),
      after: null,
      id,
    });
    if (!made) {
      debugLog('[session] follow-up.failed', { typeId });
      plan.notify?.('Couldn’t make that follow-up');
      return null;
    }
    run(tabId, (s) => withFollowUp(s, from.id, id));
    plan.announce(`Follow-up made: ${name}`);
    track('Plan', 'Used', 'SessionFollowUp');
    return id;
  };

  return {
    presenter,
    setPresenter,
    canFeedback,
    feedbackOn,
    addFeedback,
    latestFeedback: (itemId: string) => latest[itemId] ?? '',
    followUp,
    followUpsOf: (itemId: string) => session.followUps?.[itemId] ?? [],
  };
}
