// livedocuments' own steps (docs/specs/013-workspace/automations.md "Steps of its own"; blueprint automations.md
// "Kinds"): Name This Version and Restore a Version, beside the ones every app has (Add a Tab from a Template is the
// shared step). What each does when a rule runs is the room's (apps/api document-room/automations/kit-versions.ts).
// A step's `tab` is the engine's tab reference; Restore a Version's `version` is this app's own reference
// (VERSION_REF), so a copy leaves it to pick and the Rules list says when the version is gone. Pure.

import { id, refuse, text, type Obj } from '@liveworkspace/automations';
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

export const NAME_VERSION_STEP = 'name_version';
export const RESTORE_VERSION_STEP = 'restore_version';

// A tab's named version, as a rule names one: by id, in a step's `version` field.
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
  tab === RUN_TAB ? 'the tab' : refName(names, 'tab', tab);

const runOrTab = (value: Obj, path: string): string =>
  value['tab'] === RUN_TAB ? RUN_TAB : id(value['tab'], `${path}.tab`);

const nameVersion = defineAction<NameVersionStep & ItemPart>({
  kind: NAME_VERSION_STEP,
  name: 'Name This Version',
  group: 'Versions',
  line: 'names the current content of a tab, the run’s tab or a chosen one',
  format:
    `{"kind":"name_version","tab":"run" (the run’s own tab) or tab,"name":1 to ${STEP_NAME_MAX} characters, ` +
    'values allowed} (fails when the tab already holds its 25 named versions)',
  read: (value, path, ctx) => ({
    kind: NAME_VERSION_STEP,
    tab: runOrTab(value, path),
    name: text(value['name'], `${path}.name`, STEP_NAME_MAX, ctx.text),
  }),
  defaults: () => ({ kind: NAME_VERSION_STEP, tab: RUN_TAB, name: '{{now.date}}' }),
  words: (a, names) => [
    { chip: `Name This Version “${a.name}”` },
    ...(a.tab === RUN_TAB ? [] : [{ word: 'on' }, { chip: refName(names, 'tab', a.tab) }]),
  ],
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
  line: 'puts a chosen tab back to one of its named versions, as Restore does',
  format:
    '{"kind":"restore_version","tab":tab,"version":the id of one of that tab’s named versions,"name"?:its name} ' +
    '(touches one tab and ends no session, so steps may follow it; a version unnamed or gone since fails the run)',
  read: (value, path) => {
    if (value['tab'] === RUN_TAB)
      refuse(`${path}.tab`, `${path}.tab must be a tab: a version belongs to one tab`);
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

/** livedocuments' own steps, in the picker's order. */
export const DOCUMENT_ACTIONS: readonly ActionKind[] = [nameVersion, restoreVersion];
