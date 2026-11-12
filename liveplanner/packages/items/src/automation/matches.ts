// Automations: what happened to a card, and whether a rule's trigger hears it (docs/specs/026-plan/automations.md
// "Triggers"; blueprint automations.md "The event"). A landed write becomes at most one event, built from the same
// changes its history entry keeps (item-history.ts historyChangesOf); `triggerMatches` answers a trigger against one.
// The Trash, restoring from it and archiving start nothing. Pure.

import type { Item, ItemPerson } from '../item';
import type { ItemHistoryChange } from '../item-history';
import type { AutomationTrigger, AutomationTriggerKind } from './types';
import { githubHears, type GithubHeard } from './github-triggers';
import type { WebhookValues } from './webhook-paths';
import type { AutomationRole } from './conditions';

export type AutomationEventKind =
  | 'created'
  | 'moved'
  | 'changed'
  | 'comment'
  | 'manual'
  | 'time'
  // An Incoming Webhook call's, queued only by the hook route, for its one rule.
  | 'incoming'
  // A run held by a Wait going on (automation-waits.ts), for its one rule.
  | 'resume'
  // A card archived, or brought back.
  | 'archived'
  | 'restored'
  // A resolve that left a card with no open thread (the thread routes).
  | 'resolved'
  // A linked pull request's delivery (github-runs.ts), for every rule on a GitHub trigger.
  | 'github';

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
  // An Incoming Webhook call's: the values its body gave that the rule names, and how many cards it named (its
  // card is `cardId`, '' when it named none).
  webhook?: WebhookValues;
  cards?: number;
  // A resume's: the step the rule goes on from, the rule's edit stamp when it waited, the hours it waited and the
  // waiting run's id.
  step?: number;
  edited?: number;
  waited?: number;
  origin?: string;
  // A changed or moved write that ticked a checklist's last item.
  checklistDone?: true;
  // A comment's: the person ids it @mentions.
  mentioned?: string[];
  // A GitHub delivery's: what the pull request did, and its short name (`acme/web#42`).
  github?: GithubHeard;
  pr?: string;
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
  // Queued by the hook route for its one rule, never by a write.
  incoming_webhook: ['incoming'],
  card_archived: ['archived'],
  card_restored: ['restored'],
  checklist_completed: ['changed', 'moved'],
  threads_resolved: ['resolved'],
  mentioned: ['comment'],
  // Worked out at run time from another card's move (derived.ts).
  card_unblocked: ['moved', 'archived'],
  related_done: ['moved'],
  column_limit: ['created', 'moved'],
  stuck: ['time'],
  pull_request_opened: ['github'],
  pull_request_merged: ['github'],
  pull_request_closed: ['github'],
  pull_request_checks: ['github'],
};

// Who and why a write was made, as the event carries it.
export type EventSource = Pick<AutomationEvent, 'role' | 'rule' | 'chain' | 'form'>;

// Changes that start nothing: the Trash both ways. The Archive both ways starts Card Archived and Card Restored alone.
const QUIET = new Set(['trashed', 'untrashed']);

type Row = { done?: unknown };
// Whether a card's checklist holds at least one item, every one ticked.
const checklistDone = (card: Item): boolean => {
  const rows = card.fields['checklist'];
  return (
    Array.isArray(rows) && rows.length > 0 && rows.every((r) => (r as Row | null)?.done === true)
  );
};

// The event one landed write makes, or null when it starts nothing.
export function eventOfWrite(
  before: Item | null,
  after: Item,
  changes: readonly ItemHistoryChange[],
  source: EventSource,
): AutomationEvent | null {
  if (changes.some((c) => QUIET.has(c.kind))) return null;
  const archive = changes.find((c) => c.kind === 'archived' || c.kind === 'unarchived');
  const by = before ? after.updatedBy : after.createdBy;
  const base = {
    id: `${after.id}:${after.rev}`,
    cardId: after.id,
    by,
    role: source.role,
    at: after.updatedAt,
    ...(source.rule !== undefined ? { rule: source.rule, chain: source.chain ?? 0 } : {}),
  };
  if (archive)
    return before ? { ...base, kind: archive.kind === 'archived' ? 'archived' : 'restored' } : null;
  const done =
    before && checklistDone(after) && !checklistDone(before)
      ? { checklistDone: true as const }
      : {};
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
      ...done,
    };
  }
  return fields.length ? { ...base, kind: 'changed', fields, ...done } : null;
}

// Whether `trigger` hears `event`. A manual or time event names its one rule (`ruleId`).
export function triggerMatches(
  trigger: AutomationTrigger,
  event: AutomationEvent,
  ruleId: string,
): boolean {
  // A held run going on answers its own rule alone, whatever its trigger.
  if (event.kind === 'resume') return event.ruleId === ruleId;
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
    case 'incoming_webhook':
      return event.kind === 'incoming' && event.ruleId === ruleId;
    case 'stuck':
      return event.kind === 'time' && event.ruleId === ruleId;
    case 'card_archived':
      return event.kind === 'archived';
    case 'card_restored':
      return event.kind === 'restored';
    case 'checklist_completed':
      return (event.kind === 'changed' || event.kind === 'moved') && event.checklistDone === true;
    case 'threads_resolved':
      return event.kind === 'resolved';
    case 'mentioned':
      return (
        event.kind === 'comment' &&
        !!event.mentioned?.length &&
        (!trigger.people?.length || event.mentioned.some((p) => trigger.people!.includes(p)))
      );
    // Heard here, then worked out against the plan's cards (derived.ts derivedTargets).
    case 'card_unblocked':
      return event.kind === 'moved' || event.kind === 'archived';
    case 'related_done':
      return event.kind === 'moved';
    case 'column_limit':
      return (event.kind === 'created' || event.kind === 'moved') && event.to === trigger.status;
    case 'pull_request_opened':
    case 'pull_request_merged':
    case 'pull_request_closed':
    case 'pull_request_checks':
      return (
        event.kind === 'github' && event.github !== undefined && githubHears(trigger, event.github)
      );
  }
}
