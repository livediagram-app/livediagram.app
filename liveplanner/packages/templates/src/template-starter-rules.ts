// A Plan template's starter rules (docs/specs/026-plan/plan-templates.md "Starter rules"; automations.md "Copies,
// exports and deletes"): the Automations rules a signed-in Editor's cloud plan made from the template starts with, each
// filled by the Templates gallery's own builder over the plan the template makes (its columns, their phases and the
// card types its boards bring), so a rule here is the rule the gallery would offer on that plan. A rule is on only
// when it changes fields, comments or assigns and nothing is left to pick. One that needs people picked ships off
// without its Assign in Turn step, which a save refuses until it names 2 to 10 people: whoever turns it on adds the
// step with the people on the plan. No starter rule sends an email, calls a webhook or asks the AI
// (STARTER_STEP_KINDS). Pure: its own entry (`@liveplanner/templates/template-starter-rules`), so the editor loads it only when it makes the rules.
import {
  automationTemplate,
  catalogueWithBoardTypes,
  picksLeft,
  planOutline,
  statusPhasesOf,
  type AutomationRuleBody,
  type AutomationStep,
  type AutomationTemplateFill,
  type AutomationTemplatePlan,
  type AutomationTemplateId,
} from '@liveplanner/items';
import { buildTemplateTabs } from './template-tab';
import {
  hasStarterRules,
  type PlanTemplateKind,
  type StarterRuleKind,
} from './plan-template-kinds';

type Starter = { id: AutomationTemplateId; on: boolean };

const STAMP: Starter = { id: 'stamp-finish', on: true };
const CLOSE: Starter = { id: 'close-parent', on: true };
const START: Starter = { id: 'assign-on-start', on: true };
const DUE: Starter = { id: 'due-on-start', on: true };
const BLOCKED: Starter = { id: 'flag-blocked', on: true };
const REOPEN: Starter = { id: 'reopen-on-comment', on: true };
const TRIAGE: Starter = { id: 'triage-bugs', on: false };
const REVIEWS: Starter = { id: 'route-reviews', on: false };
const FORM: Starter = { id: 'form-responses', on: false };

// Which rules each template starts with, from the Templates gallery: the ones its work needs, on when they only move,
// set, flag, assign or comment and need nothing picked; off when they need people picked first.
export const TEMPLATE_STARTER_RULES: Readonly<Record<StarterRuleKind, readonly Starter[]>> = {
  'project-planner': [STAMP, CLOSE, START, BLOCKED, REVIEWS],
  kanban: [START, BLOCKED, CLOSE, REVIEWS, FORM],
  'bug-triage': [STAMP, REOPEN, BLOCKED, CLOSE, TRIAGE, REVIEWS, FORM],
  'team-retro': [START, DUE],
  'weekly-planner': [BLOCKED, CLOSE],
  'content-calendar': [START, BLOCKED, REVIEWS],
  'hiring-pipeline': [START, BLOCKED, FORM],
  okrs: [BLOCKED, CLOSE],
  'product-launch': [START, BLOCKED, CLOSE],
  'feedback-board': [START, BLOCKED, FORM],
  'event-planner': [DUE, BLOCKED, CLOSE],
  'sales-crm': [START, BLOCKED],
  'help-desk': [REOPEN, START, REVIEWS],
  'meeting-agenda': [START, DUE],
  'personal-goals': [BLOCKED, CLOSE],
  'study-planner': [DUE, BLOCKED],
  'sprint-board': [STAMP, CLOSE, START, BLOCKED, TRIAGE, REVIEWS],
  'client-onboarding': [START, BLOCKED, CLOSE],
  'editorial-pipeline': [START, DUE, BLOCKED],
  'trip-planner': [BLOCKED],
};

// The steps a starter rule may take: a move, a field, a label, a flag, an assignee, a comment. Never an email, a
// webhook, a mention, a new or copied card, an archive or an AI step.
export const STARTER_STEP_KINDS: ReadonlySet<string> = new Set([
  'move',
  'set_field',
  'clear_field',
  'assign',
  'add_label',
  'remove_label',
  'flag',
  'unflag',
  'comment',
]);

export type StarterRule = { body: AutomationRuleBody; on: boolean };

const stepKinds = (steps: readonly AutomationStep[]): string[] =>
  steps.flatMap((s) =>
    'then' in s && Array.isArray(s.then) ? [s.kind, ...stepKinds(s.then)] : [s.kind],
  );

/** Whether every step of `body` is one a starter rule may take. */
export const starterSafe = (body: AutomationRuleBody): boolean =>
  stepKinds(body.steps).every((k) => STARTER_STEP_KINDS.has(k));

/** The plan a template makes, as the Templates gallery's builders read it: its columns, their phases, the card types
 *  its boards bring. */
export function templatePlanOf(kind: PlanTemplateKind, timeZone: string): AutomationTemplatePlan {
  let n = 0;
  const tabs = buildTemplateTabs({ id: 'starter', name: 'Tab 1' }, kind, () => `starter-${++n}`);
  const elements = tabs.flatMap((t) => t.elements);
  const outline = planOutline(tabs, catalogueWithBoardTypes(null, elements));
  const boards = elements.flatMap((e) => {
    const el = e as { shape?: unknown; planBoard?: unknown };
    return el.shape === 'plan-board' ? [el.planBoard] : [];
  });
  return {
    statuses: outline.statuses,
    phases: statusPhasesOf(boards),
    types: outline.types,
    timeZone,
  };
}

/** The starter rules a plan made from `kind` gets, in order, each with whether it is on. A rule whose builder leaves
 *  anything but people to pick on this template's plan is left out, as is one a starter may not take. */
export function templateStarterRules(kind: string, timeZone: string): StarterRule[] {
  if (!hasStarterRules(kind)) return [];
  const plan = templatePlanOf(kind, timeZone);
  return TEMPLATE_STARTER_RULES[kind]
    .map(({ id, on }) => starterOf(automationTemplate(id)!.build(plan), on))
    .filter((r): r is StarterRule => r !== null);
}

/** A gallery rule as a starter: only people may be left to pick, each a whole step at the top of the rule, which is
 *  dropped and the rule shipped off. Null for anything else left to pick, no step left, or a step a starter may not
 *  take. */
export function starterOf(fill: AutomationTemplateFill, on: boolean): StarterRule | null {
  const left = picksLeft(fill.body, fill.picks);
  const people = left.map((p) =>
    p.pick === 'people' ? /^steps\.(\d+)$/.exec(p.path)?.[1] : undefined,
  );
  if (people.some((i) => i === undefined)) return null;
  const dropped = new Set(people.map(Number));
  const body = { ...fill.body, steps: fill.body.steps.filter((_, i) => !dropped.has(i)) };
  if (body.steps.length === 0 || !starterSafe(body)) return null;
  return { body, on: on && dropped.size === 0 };
}
