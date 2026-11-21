// The triggers every app has (liveworkspace/docs/specs/018-automations/automations.md "Triggers every app has";
// blueprint item-engine.md "The shared kinds"), each one definition. Pure.

import { DAY_MS } from '../dates';
import { clockWords } from '../schedule';
import type { AutomationScheduled } from '../types';
import { clock, id, whole, type Obj } from '../validate-read';
import { readScheduled } from '../validate-scheduled';
import { defineTrigger, type TriggerKind } from './kinds';
import { refName, type ItemNames } from './names';
import {
  EDITED_MINUTES_MAX,
  EDITED_MINUTES_MIN,
  ITEM_EDIT_EVENT,
  NOT_EDITED_DAYS_MAX,
  type ItemEdited,
  type ItemEvent,
  type ItemNotEdited,
  type ItemPart,
  type ItemTabTrigger,
} from './types';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** A weekday by its number, 0 Sunday to 6 Saturday. */
export const weekdayName = (day: number): string => WEEKDAYS[day]!;

/** A Scheduled trigger as its chip reads: "Every Weekday at 9:00", "Weekly on Monday, Friday at 17:00". */
export function scheduledWords(t: AutomationScheduled): string {
  const at = `at ${clockWords(t.at)}`;
  if (t.every === 'week') return `Weekly on ${t.days!.map(weekdayName).join(', ')} ${at}`;
  if (t.every === 'month') return `Monthly on Day ${t.dayOfMonth!} ${at}`;
  return `Every ${t.every === 'day' ? 'Day' : 'Weekday'} ${at}`;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** A quiet stretch as words: "30 Minutes", "2 Hours", "1 Hour 30 Minutes". */
export function quietWords(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return plural(rest, 'Minute');
  return rest ? `${plural(hours, 'Hour')} ${plural(rest, 'Minute')}` : plural(hours, 'Hour');
}

/** Whoever is behind an event, by name. */
export const eventWho = (event: ItemEvent): string => event.by?.name ?? 'Someone';

/** The event's tab by name: the item's own name for it, else the name the event kept (a tab since removed). */
export function eventTabName(event: ItemEvent, names: ItemNames): string {
  const kept = event.data?.['tab.name'];
  const held = event.tab ? names.tabs?.get(event.tab) : undefined;
  return held ?? (typeof kept === 'string' && kept ? kept : 'a tab');
}

const tabOf = (value: Obj, path: string): { tab?: string } =>
  value['tab'] === undefined ? {} : { tab: id(value['tab'], `${path}.tab`) };

const onTab = (tab: string | undefined, event: ItemEvent): boolean => !tab || tab === event.tab;

/** A trigger that one kind of event starts, with an optional tab to keep it to: the shape of most triggers, the
 *  shared ones and an app's own. `note`: what its format says in place of its line; `personless`: nobody is behind
 *  its events. */
export function defineEventTrigger(o: {
  kind: string;
  name: string;
  line: string;
  note?: string;
  group?: string;
  picksTab?: true;
  tabbed?: true;
  collab?: true;
  personless?: true;
  said: (who: string, tab: string) => string;
}): TriggerKind {
  return defineTrigger<ItemTabTrigger & ItemPart>({
    kind: o.kind,
    name: o.name,
    group: o.group ?? 'Changes',
    line: o.line,
    format: `{"kind":"${o.kind}"${o.picksTab ? ',"tab"?:tab' : ''}} (${o.note ?? o.line})`,
    hears: [o.kind],
    ...(o.tabbed ? { tabbed: true as const } : {}),
    ...(o.collab ? { collab: true as const } : {}),
    ...(o.personless ? { personless: true as const } : {}),
    read: (value, path) => ({ kind: o.kind, ...(o.picksTab ? tabOf(value, path) : {}) }),
    defaults: () => ({ kind: o.kind }),
    matches: (trigger, event) => onTab(trigger.tab, event),
    words: (trigger, names) => [
      { chip: o.name, trigger: true },
      ...(trigger.tab ? [{ word: 'on' }, { chip: refName(names, 'tab', trigger.tab) }] : []),
    ],
    said: (_trigger, event, names) => o.said(eventWho(event), eventTabName(event, names)),
  });
}

const eventTrigger = defineEventTrigger;

// Agent Made Changes (liveworkspace/docs/specs/018-automations/automations.md "What each app adds"): an agent,
// through an API token, changed a tab. Every app with agent changesets has it, each saying in its own words what an
// agent changes there; the room queues it once per write a token made (room/app/host.ts queueAgentChanged).
export const AGENT_CHANGED_EVENT = 'agent_changed';

/** Agent Made Changes, in the app's own words: `line` for the picker, `note` for its format. */
export const agentChangedTrigger = (words: { line: string; note: string }): TriggerKind =>
  defineEventTrigger({
    kind: AGENT_CHANGED_EVENT,
    name: 'Agent Made Changes',
    line: words.line,
    note: words.note,
    picksTab: true,
    tabbed: true,
    said: (who, tab) => `${who} changed ${tab}`,
  });

const scheduled = defineTrigger<AutomationScheduled & ItemPart>({
  kind: 'scheduled',
  name: 'Scheduled',
  group: 'Time',
  line: 'a time comes round: every day, every weekday, weekly or monthly',
  format:
    '{"kind":"scheduled","every":"day"|"weekday"|"week"|"month","days"?:[0 Sunday to 6 Saturday, for week],' +
    '"dayOfMonth"?:1 to 31 (for month; past the month’s end is its last day),"at":"HH:MM" on the quarter hour}',
  hears: [],
  time: true,
  personless: true,
  read: (value) => readScheduled(value),
  defaults: () => ({ kind: 'scheduled', every: 'weekday', at: '09:00' }),
  matches: () => false,
  words: (trigger) => [{ chip: scheduledWords(trigger), trigger: true }],
  said: (trigger) => `Automation · ${scheduledWords(trigger)}`,
});

const manual = defineTrigger({
  kind: 'manual',
  name: 'Run by Hand',
  group: 'Other',
  line: 'an Editor picks Run Rule on the rule',
  format: '{"kind":"manual"} (Run by Hand: run it with Run Rule)',
  hears: [],
  read: () => ({ kind: 'manual' }),
  defaults: () => ({ kind: 'manual' }),
  matches: () => false,
  words: () => [{ chip: 'Run by Hand', trigger: true }],
  said: (_trigger, event) => `${eventWho(event)} ran the rule`,
});

const incoming = defineTrigger({
  kind: 'incoming_webhook',
  name: 'Incoming Webhook',
  group: 'Other',
  line: 'another tool sends the rule’s own address a signed JSON call',
  format:
    '{"kind":"incoming_webhook"} (another tool calls the rule’s own address with its secret, made once the rule ' +
    'is saved; its JSON body’s values read as {{webhook.<name>}}, up to 5 names deep, and "tab" in the body ' +
    'names a tab)',
  hears: [],
  personless: true,
  read: () => ({ kind: 'incoming_webhook' }),
  defaults: () => ({ kind: 'incoming_webhook' }),
  matches: () => false,
  words: () => [{ chip: 'Incoming Webhook', trigger: true }],
  said: () => 'An Incoming Webhook call',
});

const edited = defineTrigger<ItemEdited & ItemPart>({
  kind: 'edited',
  name: 'Edited, Then Quiet',
  group: 'Changes',
  line: 'the content changed and then nothing changed for a while',
  format:
    `{"kind":"edited","minutes":${EDITED_MINUTES_MIN} to ${EDITED_MINUTES_MAX},"tab"?:tab} (the content changed, ` +
    'then nothing changed for that long; once per burst of edits, never for a rule’s own changes)',
  hears: [],
  tabbed: true,
  read: (value, path) => ({
    kind: 'edited',
    minutes: whole(value['minutes'], `${path}.minutes`, EDITED_MINUTES_MIN, EDITED_MINUTES_MAX),
    ...tabOf(value, path),
  }),
  defaults: () => ({ kind: 'edited', minutes: 30 }),
  matches: (trigger, event) => onTab(trigger.tab, event),
  words: (trigger, names) => [
    { chip: `Edited, Then Quiet for ${quietWords(trigger.minutes)}`, trigger: true },
    ...(trigger.tab ? [{ word: 'on' }, { chip: refName(names, 'tab', trigger.tab) }] : []),
  ],
  said: (trigger) => `Edited, then quiet for ${quietWords(trigger.minutes).toLowerCase()}`,
  settle: {
    after: [ITEM_EDIT_EVENT],
    quietMs: (trigger) => trigger.minutes * 60_000,
    // A rule kept to one tab settles on that tab; any other on the whole item.
    key: (event, trigger) => (trigger.tab ? (event.tab ?? '') : ''),
  },
});

const notEdited = defineTrigger<ItemNotEdited & ItemPart>({
  kind: 'not_edited',
  name: 'Not Edited For',
  group: 'Time',
  line: 'nothing has changed for a number of days, checked daily at a time',
  format:
    `{"kind":"not_edited","days":1 to ${NOT_EDITED_DAYS_MAX},"at":"HH:MM" on the quarter hour} (nothing changed ` +
    'for that many days; once each time it goes that long untouched)',
  // Heard so the edits are stamped; no event of it is ever queued.
  hears: [ITEM_EDIT_EVENT],
  time: true,
  personless: true,
  read: (value, path) => ({
    kind: 'not_edited',
    days: whole(value['days'], `${path}.days`, 1, NOT_EDITED_DAYS_MAX),
    at: clock(value['at'], `${path}.at`),
  }),
  defaults: () => ({ kind: 'not_edited', days: 30, at: '09:00' }),
  matches: () => false,
  words: (trigger) => [{ chip: `Not Edited For ${plural(trigger.days, 'Day')}`, trigger: true }],
  said: (trigger) => `Automation · Not edited for ${plural(trigger.days, 'day')}`,
  // Once per stretch untouched: the stretch is named by the edit it began at.
  due: (trigger, at) =>
    at.moment - at.editedAt >= trigger.days * DAY_MS ? String(at.editedAt) : null,
});

/** The triggers every app has; with `collab`, the comment and action ones too. */
export function sharedTriggers(collab: boolean): TriggerKind[] {
  const all = [
    scheduled,
    manual,
    incoming,
    eventTrigger({
      kind: 'tab_added',
      name: 'Tab Added',
      line: 'a tab is added',
      tabbed: true,
      said: (who, tab) => `${who} added ${tab}`,
    }),
    eventTrigger({
      kind: 'tab_removed',
      name: 'Tab Removed',
      line: 'a tab is removed',
      tabbed: true,
      said: (who, tab) => `${who} removed ${tab}`,
    }),
    edited,
    notEdited,
    eventTrigger({
      kind: 'snapshot_taken',
      name: 'Snapshot Taken',
      line: 'someone takes a snapshot by hand',
      said: (who) => `${who} took a snapshot`,
    }),
    eventTrigger({
      kind: 'joined',
      name: 'Someone Joined',
      group: 'People',
      line: 'a person opens it through a share link for the first time',
      said: (who) => `${who} joined`,
    }),
    eventTrigger({
      kind: 'access_requested',
      name: 'Access Requested',
      group: 'People',
      line: 'someone asks for access',
      said: (who) => `${who} asked for access`,
    }),
    eventTrigger({
      kind: 'comment_added',
      name: 'Comment Added',
      group: 'Comments',
      line: 'someone starts a thread or replies on one',
      picksTab: true,
      tabbed: true,
      collab: true,
      said: (who, tab) => `${who} commented on ${tab}`,
    }),
    eventTrigger({
      kind: 'thread_resolved',
      name: 'Thread Resolved',
      group: 'Comments',
      line: 'a thread is resolved',
      picksTab: true,
      tabbed: true,
      collab: true,
      said: (who, tab) => `${who} resolved a thread on ${tab}`,
    }),
    eventTrigger({
      kind: 'threads_resolved',
      name: 'All Threads Resolved',
      group: 'Comments',
      line: 'the last open thread on a tab is resolved',
      picksTab: true,
      tabbed: true,
      collab: true,
      said: (_who, tab) => `Every thread on ${tab} is resolved`,
    }),
    eventTrigger({
      kind: 'action_assigned',
      name: 'Action Assigned',
      group: 'Comments',
      line: 'an action gets a new assignee',
      tabbed: true,
      collab: true,
      said: (who) => `${who} assigned an action`,
    }),
    eventTrigger({
      kind: 'action_done',
      name: 'Action Done',
      group: 'Comments',
      line: 'an action is turned done',
      tabbed: true,
      collab: true,
      said: (who) => `${who} finished an action`,
    }),
  ];
  return all.filter((t) => collab || !t.collab);
}
