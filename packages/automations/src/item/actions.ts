// The steps every app has (liveworkspace/docs/specs/018-automations/automations.md "Steps every app has"; blueprint
// item-engine.md "The shared kinds"): Take Snapshot, Revert to Snapshot, Send Email, Add a Tab from a Template, and
// the ones that only stand at a rule's top level: a message through a connection, Summarise with AI, Wait and
// If / Else. What each does when a rule runs is the room's (room/item/actions.ts). Pure.

import { addressWords, automationAddress } from '../email-addresses';
import {
  AUTOMATION_EMAIL_ADDRESSES_MAX,
  AUTOMATION_SUBJECT_MAX,
  AUTOMATION_TEXT_MAX,
} from '../limits';
import { SUMMARY_AI_STEP } from '../summary';
import type { AutomationOutgoing, AutomationWait } from '../types';
import { readIf, readNotify, readWait } from '../validate';
import { id, obj, refuse, text, unsupported } from '../validate-read';
import { AUTOMATION_NOTIFY_NAMES, notifyChip, waitWords } from '../words';
import { defineAction, type ActionKind } from './kinds';
import { refName, type ItemNames } from './names';
import { RUN_TAB } from './refs';
import type {
  ItemAddTab,
  ItemEmail,
  ItemEmailTo,
  ItemIf,
  ItemPart,
  ItemRevertSnapshot,
  ItemSummarise,
  ItemTakeSnapshot,
} from './types';

// A snapshot's or a new tab's name as a rule writes it (values allowed).
export const STEP_NAME_MAX = 120;

const NO_TOP: ReadonlySet<string> = new Set();

const takeSnapshot = defineAction<ItemTakeSnapshot & ItemPart>({
  kind: 'take_snapshot',
  name: 'Take Snapshot',
  group: 'Snapshots',
  line: 'takes a snapshot of the whole item, named by the rule',
  format: `{"kind":"take_snapshot","name":1 to ${STEP_NAME_MAX} characters, values allowed}`,
  read: (value, path, ctx) => ({
    kind: 'take_snapshot',
    name: text(value['name'], `${path}.name`, STEP_NAME_MAX, ctx.text),
  }),
  defaults: () => ({ kind: 'take_snapshot', name: '{{now.date}}' }),
  words: (a) => [{ chip: `Take Snapshot “${a.name}”` }],
  would: (a, ctx) => `Would take a snapshot named “${ctx.fill(a.name)}”`,
  summary: () => 'Take Snapshot',
});

/** The snapshot a revert names: by the item's own name for it where the caller has the item's snapshots (one it
 *  lacks is gone), else by the name the step kept. */
export function snapshotWords(a: ItemRevertSnapshot, names: ItemNames): string {
  if (names.snapshots || !a.snapshot || !a.name) return refName(names, 'snapshot', a.snapshot);
  return a.name;
}

const revertSnapshot = defineAction<ItemRevertSnapshot & ItemPart>({
  kind: 'revert_snapshot',
  name: 'Revert to Snapshot',
  group: 'Snapshots',
  line: 'puts the whole item back to a chosen snapshot, for everyone',
  format:
    '{"kind":"revert_snapshot","snapshot":a snapshot’s id,"name"?:its name} (the rule’s last step; only a ' +
    'person saves it, never an API token)',
  last: true,
  needsPerson: true,
  read: (value, path) => ({
    kind: 'revert_snapshot',
    snapshot: id(value['snapshot'], `${path}.snapshot`),
    ...(value['name'] !== undefined
      ? { name: text(value['name'], `${path}.name`, STEP_NAME_MAX).trim() }
      : {}),
  }),
  defaults: () => ({ kind: 'revert_snapshot', snapshot: '' }),
  words: (a, names) => [{ chip: `Revert to “${snapshotWords(a, names)}”` }],
  would: (a, ctx) => `Would revert to “${snapshotWords(a, ctx.names)}”`,
  summary: () => 'Revert to Snapshot',
});

function readTo(value: unknown, path: string, personless: boolean): ItemEmailTo {
  const to = obj(value, path);
  if (to['owner'] === true) return { owner: true };
  if (to['trigger'] === true) {
    if (personless)
      unsupported(
        'automation_condition_unsupported',
        path,
        'nobody is behind this trigger, so there is nobody who started it to email',
      );
    return { trigger: true };
  }
  if (to['person'] !== undefined) return { person: id(to['person'], `${path}.person`) };
  const list = to['addresses'];
  if (!Array.isArray(list) || list.length === 0 || list.length > AUTOMATION_EMAIL_ADDRESSES_MAX)
    refuse(
      path,
      `${path} must be the owner, whoever started it, a person or 1 to ${AUTOMATION_EMAIL_ADDRESSES_MAX} addresses`,
    );
  const addresses = (list as unknown[]).map((raw, i) => {
    const address = typeof raw === 'string' ? automationAddress(raw) : null;
    return address ?? refuse(`${path}.addresses.${i}`, `${path}.addresses.${i} must be an email`);
  });
  return { addresses: [...new Set(addresses)] };
}

/** Who an email goes to, in words. `names`: absent for a reader, who never sees a person or an address. */
export function emailToWords(to: ItemEmailTo, names?: ItemNames): string {
  if ('owner' in to) return 'the owner';
  if ('trigger' in to) return 'whoever started it';
  if ('person' in to) return names ? refName(names, 'person', to.person) : 'a person';
  return names ? addressWords(to.addresses) : 'typed-in addresses';
}

const email = defineAction<ItemEmail & ItemPart>({
  kind: 'email',
  name: 'Send Email',
  group: 'Messages',
  line: 'emails the owner, whoever started the rule, a chosen person or typed-in addresses',
  format:
    '{"kind":"email","to":{"owner":true} or {"trigger":true} (whoever started it) or {"person":person} or ' +
    `{"addresses":[1 to ${AUTOMATION_EMAIL_ADDRESSES_MAX} emails]},"subject":1 to ${AUTOMATION_SUBJECT_MAX} ` +
    `characters,"body":1 to ${AUTOMATION_TEXT_MAX} characters} (values allowed in both)`,
  read: (value, path, ctx) => ({
    kind: 'email',
    to: readTo(value['to'], `${path}.to`, ctx.personless),
    subject: text(value['subject'], `${path}.subject`, AUTOMATION_SUBJECT_MAX, ctx.text),
    body: text(value['body'], `${path}.body`, AUTOMATION_TEXT_MAX, ctx.text),
  }),
  defaults: () => ({ kind: 'email', to: { owner: true }, subject: '', body: '' }),
  words: (a, names) => [{ chip: `Send Email to ${emailToWords(a.to, names)}` }],
  would: (a, ctx) => `Would email ${emailToWords(a.to, ctx.names)}: ${ctx.fill(a.subject)}`,
  summary: (a) => `Send Email to ${emailToWords(a.to)}`,
});

const addTab = defineAction<ItemAddTab & ItemPart>({
  kind: 'add_tab',
  name: 'Add a Tab from a Template',
  group: 'Tabs',
  line: 'adds a tab made from a chosen template, named by the rule, last in order',
  format: `{"kind":"add_tab","template":a template’s id,"name":1 to ${STEP_NAME_MAX} characters, values allowed}`,
  read: (value, path, ctx) => ({
    kind: 'add_tab',
    template: id(value['template'], `${path}.template`),
    name: text(value['name'], `${path}.name`, STEP_NAME_MAX, ctx.text),
  }),
  defaults: () => ({ kind: 'add_tab', template: '', name: '' }),
  words: (a, names) => [
    { chip: `Add a Tab “${a.name}” from ${refName(names, 'template', a.template)}` },
  ],
  would: (a, ctx) => `Would add a tab named “${ctx.fill(a.name)}”`,
  summary: () => 'Add a Tab from a Template',
});

const notify = defineAction<AutomationOutgoing & ItemPart>({
  kind: 'notify',
  name: 'Send a Message',
  group: 'Messages',
  line: 'posts through one of the item’s connections: Slack, Microsoft Teams or your own service',
  format:
    '{"kind":"notify","via":"slack"|"teams"|"webhook","webhook":a connection’s id,"text":1 to ' +
    `${AUTOMATION_TEXT_MAX} characters, values allowed}`,
  top: true,
  read: (value, path, ctx) => readNotify(value, path, ctx.text),
  defaults: () => ({ kind: 'notify', via: 'slack', webhook: '', text: '' }),
  words: (a, names) => [
    { chip: notifyChip(a, names.connections ? { webhooks: names.connections } : undefined) },
  ],
  would: (a, ctx) => `Would post to ${a.name ?? 'the webhook'}: ${ctx.fill(a.text)}`,
  summary: (a) => AUTOMATION_NOTIFY_NAMES[a.via],
});

const wait = defineAction<AutomationWait & ItemPart>({
  kind: 'wait',
  name: 'Wait',
  group: 'Flow',
  line: 'holds the rest of the rule for 1 hour to 30 days',
  format: '{"kind":"wait","hours":1 to 720} (the steps after it run later; top level only)',
  top: true,
  read: (value, path) => readWait(value, path),
  defaults: () => ({ kind: 'wait', hours: 24 }),
  words: (a) => [{ chip: waitWords(a.hours) }],
  would: (a) => `Would ${waitWords(a.hours).toLowerCase()}`,
});

const branch = defineAction<ItemIf & ItemPart>({
  kind: 'if',
  name: 'If / Else',
  group: 'Flow',
  line: 'runs one list of actions when its conditions hold, another when they do not',
  format:
    '{"kind":"if","conditions":[conditions, at least one],"then":[actions],"else":[actions]} (top level only; ' +
    'its lists hold actions, never a wait, an ai, a notify or another if)',
  top: true,
  read: (value, path, ctx) =>
    readIf(value, path, { conditions: ctx.conditions, action: ctx.action, refused: NO_TOP }),
  defaults: () => ({ kind: 'if', conditions: [], then: [], else: [] }),
  words: (a) => [{ chip: `If / Else (${a.then.length + a.else.length} Actions)` }],
  would: () => 'Would check its conditions',
});

const summarise = defineAction<ItemSummarise & ItemPart>({
  kind: 'ai',
  name: 'Summarise with AI',
  group: 'AI',
  line: 'reads the item’s text, or one tab’s, and keeps a summary as {{summary}} for the steps after',
  format:
    '{"kind":"ai","task":"summarise","tab"?:"run" (the run’s tab) or a tab’s id} (makes {{summary}} for the ' +
    'steps after it; top level only)',
  top: true,
  read: (value, path) => {
    if (value['task'] !== 'summarise') refuse(`${path}.task`, `${path}.task must be summarise`);
    const tab = value['tab'];
    return {
      kind: 'ai',
      task: 'summarise',
      ...(tab === undefined ? {} : { tab: tab === RUN_TAB ? RUN_TAB : id(tab, `${path}.tab`) }),
    };
  },
  defaults: () => ({ kind: 'ai', task: 'summarise' }),
  words: (a, names) => [
    {
      chip:
        a.tab === undefined
          ? 'Summarise with AI'
          : `Summarise ${a.tab === RUN_TAB ? 'the Tab' : refName(names, 'tab', a.tab)} with AI`,
    },
  ],
  would: () => 'Would summarise with AI',
  summary: () => SUMMARY_AI_STEP,
});

/** The steps every app has; with `tabTemplates`, Add a Tab from a Template too. */
export const sharedActions = (tabTemplates: boolean): ActionKind[] => [
  takeSnapshot,
  revertSnapshot,
  email,
  ...(tabTemplates ? [addTab] : []),
  notify,
  summarise,
  wait,
  branch,
];
