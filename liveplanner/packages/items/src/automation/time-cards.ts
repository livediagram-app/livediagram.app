// Automations: the cards a time trigger's moment runs on (docs/specs/026-plan/automations.md "Time triggers";
// blueprint automations.md "Phase 2", "The wake"). At a moment the rule looks over the plan's live cards: a Scheduled
// trigger hears every one, Due In those due the chosen number of days after the moment's day, Overdue those due
// before it and outside every done column, Card Stuck those unchanged for its days, outside done columns (in its
// columns, when named), once per stretch unchanged (`k:` rule, card, last change). The rule's conditions are the filter. The first
// AUTOMATION_TIME_CARDS_MAX by due date (then number) run, each with an event id that makes its run once ever: per
// moment for Scheduled (`t:` rule, day, time, card), per due date for Due In and Overdue (`d:` rule, card, due), so a
// moved due date re-arms them. Pure; the api's wake queues what it answers.

import { isArchived, isTrashed } from '../board';
import type { Item } from '../item';
import { itemStatus } from '../item';
import { dayKey, dayNumber } from '../plan-view-dates';
import { addDays, localDay } from '../repeat-dates';
import { allHold, type ConditionContext } from './conditions';
import type { AutomationTimeTrigger } from './schedule';
import { AUTOMATION_TIME_CARDS_MAX, type AutomationCondition } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TimeCardsContext extends Omit<ConditionContext, 'card' | 'now'> {
  // Whether a status is one of the plan's done columns.
  isDone: (status: string | undefined) => boolean;
}

export interface TimeCard {
  card: Item;
  // The event's id: with the rule's it makes the run's.
  eventId: string;
}

export interface TimeCards {
  cards: TimeCard[];
  // How many cards matched in all (past AUTOMATION_TIME_CARDS_MAX, the rest wait for the next moment).
  matched: number;
}

type Rule = { id: string; trigger: AutomationTimeTrigger; conditions: AutomationCondition[] };

// The cards `rule` runs on at `moment`.
export function timeCards(
  rule: Rule,
  items: readonly Item[],
  moment: number,
  ctx: TimeCardsContext,
): TimeCards {
  const t = rule.trigger;
  const day = localDay(moment, ctx.timeZone);
  const today = dayNumber(day)!;
  const wanted = t.kind === 'due_in' ? dayNumber(addDays(day, t.days))! : null;
  // Card Stuck: unchanged since before this.
  const still = t.kind === 'stuck' ? moment - t.days * DAY_MS : null;
  const hits: { card: Item; due: number | undefined }[] = [];
  for (const card of items) {
    if (isTrashed(card) || isArchived(card)) continue;
    const due = dayNumber(card.fields['due'], ctx.timeZone);
    if (t.kind === 'due_in' && due !== wanted) continue;
    if (t.kind === 'overdue' && (due === undefined || due >= today || ctx.isDone(itemStatus(card))))
      continue;
    if (
      still !== null &&
      (card.updatedAt > still ||
        ctx.isDone(itemStatus(card)) ||
        (t.kind === 'stuck' && t.statuses?.length && !t.statuses.includes(itemStatus(card) ?? '')))
    )
      continue;
    if (!allHold(rule.conditions, { ...ctx, card, now: moment }).ok) continue;
    hits.push({ card, due });
  }
  hits.sort(
    (a, b) =>
      (a.due ?? Number.MAX_SAFE_INTEGER) - (b.due ?? Number.MAX_SAFE_INTEGER) ||
      a.card.key - b.card.key,
  );
  const cards = hits.slice(0, AUTOMATION_TIME_CARDS_MAX).map(({ card, due }) => ({
    card,
    eventId:
      t.kind === 'scheduled'
        ? `t:${rule.id}:${day}:${t.at}:${card.id}`
        : t.kind === 'stuck'
          ? `k:${rule.id}:${card.id}:${card.updatedAt}`
          : `d:${rule.id}:${card.id}:${dayKey(due!)}`,
  }));
  return { cards, matched: hits.length };
}
