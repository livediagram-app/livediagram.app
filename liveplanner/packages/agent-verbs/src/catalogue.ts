// The verb catalogue (docs/specs/015-api/blueprints/cli.md "One catalogue"): every verb the CLI routes to, the
// resources they group under, and the aliases.

import type { Verb } from './define';
import { changesetLs, changesetRevert, changesetShow } from './verbs/changeset';
import {
  commentAdd,
  commentLs,
  commentReopen,
  commentReply,
  commentResolve,
} from './verbs/comment';
import { presenceClear, presenceSet } from './verbs/presence';
import { projectLs, projectView } from './verbs/project';
import {
  apiCall,
  authLogin,
  authLogout,
  authStatus,
  guide,
  skillInstall,
  skillPrint,
  telemetryOff,
  telemetryOn,
  exportAll,
  pull,
  push,
  tabRender,
  waitFor,
  watch,
} from './verbs/local';
import { schemaView, templateLs, templateView } from './verbs/catalogues';
import { changesetApply, elementVerbs, tabDiff } from './verbs/edit';
import {
  projectCreate,
  projectRename,
  projectRestore,
  projectRm,
  projectShare,
  tabAdd,
  tabRename,
  tabRm,
} from './verbs/lifecycle';
import { tabLs, tabView } from './verbs/tab';
import { itemVerbs } from './verbs/item';
import { threadVerbs } from './verbs/thread';
import { boardVerbs } from './verbs/board';
import { boardImport } from './verbs/board-import';
import { cardTypeVerbs } from './verbs/card-type';
import { sheetVerbs } from './verbs/sheet';
import { formVerbs } from './verbs/form';
import { workbenchOpen, workbenchPair } from './verbs/workbench';
import { folderCreate, folderLs } from './verbs/folder';

export const VERBS: readonly Verb[] = [
  projectLs,
  projectView,
  projectCreate,
  projectRename,
  projectShare,
  projectRm,
  projectRestore,
  tabLs,
  tabView,
  tabRender,
  tabDiff,
  tabAdd,
  tabRename,
  tabRm,
  ...elementVerbs,
  ...itemVerbs,
  ...threadVerbs,
  ...boardVerbs,
  boardImport,
  ...cardTypeVerbs,
  ...sheetVerbs,
  ...formVerbs,
  changesetApply,
  changesetLs,
  changesetShow,
  changesetRevert,
  commentLs,
  commentAdd,
  commentReply,
  commentResolve,
  commentReopen,
  presenceSet,
  presenceClear,
  templateLs,
  templateView,
  schemaView,
  guide,
  skillPrint,
  skillInstall,
  apiCall,
  authLogin,
  authStatus,
  authLogout,
  telemetryOn,
  telemetryOff,
  waitFor,
  watch,
  pull,
  push,
  exportAll,
  workbenchOpen,
  workbenchPair,
  folderLs,
  folderCreate,
] as Verb[];

export const RESOURCES: readonly { name: string; alias?: string; summary: string }[] = [
  {
    name: 'project',
    summary: 'Plans: find, read, create, rename, share and remove them',
  },
  { name: 'folder', summary: 'Folders: their paths and ids, and a new one' },
  { name: 'tab', summary: 'Tabs: their views and what changed' },
  { name: 'element', alias: 'el', summary: 'Elements: one edit operation a call' },
  { name: 'item', summary: 'Items: the work Plan boards show' },
  { name: 'thread', summary: 'Comment threads on cards' },
  { name: 'board', summary: 'Plan boards: add, change or import one' },
  { name: 'type', summary: 'Card types and their fields' },
  { name: 'sheet', summary: 'Sheets: their cells by A1, rows and columns' },
  { name: 'form', summary: 'Forms: build, read and publish one' },
  { name: 'changeset', summary: 'Changesets: what changed, by whom, and undoing one' },
  { name: 'comment', summary: 'Comment threads on elements and Sheet cells' },
  { name: 'presence', summary: 'What the agent is doing, shown on a tab' },
  {
    name: 'workbench',
    summary: 'Workbenches: open a plan in a developer tool, pair one',
  },
  { name: 'template', summary: 'Templates: the library, and one as an outline' },
  { name: 'skill', summary: 'The agent skill file' },
  { name: 'auth', summary: 'Credentials' },
  { name: 'telemetry', summary: 'The usage count: on or off' },
];

// Top-level commands that are verbs without a resource word.
export const TOP_LEVEL = ['guide', 'api', 'wait', 'watch', 'pull', 'push', 'export'] as const;

export const RESOURCE_ALIASES: Readonly<Record<string, string>> = {
  el: 'element',
};

// Command words that name one verb directly.
export const COMMAND_ALIASES: Readonly<Record<string, string>> = {
  edit: 'changeset.apply',
  schema: 'schema.view',
};

export function verbById(id: string): Verb | undefined {
  return VERBS.find((v) => v.id === id);
}

// The verbs of a resource, in catalogue order.
export function verbsOf(resource: string): Verb[] {
  return VERBS.filter((v) => v.id.startsWith(`${resource}.`));
}

// The verbs a front door counts in its usage telemetry (`Cli·Used`): every one that reaches a host, except
// turning the count itself on or off.
export function countedVerbs(): Verb[] {
  return VERBS.filter((v) => !v.offline && !v.id.startsWith('telemetry.'));
}
