// liveknowledge's own steps (docs/specs/013-workspace/automations.md "Steps of its own"; blueprint automations.md
// "Kinds"): Set the Page Owner, Clear Verification, Email the Page Owner, Add to or Remove from Always in Context,
// Name This Version and Restore a Version, beside the ones every app has (Add a Page from a Template is the shared
// step). What each does when a rule runs is the room's (apps/api document-room/automations/kit-knowledge.ts,
// kit-versions.ts). A step's `tab` is the engine's page reference (`run`, the run's own page, or an id); Set the Page
// Owner's `to.person` is the engine's person reference; Restore a Version's `version` is this app's own reference
// (VERSION_REF), so a copy leaves it to pick and the Rules list says when the version is gone. Pure.

import {
  AUTOMATION_SUBJECT_MAX,
  AUTOMATION_TEXT_MAX,
  id,
  obj,
  refuse,
  text,
  unsupported,
  type Obj,
} from '@liveworkspace/automations';
import {
  RUN_TAB,
  STEP_NAME_MAX,
  defineAction,
  refName,
  type ActionKind,
  type ItemNames,
  type ItemOwnRef,
  type ItemPart,
} from '@liveworkspace/automations/item';

export const SET_OWNER_STEP = 'set_owner';
export const CLEAR_VERIFICATION_STEP = 'clear_verification';
export const EMAIL_OWNER_STEP = 'email_owner';
export const CONTEXT_STEP = 'context';
export const NAME_VERSION_STEP = 'name_version';
export const RESTORE_VERSION_STEP = 'restore_version';

// A page's named version, as a rule names one: by id, in a step's `version` field.
export const VERSION_REF: ItemOwnRef = { field: 'version', noun: 'a version', title: 'Version' };

// `tab`: the run's own tab (`run`) or a chosen one.
export type NameVersionStep = { kind: typeof NAME_VERSION_STEP; tab: string; name: string };
// `name`: the version's name when the step was saved, for the rule's words where the versions are not at hand.
export type RestoreVersionStep = {
  kind: typeof RESTORE_VERSION_STEP;
  tab: string;
  version: string;
  name?: string;
};

const tabWords = (tab: string, names: ItemNames): string =>
  tab === RUN_TAB ? 'the page' : refName(names, 'tab', tab);

const runOrTab = (value: Obj, path: string): string =>
  value['tab'] === RUN_TAB ? RUN_TAB : id(value['tab'], `${path}.tab`);

// A step on the run's page shows no page chip; on a chosen one, "on <page>".
const onPage = (tab: string, names: ItemNames) =>
  tab === RUN_TAB ? [] : [{ word: 'on' }, { chip: refName(names, 'tab', tab) }];

const RUN_OR_PAGE = '"tab":"run" (the run’s own page) or a page';

// ---- Trust -------------------------------------------------------------------------------------------------------

// Who a page's new owner is: a person of the knowledgebase, or whoever started the rule (for an agent, its token's
// person).
export type OwnerTo = { person: string } | { trigger: true };
export type SetOwnerStep = { kind: typeof SET_OWNER_STEP; tab: string; to: OwnerTo };
export type ClearVerificationStep = { kind: typeof CLEAR_VERIFICATION_STEP; tab: string };
export type EmailOwnerStep = { kind: typeof EMAIL_OWNER_STEP; subject: string; body: string };
export type ContextStep = { kind: typeof CONTEXT_STEP; tab: string; on: boolean };

function readOwnerTo(value: unknown, path: string, personless: boolean): OwnerTo {
  const to = obj(value, path);
  if (to['trigger'] === true) {
    if (personless)
      unsupported(
        'automation_condition_unsupported',
        path,
        'nobody is behind this trigger, so there is nobody who started it to own the page',
      );
    return { trigger: true };
  }
  return { person: id(to['person'], `${path}.person`) };
}

/** Who a Set the Page Owner step makes the owner, in words. */
export const ownerToWords = (to: OwnerTo, names?: ItemNames): string =>
  'trigger' in to ? 'whoever started it' : names ? refName(names, 'person', to.person) : 'a person';

const setOwner = defineAction<SetOwnerStep & ItemPart>({
  kind: SET_OWNER_STEP,
  name: 'Set the Page Owner',
  group: 'Trust',
  line: 'makes a person, or whoever started the rule, the owner of a page',
  format:
    `{"kind":"set_owner",${RUN_OR_PAGE},"to":{"person":person} or {"trigger":true} (whoever started it; for ` +
    'an agent, its token’s person)} (fails for someone who can no longer open the knowledgebase)',
  read: (value, path, ctx) => ({
    kind: SET_OWNER_STEP,
    tab: runOrTab(value, path),
    to: readOwnerTo(value['to'], `${path}.to`, ctx.personless),
  }),
  defaults: () => ({ kind: SET_OWNER_STEP, tab: RUN_TAB, to: { trigger: true } }),
  words: (a, names) => [
    { chip: `Set the Page Owner to ${ownerToWords(a.to, names)}` },
    ...onPage(a.tab, names),
  ],
  would: (a, ctx) =>
    `Would make ${ownerToWords(a.to, ctx.names)} the owner of ${tabWords(a.tab, ctx.names)}`,
  summary: (a) => `Set the Page Owner to ${ownerToWords(a.to)}`,
});

const clearVerification = defineAction<ClearVerificationStep & ItemPart>({
  kind: CLEAR_VERIFICATION_STEP,
  name: 'Clear Verification',
  group: 'Trust',
  line: 'takes a page’s verification away, so it reads Not Verified until someone verifies it',
  format: `{"kind":"clear_verification",${RUN_OR_PAGE}} (keeps the owner)`,
  read: (value, path) => ({ kind: CLEAR_VERIFICATION_STEP, tab: runOrTab(value, path) }),
  defaults: () => ({ kind: CLEAR_VERIFICATION_STEP, tab: RUN_TAB }),
  words: (a, names) => [{ chip: 'Clear Verification' }, ...onPage(a.tab, names)],
  would: (a, ctx) => `Would clear the verification of ${tabWords(a.tab, ctx.names)}`,
  summary: () => 'Clear Verification',
});

const emailOwner = defineAction<EmailOwnerStep & ItemPart>({
  kind: EMAIL_OWNER_STEP,
  name: 'Email the Page Owner',
  group: 'Trust',
  line: 'emails the owner of the run’s page',
  format:
    `{"kind":"email_owner","subject":1 to ${AUTOMATION_SUBJECT_MAX} characters,"body":1 to ` +
    `${AUTOMATION_TEXT_MAX} characters} (values allowed in both; a run with no page, or a page with no owner, ` +
    'fails)',
  read: (value, path, ctx) => ({
    kind: EMAIL_OWNER_STEP,
    subject: text(value['subject'], `${path}.subject`, AUTOMATION_SUBJECT_MAX, ctx.text),
    body: text(value['body'], `${path}.body`, AUTOMATION_TEXT_MAX, ctx.text),
  }),
  defaults: () => ({
    kind: EMAIL_OWNER_STEP,
    subject: '{{tab.name}}',
    body: '{{rule}} ran on {{tab.name}}.\n{{tab.url}}',
  }),
  words: () => [{ chip: 'Email the Page Owner' }],
  would: (a, ctx) => `Would email the page’s owner: ${ctx.fill(a.subject)}`,
  summary: () => 'Email the Page Owner',
});

// ---- Insights ------------------------------------------------------------------------------------------------

const context = defineAction<ContextStep & ItemPart>({
  kind: CONTEXT_STEP,
  name: 'Always in Context',
  group: 'Insights',
  line: 'puts a page in, or takes it out of, the pages every agent is handed before it starts',
  format:
    `{"kind":"context",${RUN_OR_PAGE},"on":true (Add to Always in Context) or false (Remove from it)} ` +
    '(adding fails when the page would pass the 8,000 token budget)',
  read: (value, path) => {
    if (typeof value['on'] !== 'boolean') refuse(`${path}.on`, `${path}.on must be true or false`);
    return { kind: CONTEXT_STEP, tab: runOrTab(value, path), on: value['on'] === true };
  },
  defaults: () => ({ kind: CONTEXT_STEP, tab: RUN_TAB, on: true }),
  words: (a, names) => [
    { chip: a.on ? 'Add to Always in Context' : 'Remove from Always in Context' },
    ...onPage(a.tab, names),
  ],
  would: (a, ctx) =>
    a.on
      ? `Would add ${tabWords(a.tab, ctx.names)} to Always in Context`
      : `Would remove ${tabWords(a.tab, ctx.names)} from Always in Context`,
  summary: (a) => (a.on ? 'Add to Always in Context' : 'Remove from Always in Context'),
});

// ---- Versions ----------------------------------------------------------------------------------------------------

const nameVersion = defineAction<NameVersionStep & ItemPart>({
  kind: NAME_VERSION_STEP,
  name: 'Name This Version',
  group: 'Versions',
  line: 'names the current content of a page, the run’s page or a chosen one',
  format:
    `{"kind":"name_version","tab":"run" (the run’s own tab) or tab,"name":1 to ${STEP_NAME_MAX} characters, ` +
    'values allowed} (fails when the tab already holds its 25 named versions)',
  read: (value, path, ctx) => ({
    kind: NAME_VERSION_STEP,
    tab: runOrTab(value, path),
    name: text(value['name'], `${path}.name`, STEP_NAME_MAX, ctx.text),
  }),
  defaults: () => ({ kind: NAME_VERSION_STEP, tab: RUN_TAB, name: '{{now.date}}' }),
  words: (a, names) => [{ chip: `Name This Version “${a.name}”` }, ...onPage(a.tab, names)],
  would: (a, ctx) =>
    `Would name the current version of ${tabWords(a.tab, ctx.names)} “${ctx.fill(a.name)}”`,
  summary: () => 'Name This Version',
});

/** The version a restore names, in words: the name the step kept, or that it is still to pick. */
export const versionWords = (a: Pick<RestoreVersionStep, 'version' | 'name'>): string =>
  a.version === '' ? VERSION_REF.noun : a.name ? `“${a.name}”` : 'a named version';

const restoreVersion = defineAction<RestoreVersionStep & ItemPart>({
  kind: RESTORE_VERSION_STEP,
  name: 'Restore a Version',
  group: 'Versions',
  line: 'puts a chosen page back to one of its named versions, as Restore does',
  format:
    '{"kind":"restore_version","tab":a page,"version":the id of one of that page’s named versions,"name"?:its ' +
    'name} (touches one page and ends no session, so steps may follow it; a version unnamed or gone since fails ' +
    'the run)',
  read: (value, path) => {
    if (value['tab'] === RUN_TAB)
      refuse(`${path}.tab`, `${path}.tab must be a page: a version belongs to one page`);
    return {
      kind: RESTORE_VERSION_STEP,
      tab: id(value['tab'], `${path}.tab`),
      version: id(value['version'], `${path}.version`),
      ...(value['name'] !== undefined
        ? { name: text(value['name'], `${path}.name`, STEP_NAME_MAX).trim() }
        : {}),
    };
  },
  defaults: () => ({ kind: RESTORE_VERSION_STEP, tab: '', version: '' }),
  words: (a, names) => [
    { chip: `Restore ${versionWords(a)}` },
    { word: 'on' },
    { chip: refName(names, 'tab', a.tab) },
  ],
  would: (a, ctx) => `Would restore ${refName(ctx.names, 'tab', a.tab)} to ${versionWords(a)}`,
  summary: () => 'Restore a Version',
});

/** liveknowledge's own steps, in the picker's order. */
export const DOCUMENT_ACTIONS: readonly ActionKind[] = [
  setOwner,
  clearVerification,
  emailOwner,
  context,
  nameVersion,
  restoreVersion,
];
