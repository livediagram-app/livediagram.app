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
import { documentLs, documentView } from './verbs/document';
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
  waitFor,
  watch,
} from './verbs/local';
import { iconSearch, schemaView, templateLs, templateView } from './verbs/catalogues';
import { changesetApply, elementVerbs, tabDiff } from './verbs/edit';
import { graphLintVerb } from './verbs/graph';
import {
  documentCreate,
  documentRename,
  documentRestore,
  documentRm,
  documentShare,
  tabAdd,
  tabRename,
  tabRm,
} from './verbs/lifecycle';
import { tabLint, tabLs, tabView } from './verbs/tab';

export const VERBS: readonly Verb[] = [
  documentLs,
  documentView,
  documentCreate,
  documentRename,
  documentShare,
  documentRm,
  documentRestore,
  tabLs,
  tabView,
  tabLint,
  tabDiff,
  tabAdd,
  tabRename,
  tabRm,
  ...elementVerbs,
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
  graphLintVerb,
  templateLs,
  templateView,
  iconSearch,
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
] as Verb[];

export const RESOURCES: readonly { name: string; alias?: string; summary: string }[] = [
  {
    name: 'document',
    alias: 'doc',
    summary: 'Documents: find, read, create, rename, share and remove them',
  },
  { name: 'tab', summary: 'Tabs: their views, their lint, and what changed' },
  { name: 'element', alias: 'el', summary: 'Elements: one edit operation a call' },
  { name: 'changeset', summary: 'Changesets: what changed, by whom, and undoing one' },
  { name: 'comment', summary: 'Comment threads' },
  { name: 'presence', summary: 'What the agent is doing, shown on a tab' },
  { name: 'graph', summary: 'Graph files: lint one before writing it' },
  { name: 'template', summary: 'Templates: the library, and one as an outline' },
  { name: 'icon', summary: 'Icons: find one for iconId=' },
  { name: 'skill', summary: 'The agent skill file' },
  { name: 'auth', summary: 'Credentials' },
  { name: 'telemetry', summary: 'The usage count: on or off' },
];

// Top-level commands that are verbs without a resource word.
export const TOP_LEVEL = ['guide', 'api', 'wait', 'watch'] as const;

export const RESOURCE_ALIASES: Readonly<Record<string, string>> = {
  doc: 'document',
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
