// The conditions every app has (liveworkspace/docs/specs/018-automations/automations.md "Conditions every app has";
// blueprint item-engine.md "The shared kinds"): Tab, Who Did It, Day of Week and Text. Pure.

import { inTabWords } from './tab-word';
import { localDay, weekdayOf } from '../dates';
import {
  AUTOMATION_LIST_MAX,
  Refused,
  ids,
  not,
  obj,
  refuse,
  text,
  whole,
  id,
} from '../validate-read';
import { sentenceOrList } from '../words';
import { defineCondition, type ConditionKind } from './kinds';
import { refName } from './names';
import { weekdayName } from './triggers';
import type {
  ItemPart,
  ItemTabCondition,
  ItemTextCondition,
  ItemWeekdayCondition,
  ItemWho,
  ItemWhoCondition,
  ItemWhoRole,
} from './types';

// The longest text a Text condition looks for.
export const TEXT_CONDITION_MAX = 200;

const ROLE_WORDS: Readonly<Record<ItemWhoRole, string>> = {
  editor: 'an Editor',
  participant: 'a Participant',
  agent: 'an agent',
};
const ROLES: ReadonlySet<string> = new Set(Object.keys(ROLE_WORDS));

const isOrNot = (negated: true | undefined) => (negated ? 'is not' : 'is');

const tab = defineCondition<ItemTabCondition & ItemPart>({
  kind: 'tab',
  name: 'Tab',
  group: 'Conditions',
  line: 'the run’s tab is, or is not, one of the chosen tabs',
  format: '{"kind":"tab","tabs":[tabs, at least one],"not"?:true} (the run’s tab is one of them)',
  read: (value, path) => ({
    kind: 'tab',
    tabs: ids(value['tabs'], `${path}.tabs`, { min: 1 }),
    ...not(value['not'], `${path}.not`),
  }),
  defaults: () => ({ kind: 'tab', tabs: [] }),
  words: (c, names) => [
    { word: `${inTabWords('tab', names.itemWord)} ${isOrNot(c.not)}` },
    { chip: sentenceOrList(c.tabs.map((t) => refName(names, 'tab', t))) },
  ],
  holds: (c, ctx) => {
    const among = ctx.event.tab !== undefined && c.tabs.includes(ctx.event.tab);
    const named = sentenceOrList(c.tabs.map((t) => refName(ctx.names, 'tab', t)));
    return {
      ok: c.not ? !among : among,
      text: `${inTabWords('Tab', ctx.names.itemWord)} ${isOrNot(c.not)} ${named}`,
    };
  },
});

function readWho(value: unknown, path: string): ItemWho {
  const o = obj(value, path);
  if (o['person'] !== undefined) return { person: id(o['person'], `${path}.person`) };
  const role = o['role'];
  if (typeof role !== 'string' || !ROLES.has(role))
    refuse(path, `${path} must be a person, or a role of editor, participant or agent`);
  return { role: role as ItemWhoRole };
}

const whoWords = (who: readonly ItemWho[], name: (person: string) => string): string =>
  sentenceOrList(who.map((w) => ('person' in w ? name(w.person) : ROLE_WORDS[w.role])));

const who = defineCondition<ItemWhoCondition & ItemPart>({
  kind: 'who',
  name: 'Who Did It',
  group: 'Conditions',
  line: 'whoever started the rule is, or is not, a chosen person or role',
  format:
    '{"kind":"who","who":[{"person":person} or {"role":"editor"|"participant"|"agent"}],"not"?:true} (who ' +
    'started the rule)',
  personal: true,
  read: (value, path) => {
    const list = value['who'];
    if (!Array.isArray(list) || list.length === 0 || list.length > AUTOMATION_LIST_MAX)
      refuse(`${path}.who`, `${path}.who must be a list of 1 to ${AUTOMATION_LIST_MAX}`);
    return {
      kind: 'who',
      who: (list as unknown[]).map((w, i) => readWho(w, `${path}.who.${i}`)),
      ...not(value['not'], `${path}.not`),
    };
  },
  defaults: () => ({ kind: 'who', who: [] }),
  words: (c, names) => [
    { word: `it ${isOrNot(c.not)} by` },
    { chip: whoWords(c.who, (p) => refName(names, 'person', p)) },
  ],
  holds: (c, ctx) => {
    const { by, role } = ctx.event;
    const among = c.who.some((w) => ('person' in w ? w.person === by?.id : w.role === role));
    const named = whoWords(c.who, (p) => refName(ctx.names, 'person', p));
    return { ok: c.not ? !among : among, text: `Who Did It ${isOrNot(c.not)} ${named}` };
  },
});

const weekday = defineCondition<ItemWeekdayCondition & ItemPart>({
  kind: 'weekday',
  name: 'Day of Week',
  group: 'Conditions',
  line: 'today, in the rule’s time zone, is one of the chosen days',
  format: '{"kind":"weekday","days":[0 Sunday to 6 Saturday, at least one]} (today is one of them)',
  read: (value, path) => {
    const days = value['days'];
    if (!Array.isArray(days) || days.length === 0 || days.length > 7)
      refuse(`${path}.days`, `${path}.days must name 1 to 7 days`);
    const read = (days as unknown[]).map((d, i) => whole(d, `${path}.days.${i}`, 0, 6));
    return { kind: 'weekday', days: [...new Set(read)].sort((a, b) => a - b) };
  },
  defaults: () => ({ kind: 'weekday', days: [1, 2, 3, 4, 5] }),
  words: (c) => [{ word: 'today is' }, { chip: sentenceOrList(c.days.map(weekdayName)) }],
  holds: (c, ctx) => {
    const today = weekdayOf(localDay(ctx.now, ctx.timeZone));
    return {
      ok: c.days.includes(today),
      text: `Today is ${sentenceOrList(c.days.map(weekdayName))}`,
    };
  },
});

const containsWords = (c: ItemTextCondition) =>
  c.op === 'contains' ? 'contains' : 'does not contain';

const textCondition = defineCondition<ItemTextCondition & ItemPart>({
  kind: 'text',
  name: 'Text',
  group: 'Conditions',
  line: 'a value contains, or does not contain, some text',
  format:
    `{"kind":"text","value":a value’s name (comment, webhook.<name>),"op":"contains"|"not_contains","text":1 to ` +
    `${TEXT_CONDITION_MAX} characters} (that value holds the text, any case)`,
  read: (value, path, ctx) => {
    const name = typeof value['value'] === 'string' ? value['value'].trim() : '';
    if (!ctx.known(name))
      throw new Refused({
        error: 'automation_value_unknown',
        path: `${path}.value`,
        message: `{{${name}}} is not a value`,
      });
    const op = value['op'];
    if (op !== 'contains' && op !== 'not_contains')
      refuse(`${path}.op`, `${path}.op must be contains or not_contains`);
    return {
      kind: 'text',
      value: name,
      op: op as ItemTextCondition['op'],
      text: text(value['text'], `${path}.text`, TEXT_CONDITION_MAX),
    };
  },
  defaults: () => ({ kind: 'text', value: 'comment', op: 'contains', text: '' }),
  words: (c) => [{ chip: `{{${c.value}}}` }, { word: containsWords(c) }, { chip: `“${c.text}”` }],
  holds: (c, ctx) => {
    const has = ctx.value(c.value).toLowerCase().includes(c.text.toLowerCase());
    return {
      ok: c.op === 'contains' ? has : !has,
      text: `{{${c.value}}} ${containsWords(c)} “${c.text}”`,
    };
  },
});

/** The conditions every app has. */
export const sharedConditions = (): ConditionKind[] => [tab, who, weekday, textCondition];
