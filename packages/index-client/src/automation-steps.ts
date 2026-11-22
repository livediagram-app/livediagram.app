// Steps in other apps (liveworkspace/docs/specs/018-automations/automations.md "Steps in other apps"; blueprint
// cross-app.md "Wire"): what an item's room sends the index when a rule's step acts on another app's item, what the
// index sends that app's door with the author's grant, and what each answers. The step shapes are the same JSON in
// every app's rules. Pure.

import type { App } from './constants';

// A chain stops after this many hops across apps (the fourth is refused).
export const CROSS_APP_HOPS_MAX = 3;
// The runs a day (UTC) one rule makes that hold a step in another app.
export const CROSS_APP_RULE_DAY_MAX = 100;
// The steps in other apps one author's rules run a day (UTC), across every app, counted at the index.
export const CROSS_APP_AUTHOR_DAY_MAX = 500;
// The steps in other apps one rule holds.
export const CROSS_APP_STEPS_MAX = 5;
// The people one Notify reaches.
export const CROSS_APP_NOTICE_PEOPLE_MAX = 10;
// A card's due date: at most this many days after the rule fires.
export const CROSS_APP_DUE_DAYS_MAX = 365;
// A filled title (a card's, a page's, a tab's) and a filled body.
export const CROSS_APP_TITLE_MAX = 200;
export const CROSS_APP_BODY_MAX = 20_000;
// A target's title as it was picked (the sentence's words; the item is read again on every run).
export const CROSS_APP_TARGET_TITLE_MAX = 200;
// The rules a chain names: one per hop and the rule that started it.
export const CROSS_APP_CHAIN_RULES_MAX = CROSS_APP_HOPS_MAX + 1;

// The item a step acts on: its app, its id, and its title as picked.
export type CrossAppTarget = { app: App; item: string; title: string };

// The steps, as a rule saves them. Texts hold values (`{{card.title}}`) until a run fills them.
export type PlanCardStep = {
  kind: 'plan_card';
  target: CrossAppTarget;
  // The Board tab's id, and a column of it by name.
  board: string;
  column: string;
  title: string;
  description: string;
  // A person of the plan (an id), or a value naming one (`{{page.owner}}`); absent for nobody.
  assignee?: string;
  dueDays?: number;
  linkBack: boolean;
  skipIfOpen: boolean;
};
export type KbPageStep = {
  kind: 'kb_page';
  target: CrossAppTarget;
  // The page it goes under; absent for the top level.
  parent?: string;
  title: string;
  body: string;
};
export type SpacePostStep = {
  kind: 'space_post';
  target: CrossAppTarget;
  // The Space's tab the note goes on (named apart from `tab`, which is always the rule's own item's tab).
  spaceTab: string;
  text: string;
};
export type DocTabStep = {
  kind: 'doc_tab';
  target: CrossAppTarget;
  // The target app's template kind (named apart from `template`, the rule's own item's).
  docTemplate: string;
  name: string;
};
// A person of the item by id, or a value naming one (`{{person}}`).
export type NoticeRecipient = { person: string } | { value: string };
export type InboxNoticeStep = {
  kind: 'inbox_notice';
  to: NoticeRecipient[];
  text: string;
};
export type CrossAppStep = PlanCardStep | KbPageStep | SpacePostStep | DocTabStep | InboxNoticeStep;
export type CrossAppKind = CrossAppStep['kind'];
export type CrossAppTargetedStep = Exclude<CrossAppStep, InboxNoticeStep>;

export const CROSS_APP_KINDS: readonly CrossAppKind[] = [
  'plan_card',
  'kb_page',
  'space_post',
  'doc_tab',
  'inbox_notice',
];
export const isCrossAppKind = (kind: unknown): kind is CrossAppKind =>
  typeof kind === 'string' && (CROSS_APP_KINDS as readonly string[]).includes(kind);

// The apps each targeted kind acts on.
export const CROSS_APP_KIND_APPS: Readonly<Record<CrossAppTargetedStep['kind'], readonly App[]>> = {
  plan_card: ['liveplanner'],
  kb_page: ['liveknowledge'],
  space_post: ['livehuddle'],
  doc_tab: ['livedocuments', 'livediagram'],
};

// The level the author needs on the target: every targeted kind writes, so an Editor's.
export const CROSS_APP_NEED = 'edit' as const;

// The runs one change set off across apps: an id, the hops so far, and each rule that ran in it
// (`<app>:<item>:<rule>`, ruleKeyOf).
export type CrossAppChain = { id: string; hops: number; rules: string[] };

export const ruleKeyOf = (app: App, itemId: string, ruleId: string): string =>
  `${app}:${itemId}:${ruleId}`;

// What a room sends the index for one step, its texts filled. `key`: the run's id and the step's place, so a retry
// names the same step.
export type AutomationStepPush = {
  key: string;
  author: string;
  rule: { id: string; name: string };
  // The item that fired, as a target's link back names it.
  from: { title: string; url: string };
  chain: CrossAppChain;
  step: CrossAppStep;
};

// What the index sends the target app's door, with the author's grant in X-Index-Grant. The chain is the one the
// target's write carries on: one more hop, the source rule added.
export type AutomationStepDoorCall = {
  author: string;
  rule: { id: string; name: string; app: App; item: string };
  from: { title: string; url: string };
  chain: CrossAppChain;
  step: CrossAppTargetedStep;
};

export const CROSS_APP_REFUSALS = [
  // The author cannot edit the target (or it is gone, in the Trash, archived): the rule pauses.
  'no_access',
  // The target answered that what the step names is gone (a board, a parent page, a template, a tab).
  'target_gone',
  // The chain already ran this rule, or would take a fourth hop: the run is Skipped.
  'loop',
  'chain_long',
  // The author's steps today are spent: Skipped.
  'capped',
  // A step the index or the target could not read.
  'invalid',
  // The target could not do it, or could not be reached.
  'failed',
  'unavailable',
] as const;
export type CrossAppRefusal = (typeof CROSS_APP_REFUSALS)[number];
export const isCrossAppRefusal = (code: unknown): code is CrossAppRefusal =>
  typeof code === 'string' && (CROSS_APP_REFUSALS as readonly string[]).includes(code);

export type AutomationStepAnswer =
  | { ok: true; text: string; link?: string }
  | { ok: false; code: CrossAppRefusal; reason: string };

// What a target offers the step's pickers (POST …/automation-target): a plan's boards and their columns, a
// knowledgebase's pages, a document's templates, a Space's tabs. Each list is the target app's; the rest are absent.
export type AutomationTargetDescription = {
  app: App;
  title: string;
  boards?: { id: string; name: string; columns: string[] }[];
  pages?: { id: string; name: string; parent: string | null }[];
  templates?: { id: string; name: string }[];
  tabs?: { id: string; name: string }[];
};

// The internal door's path on the target app, under its origin.
export const automationStepDoorPath = (itemId: string): string =>
  `/api/internal/items/${encodeURIComponent(itemId)}/automation-step`;
export const automationTargetDoorPath = (itemId: string): string =>
  `/api/internal/items/${encodeURIComponent(itemId)}/automation-target`;
