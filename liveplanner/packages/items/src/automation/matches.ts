// Automations: what happened to a card, and whether a rule's trigger hears it (docs/specs/026-plan/automations.md
// "Triggers"; blueprint automations.md "The event"). A landed write becomes at most one event, built from the same
// changes its history entry keeps (item-history.ts historyChangesOf); `triggerMatches` answers a trigger against one.
// The Trash, restoring from it and archiving start nothing. Pure.

import type { Item, ItemPerson } from '../item';
import type { ItemHistoryChange } from '../item-history';
import type { AutomationTrigger, AutomationTriggerKind } from './types';
import type { AutomationRole } from './conditions';

export type AutomationEventKind = 'created' | 'moved' | 'changed' | 'comment' | 'manual' | 'time';

export interface AutomationEvent {
  // `${cardId}:${rev}` for a card write; `c:${commentId}`; `m:${nonce}`; a time trigger's from time-cards.ts: with
  // the rule's id it makes the run's id.
  id: string;
  kind: AutomationEventKind;
  cardId: string;
  // Statuses: where it was and where it went (moved), or where it was made (created).
  from?: string;
  to?: string;
  // The fields the write changed (changed; a moved write can change fields too).
  fields?: string[];
  // The Form tab whose response made the card.
  form?: string;
  by: ItemPerson;
  role: AutomationRole;
  // Set when a rule made the change: that rule, and how many rules the chain has run so far.
  rule?: string;
  chain?: number;
  // A manual run or a time trigger's: the one rule to run.
  ruleId?: string;
  at: number;
}

// The event kinds each trigger hears: the in-memory check a save makes before it builds any event.
export const TRIGGER_EVENT_KINDS: Readonly<
  Record<AutomationTriggerKind, readonly AutomationEventKind[]>
> = {
  card_created: ['created'],
  form_response: ['created'],
  card_moved: ['moved'],
  field_changed: ['changed', 'moved'],
  comment_added: ['comment'],
  manual: ['manual'],
  // Queued by the time scan for its one rule, never by a write.
  scheduled: ['time'],
  due_in: ['time'],
  overdue: ['time'],
};

// Who and why a write was made, as the event carries it.
export type EventSource = Pick<AutomationEvent, 'role' | 'rule' | 'chain' | 'form'>;

// Changes that start nothing: the Trash both ways, and the Archive both ways.
const QUIET = new Set(['trashed', 'untrashed', 'archived', 'unarchived']);

// The event one landed write makes, or null when it starts nothing.
export function eventOfWrite(
  before: Item | null,
  after: Item,
  changes: readonly ItemHistoryChange[],
  source: EventSource,
): AutomationEvent | null {
  if (changes.some((c) => QUIET.has(c.kind))) return null;
  const by = before ? after.updatedBy : after.createdBy;
  const base = {
    id: `${after.id}:${after.rev}`,
    cardId: after.id,
    by,
    role: source.role,
    at: after.updatedAt,
    ...(source.rule !== undefined ? { rule: source.rule, chain: source.chain ?? 0 } : {}),
  };
  if (!before) {
    const status = typeof after.fields['status'] === 'string' ? after.fields['status'] : undefined;
    return {
      ...base,
      kind: 'created',
      ...(status ? { to: status } : {}),
      ...(source.form ? { form: source.form } : {}),
    };
  }
  const fields: string[] = [];
  let moved: { from: string | null; to: string | null } | null = null;
  for (const c of changes) {
    if (c.kind === 'moved') moved = c;
    else if (c.kind === 'set' || c.kind === 'cleared') fields.push(c.field);
    else if (c.kind === 'flagged' || c.kind === 'unflagged') fields.push('flagged');
  }
  if (moved) {
    return {
      ...base,
      kind: 'moved',
      ...(moved.from ? { from: moved.from } : {}),
      ...(moved.to ? { to: moved.to } : {}),
      ...(fields.length ? { fields } : {}),
    };
  }
  return fields.length ? { ...base, kind: 'changed', fields } : null;
}

// Whether `trigger` hears `event`. A manual or time event names its one rule (`ruleId`).
export function triggerMatches(
  trigger: AutomationTrigger,
  event: AutomationEvent,
  ruleId: string,
): boolean {
  switch (trigger.kind) {
    case 'card_created':
      return event.kind === 'created' && (!trigger.status || trigger.status === event.to);
    case 'form_response':
      return (
        event.kind === 'created' &&
        event.form !== undefined &&
        (!trigger.formTab || trigger.formTab === event.form)
      );
    case 'card_moved':
      return (
        event.kind === 'moved' &&
        (!trigger.from?.length || (!!event.from && trigger.from.includes(event.from))) &&
        (!trigger.to?.length || (!!event.to && trigger.to.includes(event.to)))
      );
    case 'field_changed':
      return (
        (event.kind === 'changed' || event.kind === 'moved') &&
        !!event.fields?.some((f) => trigger.fields.includes(f))
      );
    case 'comment_added':
      return event.kind === 'comment';
    case 'manual':
      return event.kind === 'manual' && event.ruleId === ruleId;
    case 'scheduled':
    case 'due_in':
    case 'overdue':
      return event.kind === 'time' && event.ruleId === ruleId;
  }
}
