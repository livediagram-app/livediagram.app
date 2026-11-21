// livehuddle's own triggers (docs/specs/013-workspace/automations.md "Triggers of its own"; blueprint automations.md
// "Kinds"): Someone Arrived, Everyone Left and Suggestion Dropped, each one definition beside the ones every app has
// (@liveworkspace/automations/item). The room queues their events (apps/api document-room/room-attendance.ts and
// routes/suggestion-routes.ts); what each event carries is named here so the two never drift. The space a visit
// trigger reads is a tab, as Tab Attendance counts it. Pure.

import { id, refuse, whole, type Obj } from '@liveworkspace/automations';
import {
  defineEventTrigger,
  defineTrigger,
  eventTabName,
  eventWho,
  quietWords,
  refName,
  type ItemEvent,
  type ItemNames,
  type ItemPart,
  type TriggerKind,
} from '@liveworkspace/automations/item';

// The event kinds the room queues. `tab_filled` and `tab_emptied` are Everyone Left's two edges: the first calls a
// quiet stretch off, the second starts (or pushes back) one. Neither is ever on the queue itself.
export const SOMEONE_ARRIVED_EVENT = 'someone_arrived';
export const TAB_FILLED_EVENT = 'tab_filled';
export const TAB_EMPTIED_EVENT = 'tab_emptied';
export const SUGGESTION_DROPPED_EVENT = 'suggestion_dropped';
export const EVERYONE_LEFT_TRIGGER = 'everyone_left';

// The keys of what each event carries (an event's `data`).
export const VISIT_EMPTY_DATA = 'visit.empty';
export const VISIT_PEOPLE_DATA = 'visit.people';
export const VISIT_COUNT_DATA = 'visit.count';
export const VISIT_MINUTES_DATA = 'visit.minutes';
export const SUGGESTION_DATA = 'suggestion';

// Everyone Left's quiet window: a minute to twelve hours.
export const EVERYONE_LEFT_MINUTES_MIN = 1;
export const EVERYONE_LEFT_MINUTES_MAX = 720;
// The names `{{visit.people}}` reads, at most; `{{visit.count}}` counts everyone.
export const VISIT_PEOPLE_MAX = 20;

export type SomeoneArrivedTrigger = {
  kind: typeof SOMEONE_ARRIVED_EVENT;
  tab?: string;
  empty: boolean;
};
export type EveryoneLeftTrigger = {
  kind: typeof EVERYONE_LEFT_TRIGGER;
  minutes: number;
  tab?: string;
};

const tabOf = (value: Obj, path: string): { tab?: string } =>
  value['tab'] === undefined ? {} : { tab: id(value['tab'], `${path}.tab`) };

const onTab = (tab: string | undefined, event: ItemEvent): boolean => !tab || tab === event.tab;

const tabWords = (tab: string | undefined, names: ItemNames) =>
  tab ? [{ word: 'on' }, { chip: refName(names, 'tab', tab) }] : [];

// A person comes into a tab. With `empty` on (the default), only the first one into a tab nobody was in.
const someoneArrived = defineTrigger<SomeoneArrivedTrigger & ItemPart>({
  kind: SOMEONE_ARRIVED_EVENT,
  name: 'Someone Arrived',
  group: 'Space',
  line: 'a person comes into a tab, as the Attendance list counts them',
  format:
    '{"kind":"someone_arrived","tab"?:tab,"empty"?:true|false} (a person comes into a tab, or any tab; with ' +
    '"empty" true, the default, only the first one into a tab nobody was in; a reconnect within two minutes ' +
    'carries their visit on and starts nothing; {{person}} is who arrived)',
  hears: [SOMEONE_ARRIVED_EVENT],
  tabbed: true,
  read: (value, path) => {
    const empty = value['empty'];
    if (empty !== undefined && typeof empty !== 'boolean')
      refuse(`${path}.empty`, `${path}.empty must be true or false`);
    return { kind: SOMEONE_ARRIVED_EVENT, ...tabOf(value, path), empty: empty !== false };
  },
  defaults: () => ({ kind: SOMEONE_ARRIVED_EVENT, empty: true }),
  matches: (trigger, event) =>
    onTab(trigger.tab, event) &&
    (trigger.empty === false || event.data?.[VISIT_EMPTY_DATA] === true),
  words: (trigger, names) => [
    { chip: 'Someone Arrived', trigger: true },
    ...tabWords(trigger.tab, names),
    ...(trigger.empty === false ? [] : [{ word: 'when it was empty' }]),
  ],
  said: (_trigger, event, names) => `${eventWho(event)} arrived in ${eventTabName(event, names)}`,
});

// The last person leaves a tab and it stays empty for the rule's window: the engine's settle, on the room's alarm.
const everyoneLeft = defineTrigger<EveryoneLeftTrigger & ItemPart>({
  kind: EVERYONE_LEFT_TRIGGER,
  name: 'Everyone Left',
  group: 'Space',
  line: 'the last person leaves a tab and it stays empty for a while',
  format:
    `{"kind":"everyone_left","minutes":${EVERYONE_LEFT_MINUTES_MIN} to ${EVERYONE_LEFT_MINUTES_MAX},"tab"?:tab} ` +
    '(the last person leaves a tab, or any tab, and nobody comes back for that long; once per emptying; who was ' +
    'there reads as {{visit.people}}, how many as {{visit.count}}, how long as {{visit.minutes}})',
  hears: [],
  tabbed: true,
  personless: true,
  read: (value, path) => ({
    kind: EVERYONE_LEFT_TRIGGER,
    minutes: whole(
      value['minutes'],
      `${path}.minutes`,
      EVERYONE_LEFT_MINUTES_MIN,
      EVERYONE_LEFT_MINUTES_MAX,
    ),
    ...tabOf(value, path),
  }),
  defaults: () => ({ kind: EVERYONE_LEFT_TRIGGER, minutes: 10 }),
  matches: (trigger, event) => onTab(trigger.tab, event),
  words: (trigger, names) => [
    { chip: `Everyone Left for ${quietWords(trigger.minutes)}`, trigger: true },
    ...tabWords(trigger.tab, names),
  ],
  said: (_trigger, event, names) => `Everyone left ${eventTabName(event, names)}`,
  settle: {
    after: [TAB_EMPTIED_EVENT],
    cancel: [TAB_FILLED_EVENT],
    quietMs: (trigger) => trigger.minutes * 60_000,
    // Each tab empties on its own, whatever the rule picks.
    key: (event) => event.tab ?? '',
  },
});

// A note is anonymous to a rule as it is in the box: nobody is behind it.
const suggestionDropped = defineEventTrigger({
  kind: SUGGESTION_DROPPED_EVENT,
  name: 'Suggestion Dropped',
  group: 'Space',
  line: 'someone drops a note in a Suggestion Box',
  note:
    'someone drops a note in a Suggestion Box; its text reads as {{suggestion}}; notes are anonymous, so nobody ' +
    'is behind it',
  personless: true,
  said: (_who, tab) => `A suggestion was dropped in ${tab}`,
});

/** livehuddle's own triggers, in the picker's order. */
export const SPACE_TRIGGERS: readonly TriggerKind[] = [
  someoneArrived,
  everyoneLeft,
  suggestionDropped,
];
