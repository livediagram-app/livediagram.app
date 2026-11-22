// Steps in other apps (liveworkspace/docs/specs/018-automations/automations.md "Steps in other apps"; blueprint
// cross-app.md "Kinds"): Create a Card in a Plan, Write a Page in a Knowledgebase, Post in a Space, Add a Tab to a
// Document and Notify, as definitions every app's check, sentence, agents' format and builder read. The same JSON in
// every app; the values in their texts are the app's own. What each does when a rule runs is the room's
// (room/cross-app.ts) and the target app's. Pure.

import {
  CROSS_APP_BODY_MAX,
  CROSS_APP_DUE_DAYS_MAX,
  CROSS_APP_KIND_APPS,
  CROSS_APP_NOTICE_PEOPLE_MAX,
  CROSS_APP_TARGET_TITLE_MAX,
  CROSS_APP_TITLE_MAX,
  type CrossAppTarget,
  type CrossAppTargetedStep,
  type DocTabStep,
  type InboxNoticeStep,
  type KbPageStep,
  type NoticeRecipient,
  type PlanCardStep,
  type SpacePostStep,
} from '@liveworkspace/index-client';
import { AUTOMATION_TEXT_MAX } from '../limits';
import { id, isObj, obj, refuse, text, whole, type Obj, type TextCheck } from '../validate-read';
import { defineAction, type ActionKind } from '../item/kinds';
import { refName, type ItemNames } from '../item/names';
import type { ItemPart } from '../item/types';
import { appWord, targetWords } from './words';

// The group the builder lists them under.
export const CROSS_APP_GROUP = 'In Other Apps';
// A column's name, as a board shows it.
export const CROSS_APP_COLUMN_MAX = 80;
// An assignee or a recipient written as a value (`{{page.owner}}`).
export const CROSS_APP_VALUE_MAX = 80;

const flag = (v: unknown, path: string, fallback: boolean): boolean =>
  v === undefined
    ? fallback
    : typeof v === 'boolean'
      ? v
      : refuse(path, `${path} must be true or false`);

/** A step's target: an item of an app the kind acts on, by id, with its title as picked. */
export function readTarget(
  v: unknown,
  path: string,
  kind: CrossAppTargetedStep['kind'],
): CrossAppTarget {
  const o = obj(v, path);
  const apps = CROSS_APP_KIND_APPS[kind];
  const app = o['app'];
  if (typeof app !== 'string' || !(apps as readonly string[]).includes(app))
    refuse(`${path}.app`, `${path}.app must be ${apps.join(' or ')}`);
  const title = o['title'] === undefined ? '' : o['title'];
  if (typeof title !== 'string' || title.length > CROSS_APP_TARGET_TITLE_MAX)
    refuse(
      `${path}.title`,
      `${path}.title must be text of up to ${CROSS_APP_TARGET_TITLE_MAX} characters`,
    );
  return {
    app: app as CrossAppTarget['app'],
    item: id(o['item'], `${path}.item`),
    title: (title as string).trim(),
  };
}

// The JSON's shape in prose, for agents and Describe a Rule.
const TARGET_FORMAT = (apps: string) =>
  `"target":{"app":${apps},"item":the item's id,"title":its title}`;

type Part<T> = T & ItemPart;

/** Each kind's reader, for an app whose check is its own (liveplanner's). */
export const readPlanCard = (v: Obj, path: string, check: TextCheck): PlanCardStep => {
  const assignee = v['assignee'];
  const due = v['dueDays'];
  return {
    kind: 'plan_card',
    target: readTarget(v['target'], `${path}.target`, 'plan_card'),
    board: id(v['board'], `${path}.board`),
    column: text(v['column'], `${path}.column`, CROSS_APP_COLUMN_MAX).trim(),
    title: text(v['title'], `${path}.title`, CROSS_APP_TITLE_MAX, check),
    description: text(v['description'] ?? '', `${path}.description`, AUTOMATION_TEXT_MAX, {
      ...check,
      empty: true,
    }),
    ...(assignee === undefined || assignee === ''
      ? {}
      : { assignee: text(assignee, `${path}.assignee`, CROSS_APP_VALUE_MAX, check).trim() }),
    ...(due === undefined
      ? {}
      : { dueDays: whole(due, `${path}.dueDays`, 0, CROSS_APP_DUE_DAYS_MAX) }),
    linkBack: flag(v['linkBack'], `${path}.linkBack`, true),
    skipIfOpen: flag(v['skipIfOpen'], `${path}.skipIfOpen`, false),
  };
};

export const readKbPage = (v: Obj, path: string, check: TextCheck): KbPageStep => ({
  kind: 'kb_page',
  target: readTarget(v['target'], `${path}.target`, 'kb_page'),
  ...(v['parent'] === undefined || v['parent'] === null || v['parent'] === ''
    ? {}
    : { parent: id(v['parent'], `${path}.parent`) }),
  title: text(v['title'], `${path}.title`, CROSS_APP_TITLE_MAX, check),
  body: text(v['body'], `${path}.body`, CROSS_APP_BODY_MAX, check),
});

export const readSpacePost = (v: Obj, path: string, check: TextCheck): SpacePostStep => ({
  kind: 'space_post',
  target: readTarget(v['target'], `${path}.target`, 'space_post'),
  spaceTab: id(v['spaceTab'], `${path}.spaceTab`),
  text: text(v['text'], `${path}.text`, AUTOMATION_TEXT_MAX, check),
});

export const readDocTab = (v: Obj, path: string, check: TextCheck): DocTabStep => ({
  kind: 'doc_tab',
  target: readTarget(v['target'], `${path}.target`, 'doc_tab'),
  docTemplate: id(v['docTemplate'], `${path}.docTemplate`),
  name: text(v['name'], `${path}.name`, CROSS_APP_TITLE_MAX, check),
});

function readRecipient(v: unknown, path: string, check: TextCheck): NoticeRecipient {
  if (isObj(v) && v['person'] !== undefined) return { person: id(v['person'], `${path}.person`) };
  if (isObj(v) && v['value'] !== undefined)
    return { value: text(v['value'], `${path}.value`, CROSS_APP_VALUE_MAX, check).trim() };
  return refuse(path, `${path} must be {"person":id} or {"value":text}`);
}

export const readInboxNotice = (v: Obj, path: string, check: TextCheck): InboxNoticeStep => {
  const to = v['to'];
  if (!Array.isArray(to) || to.length === 0 || to.length > CROSS_APP_NOTICE_PEOPLE_MAX)
    refuse(`${path}.to`, `${path}.to must be 1 to ${CROSS_APP_NOTICE_PEOPLE_MAX} people`);
  return {
    kind: 'inbox_notice',
    to: (to as unknown[]).map((r, i) => readRecipient(r, `${path}.to.${i}`, check)),
    text: text(v['text'], `${path}.text`, AUTOMATION_TEXT_MAX, check),
  };
};

/** Who a Notify reaches, in words. `names`: absent for a reader, who never sees a person. */
export function recipientsWords(to: readonly NoticeRecipient[], names?: ItemNames): string {
  if (!names) return to.length === 1 ? '1 Person' : `${to.length} People`;
  const named = to.map((r) => ('person' in r ? refName(names, 'person', r.person) : r.value));
  return named.length <= 2 ? named.join(' and ') : `${named.length} People`;
}

const planCard = defineAction<Part<PlanCardStep>>({
  kind: 'plan_card',
  name: 'Create a Card in a Plan',
  group: CROSS_APP_GROUP,
  line: 'makes a card on a board of another plan, as you, linked back to what fired it',
  format:
    `{"kind":"plan_card",${TARGET_FORMAT('"liveplanner"')},"board":a Board tab's id,"column":a column's name,` +
    `"title":1 to ${CROSS_APP_TITLE_MAX} characters,"description"?:text,"assignee"?:a person's id or a value,` +
    `"dueDays"?:0 to ${CROSS_APP_DUE_DAYS_MAX},"linkBack"?:true,"skipIfOpen"?:false} (values allowed; top level only)`,
  top: true,
  read: (v, path, ctx) => readPlanCard(v, path, ctx.text),
  defaults: () => ({
    kind: 'plan_card',
    target: { app: 'liveplanner', item: '', title: '' },
    board: '',
    column: '',
    title: '',
    description: '',
    linkBack: true,
    skipIfOpen: false,
  }),
  words: (a) => [{ chip: `Create a Card in ${targetWords(a.target, 'a Plan')}` }],
  would: (a, ctx) =>
    `Would create a card “${ctx.fill(a.title)}” in ${targetWords(a.target, 'a plan')}`,
  summary: () => 'Create a Card in a Plan',
});

const kbPage = defineAction<Part<KbPageStep>>({
  kind: 'kb_page',
  name: 'Write a Page in a Knowledgebase',
  group: CROSS_APP_GROUP,
  line: 'writes a page in a knowledgebase, as you, Never Verified until someone checks it',
  format:
    `{"kind":"kb_page",${TARGET_FORMAT('"liveknowledge"')},"parent"?:a page's id,"title":1 to ` +
    `${CROSS_APP_TITLE_MAX} characters,"body":Markdown, 1 to ${CROSS_APP_BODY_MAX} characters} (values allowed; ` +
    'top level only)',
  top: true,
  read: (v, path, ctx) => readKbPage(v, path, ctx.text),
  defaults: () => ({
    kind: 'kb_page',
    target: { app: 'liveknowledge', item: '', title: '' },
    title: '',
    body: '',
  }),
  words: (a) => [{ chip: `Write a Page in ${targetWords(a.target, 'a Knowledgebase')}` }],
  would: (a, ctx) =>
    `Would write a page “${ctx.fill(a.title)}” in ${targetWords(a.target, 'a knowledgebase')}`,
  summary: () => 'Write a Page in a Knowledgebase',
});

const spacePost = defineAction<Part<SpacePostStep>>({
  kind: 'space_post',
  name: 'Post in a Space',
  group: CROSS_APP_GROUP,
  line: 'posts a note on a tab of a livehuddle Space, as you',
  format:
    `{"kind":"space_post",${TARGET_FORMAT('"livehuddle"')},"spaceTab":the Space's tab id,"text":1 to ` +
    `${AUTOMATION_TEXT_MAX} characters} (values allowed; top level only)`,
  top: true,
  read: (v, path, ctx) => readSpacePost(v, path, ctx.text),
  defaults: () => ({
    kind: 'space_post',
    target: { app: 'livehuddle', item: '', title: '' },
    spaceTab: '',
    text: '',
  }),
  words: (a) => [{ chip: `Post in ${targetWords(a.target, 'a Space')}` }],
  would: (a, ctx) => `Would post in ${targetWords(a.target, 'a Space')}: ${ctx.fill(a.text)}`,
  summary: () => 'Post in a Space',
});

const docTab = defineAction<Part<DocTabStep>>({
  kind: 'doc_tab',
  name: 'Add a Tab to a Document',
  group: CROSS_APP_GROUP,
  line: 'adds a tab from a template to a livedocuments or livediagram document, as you',
  format:
    `{"kind":"doc_tab",${TARGET_FORMAT('"livedocuments" or "livediagram"')},"docTemplate":a template of that ` +
    `app,"name":1 to ${CROSS_APP_TITLE_MAX} characters} (values allowed; top level only)`,
  top: true,
  read: (v, path, ctx) => readDocTab(v, path, ctx.text),
  defaults: () => ({
    kind: 'doc_tab',
    target: { app: 'livedocuments', item: '', title: '' },
    docTemplate: '',
    name: '',
  }),
  words: (a) => [
    {
      chip: `Add a Tab “${a.name}” to ${targetWords(a.target, `a ${appWord(a.target.app)} Document`)}`,
    },
  ],
  would: (a, ctx) =>
    `Would add a tab “${ctx.fill(a.name)}” to ${targetWords(a.target, 'a document')}`,
  summary: () => 'Add a Tab to a Document',
});

const inboxNotice = defineAction<Part<InboxNoticeStep>>({
  kind: 'inbox_notice',
  name: 'Notify',
  group: CROSS_APP_GROUP,
  line: 'puts a notice in chosen people’s Inbox, in every app',
  format:
    `{"kind":"inbox_notice","to":[1 to ${CROSS_APP_NOTICE_PEOPLE_MAX} of {"person":person} or {"value":a value ` +
    `naming one}],"text":1 to ${AUTOMATION_TEXT_MAX} characters} (values allowed; top level only)`,
  top: true,
  read: (v, path, ctx) => readInboxNotice(v, path, ctx.text),
  defaults: () => ({ kind: 'inbox_notice', to: [], text: '' }),
  words: (a, names) => [{ chip: `Notify ${recipientsWords(a.to, names)}` }],
  would: (a, ctx) => `Would notify ${recipientsWords(a.to, ctx.names)}: ${ctx.fill(a.text)}`,
  summary: (a) => `Notify ${recipientsWords(a.to)}`,
});

/** A step's chip, for an app whose sentence is its own (liveplanner's): as the registry's words say it. */
export function crossAppChip(step: CrossAppTargetedStep | InboxNoticeStep): string {
  switch (step.kind) {
    case 'plan_card':
      return `Create a Card in ${targetWords(step.target, 'a Plan')}`;
    case 'kb_page':
      return `Write a Page in ${targetWords(step.target, 'a Knowledgebase')}`;
    case 'space_post':
      return `Post in ${targetWords(step.target, 'a Space')}`;
    case 'doc_tab':
      return `Add a Tab “${step.name}” to ${targetWords(step.target, `a ${appWord(step.target.app)} Document`)}`;
    case 'inbox_notice':
      return `Notify ${recipientsWords(step.to)}`;
  }
}

/** The five steps in other apps, as every app's registry holds them. */
export const crossAppActions = (): ActionKind[] => [
  planCard,
  kbPage,
  spacePost,
  docTab,
  inboxNotice,
];

/** The readers by kind, for an app whose check is its own. */
export const CROSS_APP_READERS: Readonly<
  Record<string, (v: Obj, path: string, check: TextCheck) => CrossAppTargetedStep | InboxNoticeStep>
> = {
  plan_card: readPlanCard,
  kb_page: readKbPage,
  space_post: readSpacePost,
  doc_tab: readDocTab,
  inbox_notice: readInboxNotice,
};
