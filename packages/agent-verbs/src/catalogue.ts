// The verb catalogue (docs/specs/015-api/blueprints/cli.md "One catalogue"): every verb the CLI routes to, the
// resources they group under, and the aliases.

import type { Verb } from './define';
import { changesetLs, changesetRevert, changesetShow } from './verbs/changeset';
import { documentLs, documentView } from './verbs/document';
import {
  apiCall,
  authLogin,
  authLogout,
  authStatus,
  guide,
  skillInstall,
  skillPrint,
} from './verbs/local';
import { tabLint, tabLs, tabView } from './verbs/tab';

export const VERBS: readonly Verb[] = [
  documentLs,
  documentView,
  tabLs,
  tabView,
  tabLint,
  changesetLs,
  changesetShow,
  changesetRevert,
  guide,
  skillPrint,
  skillInstall,
  apiCall,
  authLogin,
  authStatus,
  authLogout,
] as Verb[];

export const RESOURCES: readonly { name: string; alias?: string; summary: string }[] = [
  { name: 'document', alias: 'doc', summary: 'Documents: find them and read them' },
  { name: 'tab', summary: 'Tabs: their views and their lint' },
  { name: 'changeset', summary: 'Changesets: what changed, by whom, and undoing one' },
  { name: 'skill', summary: 'The agent skill file' },
  { name: 'auth', summary: 'Credentials' },
];

// Top-level commands that are verbs without a resource word.
export const TOP_LEVEL = ['guide', 'api'] as const;

export const RESOURCE_ALIASES: Readonly<Record<string, string>> = {
  doc: 'document',
};

export function verbById(id: string): Verb | undefined {
  return VERBS.find((v) => v.id === id);
}

// The verbs of a resource, in catalogue order.
export function verbsOf(resource: string): Verb[] {
  return VERBS.filter((v) => v.id.startsWith(`${resource}.`));
}
