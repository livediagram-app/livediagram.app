// The verb catalogue (docs/specs/015-api/blueprints/cli.md "One catalogue"): every verb the CLI routes to, the
// resources they group under, and the aliases.

import type { Verb } from './define';
import { changesetLs, changesetRevert, changesetShow } from './verbs/changeset';
import {
  commentAdd,
  commentDelete,
  commentEdit,
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
  exportAll,
  importFiles,
  pull,
  push,
  tabRender,
  waitFor,
  watch,
} from './verbs/local';
import { iconSearch, schemaView, templateLs, templateView } from './verbs/catalogues';
import { imageAdd, imageLs, imageRm } from './verbs/image';
import { changesetApply, elementVerbs, tabDiff } from './verbs/edit';
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
import { documentArchive, documentUnarchive } from './verbs/archive';
import { tabLint, tabLs, tabView } from './verbs/tab';
import { pagesVerbs } from './verbs/pages';
import { knowledgeVerbs } from './verbs/knowledge';
import { workbenchOpen, workbenchPair } from './verbs/workbench';
import { folderCreate, folderLs } from './verbs/folder';

export const VERBS: readonly Verb[] = [
  // The knowledgebase commands first: what an agent reaches for (verbs/knowledge.ts).
  ...knowledgeVerbs,
  documentLs,
  documentView,
  documentCreate,
  documentRename,
  documentShare,
  documentRm,
  documentRestore,
  documentArchive,
  documentUnarchive,
  tabLs,
  tabView,
  tabLint,
  tabRender,
  tabDiff,
  tabAdd,
  tabRename,
  tabRm,
  ...elementVerbs,
  ...pagesVerbs,
  changesetApply,
  changesetLs,
  changesetShow,
  changesetRevert,
  commentLs,
  commentAdd,
  commentReply,
  commentResolve,
  commentReopen,
  commentEdit,
  commentDelete,
  presenceSet,
  presenceClear,
  templateLs,
  templateView,
  iconSearch,
  imageLs,
  imageAdd,
  imageRm,
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
  importFiles,
  workbenchOpen,
  workbenchPair,
  folderLs,
  folderCreate,
] as Verb[];

export const RESOURCES: readonly { name: string; alias?: string; summary: string }[] = [
  {
    name: 'document',
    alias: 'doc',
    summary: 'Knowledgebases: find, read, create, rename, share and remove them',
  },
  { name: 'folder', summary: 'Folders: their paths and ids, and a new one' },
  { name: 'tab', summary: 'Pages as tabs: their views, their lint, and what changed' },
  { name: 'element', alias: 'el', summary: 'Elements: one edit operation a call' },
  { name: 'page', summary: 'Pages: slides, infographics' },
  { name: 'article', summary: 'Articles as Markdown' },
  { name: 'changeset', summary: 'Changesets: what changed, by whom, and undoing one' },
  { name: 'comment', summary: 'Comment threads' },
  { name: 'presence', summary: 'What the agent is doing, shown on a tab' },
  {
    name: 'workbench',
    summary: 'Workbenches: open a document in a developer tool, pair one',
  },
  { name: 'template', summary: 'Templates: the library, and one as an outline' },
  { name: 'icon', summary: 'Icons: find one for iconId=' },
  { name: 'image', summary: 'Images: the gallery imageId= takes' },
  { name: 'skill', summary: 'The agent skill file' },
  { name: 'auth', summary: 'Credentials' },
  { name: 'telemetry', summary: 'The usage count: on or off' },
];

// Top-level commands that are verbs without a resource word.
export const TOP_LEVEL = [
  'context',
  'pages',
  'search',
  'read',
  'new',
  'suggest',
  'write',
  'move',
  'gap',
  'import',
  'export',
  'guide',
  'api',
  'wait',
  'watch',
  'pull',
  'push',
] as const;

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
