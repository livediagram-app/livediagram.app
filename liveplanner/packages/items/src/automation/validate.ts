// Automations: a rule as a person wrote it, checked (docs/specs/026-plan/automations.md "A rule", "Limits"; blueprint
// automations.md "Files", "Routes"). `readRuleBody` answers the rule as it is kept (unknown keys dropped), or the first
// refusal with the `path` of the part at fault (`steps.2.text`) for the builder to mark. What a rule names that the
// plan lacks is not a refusal: it needs attention (attention.ts). Also the rule's name rules. Pure.

import {
  CROSS_APP_KINDS,
  CROSS_APP_READERS,
  isCrossAppKind,
} from '@liveworkspace/automations/cross-app';
import { isSnapshotKind, readSnapshotStep, SNAPSHOT_KINDS } from '@liveworkspace/automations/item';
import {
  checkActionsCap,
  checkStepCaps,
  readActions as readActionList,
  readIf,
  readNotify,
  readRuleShell,
  readWait,
  stepActions as sharedStepActions,
} from '@liveworkspace/automations';
import { ITEM_CHECKLIST_TEXT_MAX, ITEM_LABEL_MAX, ITEM_TITLE_MAX } from '../limits';
import { itemColourValue } from '../item-colour';
import {
  AUTOMATION_BRANCH_ACTIONS_MAX,
  AUTOMATION_CREATED_PER_RUN,
  AUTOMATION_EMAIL_ADDRESSES_MAX,
  AUTOMATION_ROTATE_MAX,
  AUTOMATION_ROTATE_MIN,
  AUTOMATION_TEXT_MAX,
  isGithubTrigger,
  isPersonless,
  isTimeTrigger,
  AUTOMATION_CHECKLIST_ITEMS_MAX,
  AUTOMATION_TYPE_MAPS_MAX,
  type AutomationAction,
  type AutomationAi,
  type AutomationBranch,
  type AutomationCondition,
  type AutomationOutgoing,
  type AutomationRelated,
  type AutomationRuleBody,
  type AutomationSetValue,
  type AutomationStep,
  type AutomationTrigger,
} from './types';
import { unknownValueIn, type ValuePlace } from './values';
import { readAiStep } from './ai-steps';
import { AUTOMATION_SUBJECT_MAX, automationAddress } from '@liveworkspace/automations';
import {
  day,
  id,
  ids,
  obj,
  optionalIds,
  refuse,
  text,
  unsupported,
  type Obj,
  type RuleRefusal,
} from './validate-read';
import { readConditions, readTrigger } from './validate-conditions';
import { runsForPlan } from './incoming';

export { AUTOMATION_LIST_MAX, type RuleRefusal } from './validate-read';
// The shell of the check (name, time zone, chain, the caps every app shares) and a rule's name rules are
// @liveworkspace/automations' (liveworkspace/docs/specs/018-automations/blueprints/engine.md "The check").
export { AUTOMATION_SUBJECT_MAX, freeRuleName, ruleNameTaken } from '@liveworkspace/automations';

const COPIES = new Set(['assignee', 'labels', 'due']);
// The steps a branch may not hold, and an If / Else's actions neither.
// A step in another app is the rule's top level's alone.
const NOT_IN_BRANCH = new Set([
  'if',
  'for',
  'create_card',
  'copy_card',
  'notify',
  'ai',
  'wait',
  ...CROSS_APP_KINDS,
  ...SNAPSHOT_KINDS,
]);
const NOT_IN_IF = new Set([
  'if',
  'for',
  'notify',
  'ai',
  'wait',
  ...CROSS_APP_KINDS,
  ...SNAPSHOT_KINDS,
]);

function readSetValue(v: unknown, path: string, place: ValuePlace): AutomationSetValue {
  const o = obj(v, path);
  if (o['text'] !== undefined)
    return { text: text(o['text'], `${path}.text`, AUTOMATION_TEXT_MAX, place) };
  if (o['number'] !== undefined) {
    if (typeof o['number'] !== 'number' || !Number.isFinite(o['number']))
      refuse(`${path}.number`, `${path}.number must be a number`);
    return { number: o['number'] as number };
  }
  if (o['list'] !== undefined) return { list: ids(o['list'], `${path}.list`) };
  if (o['date'] !== undefined) return { date: day(o['date'], `${path}.date`) };
  if (o['from'] !== undefined) return { from: id(o['from'], `${path}.from`) };
  return refuse(path, `${path} must be text, a number, a list, a day or a field`);
}

// Send Email's typed-in addresses (spec "Typed-in addresses"): 1 to AUTOMATION_EMAIL_ADDRESSES_MAX, each an address
// (automationAddress), kept lower case and once each.
function readAddresses(v: unknown, path: string): string[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > AUTOMATION_EMAIL_ADDRESSES_MAX)
    refuse(path, `${path} must hold 1 to ${AUTOMATION_EMAIL_ADDRESSES_MAX} email addresses`);
  const out: string[] = [];
  (v as unknown[]).forEach((raw, i) => {
    const address = typeof raw === 'string' ? automationAddress(raw) : null;
    if (address === null) refuse(`${path}.${i}`, `${path}.${i} is not an email address`);
    if (!out.includes(address!)) out.push(address!);
  });
  return out;
}

function readRotate(v: unknown, path: string): string[] {
  if (!Array.isArray(v)) refuse(path, `${path} must be a list of people`);
  const people = ids(v, path);
  if (people.length < AUTOMATION_ROTATE_MIN || people.length > AUTOMATION_ROTATE_MAX)
    refuse(path, `${path} must name ${AUTOMATION_ROTATE_MIN} to ${AUTOMATION_ROTATE_MAX} people`);
  return people;
}

// The actions readAction reads, as a refusal lists them.
const ACTION_KINDS: readonly AutomationAction['kind'][] = [
  'move',
  'set_field',
  'clear_field',
  'assign',
  'add_label',
  'remove_label',
  'comment',
  'flag',
  'unflag',
  'archive',
  'create_card',
  'email',
  'set_type',
  'set_colour',
  'restore',
  'resolve_threads',
  'copy_card',
  'add_checklist',
  'link_card',
  'mention',
];

function readAction(v: unknown, path: string, place: ValuePlace = {}): AutomationAction {
  const a = obj(v, path);
  const text_ = (x: unknown, p: string, max: number) => text(x, p, max, place);
  switch (a['kind']) {
    case 'move':
      return { kind: 'move', status: id(a['status'], `${path}.status`) };
    case 'set_field':
      return {
        kind: 'set_field',
        field: id(a['field'], `${path}.field`),
        value: readSetValue(a['value'], `${path}.value`, place),
      };
    case 'clear_field':
      return { kind: 'clear_field', field: id(a['field'], `${path}.field`) };
    case 'assign': {
      const to = obj(a['to'], `${path}.to`);
      if (to['person'] !== undefined)
        return { kind: 'assign', to: { person: id(to['person'], `${path}.to.person`) } };
      if (to['trigger'] === true) return { kind: 'assign', to: { trigger: true } };
      if (to['nobody'] === true) return { kind: 'assign', to: { nobody: true } };
      if (to['rotate'] !== undefined)
        return { kind: 'assign', to: { rotate: readRotate(to['rotate'], `${path}.to.rotate`) } };
      return refuse(
        `${path}.to`,
        `${path}.to must be a person, whoever triggered it, nobody, or people in turn`,
      );
    }
    case 'add_label':
    case 'remove_label':
      return { kind: a['kind'], label: text_(a['label'], `${path}.label`, ITEM_LABEL_MAX).trim() };
    case 'comment':
      return { kind: 'comment', text: text_(a['text'], `${path}.text`, AUTOMATION_TEXT_MAX) };
    case 'flag':
    case 'unflag':
    case 'archive':
      return { kind: a['kind'] };
    case 'create_card': {
      const copy = optionalIds(a['copy'], `${path}.copy`);
      if (copy?.some((c) => !COPIES.has(c)))
        refuse(`${path}.copy`, `${path}.copy copies assignee, labels or due`);
      return {
        kind: 'create_card',
        type: id(a['type'], `${path}.type`),
        title: text_(a['title'], `${path}.title`, ITEM_TITLE_MAX),
        ...(a['status'] !== undefined ? { status: id(a['status'], `${path}.status`) } : {}),
        ...(copy?.length ? { copy: copy as ('assignee' | 'labels' | 'due')[] } : {}),
        ...(a['linkField'] !== undefined
          ? { linkField: id(a['linkField'], `${path}.linkField`) }
          : {}),
      };
    }
    case 'email': {
      const to = obj(a['to'], `${path}.to`);
      const recipient =
        to['assignee'] === true
          ? { assignee: true as const }
          : to['trigger'] === true
            ? { trigger: true as const }
            : to['person'] !== undefined
              ? { person: id(to['person'], `${path}.to.person`) }
              : to['addresses'] !== undefined
                ? { addresses: readAddresses(to['addresses'], `${path}.to.addresses`) }
                : refuse(
                    `${path}.to`,
                    `${path}.to must be the assignee, whoever triggered it, a person, or addresses`,
                  );
      return {
        kind: 'email',
        to: recipient,
        subject: text_(a['subject'], `${path}.subject`, AUTOMATION_SUBJECT_MAX),
        body: text_(a['body'], `${path}.body`, AUTOMATION_TEXT_MAX),
      };
    }
    case 'set_type': {
      const map = a['map'] === undefined ? undefined : readTypeMap(a['map'], `${path}.map`);
      return {
        kind: 'set_type',
        type: id(a['type'], `${path}.type`),
        ...(map?.length ? { map } : {}),
      };
    }
    case 'set_colour': {
      if (a['colour'] === null) return { kind: 'set_colour', colour: null };
      const colour = itemColourValue(a['colour']);
      return colour
        ? { kind: 'set_colour', colour }
        : refuse(`${path}.colour`, `${path}.colour must be a #rrggbb colour or null`);
    }
    case 'restore':
    case 'resolve_threads':
      return { kind: a['kind'] };
    case 'copy_card':
      return {
        kind: 'copy_card',
        ...(a['status'] !== undefined ? { status: id(a['status'], `${path}.status`) } : {}),
      };
    case 'add_checklist': {
      const items = a['items'];
      if (
        !Array.isArray(items) ||
        items.length === 0 ||
        items.length > AUTOMATION_CHECKLIST_ITEMS_MAX
      )
        refuse(
          `${path}.items`,
          `${path}.items must hold 1 to ${AUTOMATION_CHECKLIST_ITEMS_MAX} items`,
        );
      // text() refuses a blank item, so each one trimmed still holds text.
      const read = (items as unknown[]).map((t, i) =>
        text_(t, `${path}.items.${i}`, ITEM_CHECKLIST_TEXT_MAX).trim(),
      );
      return { kind: 'add_checklist', items: read };
    }
    case 'link_card': {
      const to = obj(a['to'], `${path}.to`);
      const target =
        to['trigger'] === true
          ? { trigger: true as const }
          : to['card'] !== undefined
            ? { card: id(to['card'], `${path}.to.card`) }
            : refuse(`${path}.to`, `${path}.to must be a card or the card that started the rule`);
      return { kind: 'link_card', field: id(a['field'], `${path}.field`), to: target };
    }
    case 'mention': {
      const to = obj(a['to'], `${path}.to`);
      const recipient =
        to['assignee'] === true
          ? { assignee: true as const }
          : to['trigger'] === true
            ? { trigger: true as const }
            : to['person'] !== undefined
              ? { person: id(to['person'], `${path}.to.person`) }
              : refuse(
                  `${path}.to`,
                  `${path}.to must be the assignee, whoever triggered it, or a person`,
                );
      return {
        kind: 'mention',
        to: recipient,
        text: text_(a['text'], `${path}.text`, AUTOMATION_TEXT_MAX),
      };
    }
    default:
      return refuse(
        `${path}.kind`,
        `${path}.kind is not an action (the actions: ${ACTION_KINDS.join(', ')})`,
      );
  }
}

// Change Card Type's mappings: 0 to AUTOMATION_TYPE_MAPS_MAX `{ from, to }`, each target once.
function readTypeMap(raw: unknown, path: string): { from: string; to: string }[] {
  if (!Array.isArray(raw) || raw.length > AUTOMATION_TYPE_MAPS_MAX)
    refuse(path, `${path} must hold up to ${AUTOMATION_TYPE_MAPS_MAX} mappings`);
  const seen = new Set<string>();
  return (raw as unknown[]).map((m, i) => {
    const o = obj(m, `${path}.${i}`);
    const to = id(o['to'], `${path}.${i}.to`);
    if (seen.has(to))
      refuse(`${path}.${i}.to`, `${path}.${i}.to names a field another mapping fills`);
    seen.add(to);
    return { from: id(o['from'], `${path}.${i}.from`), to };
  });
}

// The actions of an If / Else or a branch: never a step `refused` names (said as `where`).
const readActions = (
  v: unknown,
  path: string,
  refused: ReadonlySet<string>,
  where: string,
  place: ValuePlace = {},
): AutomationAction[] =>
  readActionList(v, path, refused, where, (a, at) => readAction(a, at, place));

function readRelated(v: unknown, path: string): AutomationRelated {
  const r = obj(v, path);
  switch (r['kind']) {
    case 'linked':
      return r['field'] === undefined
        ? { kind: 'linked' }
        : { kind: 'linked', field: id(r['field'], `${path}.field`) };
    case 'blocked_by':
    case 'blocking':
    case 'children':
      return { kind: r['kind'] };
    case 'saved_filter':
      return {
        kind: 'saved_filter',
        tab: id(r['tab'], `${path}.tab`),
        filter: id(r['filter'], `${path}.filter`),
      };
    default:
      return refuse(`${path}.kind`, `${path}.kind is not a way to pick related cards`);
  }
}

function readBranch(s: Obj, path: string, place: ValuePlace): AutomationBranch {
  const then = readActions(s['then'], `${path}.then`, NOT_IN_BRANCH, 'a branch', {
    ...place,
    branch: true,
  });
  if (then.length === 0 || then.length > AUTOMATION_BRANCH_ACTIONS_MAX)
    refuse(`${path}.then`, `a branch holds 1 to ${AUTOMATION_BRANCH_ACTIONS_MAX} actions`);
  return {
    kind: 'for',
    related: readRelated(s['related'], `${path}.related`),
    conditions: readConditions(s['conditions'] ?? [], `${path}.conditions`),
    then,
  };
}

// `place`: an Incoming Webhook rule's text may name the call's values.
function readStep(v: unknown, path: string, place: ValuePlace): AutomationStep {
  const s = obj(v, path);
  if (s['kind'] === 'notify')
    return readNotify(s, path, { unknownValue: (t) => unknownValueIn(t, place) });
  if (s['kind'] === 'for') return readBranch(s, path, place);
  if (isCrossAppKind(s['kind']))
    return CROSS_APP_READERS[s['kind']]!(s, path, {
      unknownValue: (t) => unknownValueIn(t, place),
    });
  if (isSnapshotKind(s['kind']))
    return readSnapshotStep(s, path, { unknownValue: (t) => unknownValueIn(t, place) });
  if (s['kind'] === 'wait') return readWait(s, path);
  if (s['kind'] === 'ai') {
    const read = readAiStep(s);
    return 'step' in read ? read.step : refuse(`${path}${read.path}`, read.message);
  }
  if (s['kind'] !== 'if') return readAction(s, path, place);
  return readIf(s, path, {
    conditions: readConditions,
    action: (a, at) => readAction(a, at, place),
    refused: NOT_IN_IF,
  });
}

const makesCard = (a: { kind: string }) => a.kind === 'create_card' || a.kind === 'copy_card';
const creates = (actions: readonly AutomationAction[]) => actions.filter(makesCard).length;

// The actions a step holds: an If / Else's both lists, a branch's, else the step itself.
export function stepActions(
  s: AutomationStep,
): readonly (AutomationAction | AutomationOutgoing | AutomationAi)[] {
  // An If / Else's both lists, none for a Wait, else the step itself: as every app's steps count.
  return s.kind === 'for'
    ? s.then
    : (sharedStepActions(s) as (AutomationAction | AutomationOutgoing | AutomationAi)[]);
}

// How many actions the steps hold, counting those inside an If / Else and a branch.
export function countActions(steps: readonly AutomationStep[]): number {
  return steps.reduce((n, s) => n + stepActions(s).length, 0);
}

// The most cards one run of the steps could make: the top level's, and the larger branch of each If (a branch makes
// none).
function createsPerRun(steps: readonly AutomationStep[]): number {
  return steps.reduce(
    (n, s) =>
      n + (s.kind === 'if' ? Math.max(creates(s.then), creates(s.else)) : makesCard(s) ? 1 : 0),
    0,
  );
}

// A time trigger, an incoming webhook or a GitHub trigger (`who` says which) has no person behind it: no Who Did It
// condition, and nobody to assign or email as whoever triggered it, anywhere in the rule.
function checkPersonless(
  conditions: readonly AutomationCondition[],
  steps: readonly AutomationStep[],
  who: string,
) {
  const no = (path: string, what: string) =>
    unsupported('automation_condition_unsupported', path, `${who} has no ${what}`);
  const checkConditions = (list: readonly AutomationCondition[], path: string) =>
    list.forEach((c, i) => {
      if (c.kind === 'who') no(`${path}.${i}`, 'person behind it to check');
    });
  checkConditions(conditions, 'conditions');
  steps.forEach((s, i) => {
    if (s.kind === 'if' || s.kind === 'for') checkConditions(s.conditions, `steps.${i}.conditions`);
    for (const a of stepActions(s))
      if ((a.kind === 'assign' || a.kind === 'email' || a.kind === 'mention') && 'trigger' in a.to)
        no(`steps.${i}`, 'person who triggered it');
  });
}

// Whether the rule does something: an action anywhere in its steps. A rule turns on at its first save with one.
export const ruleHasAction = (body: Pick<AutomationRuleBody, 'steps'>): boolean =>
  countActions(body.steps) > 0;

// The values a rule's texts may hold, from its trigger.
const placeOf = (trigger: AutomationTrigger): ValuePlace =>
  trigger.kind === 'incoming_webhook'
    ? { webhook: true }
    : isGithubTrigger(trigger)
      ? { github: true }
      : trigger.kind === 'email_received'
        ? { email: true }
        : trigger.kind === 'form_response'
          ? { form: true }
          : {};

// Take Snapshot and Revert to Snapshot (spec "Snapshot steps"): a revert is the rule's last step; on a time trigger
// either runs once for the plan (a Scheduled rule with no conditions and no card steps), never once for each card.
function checkSnapshotSteps(rule: Pick<AutomationRuleBody, 'trigger' | 'conditions' | 'steps'>) {
  const { steps } = rule;
  steps.forEach((s, i) => {
    if (s.kind === 'revert_snapshot' && i !== steps.length - 1)
      refuse(`steps.${i}`, "Revert to Snapshot is the rule's last step: nothing may follow it");
  });
  if (!isTimeTrigger(rule.trigger) || runsForPlan(rule)) return;
  const at = steps.findIndex((s) => isSnapshotKind(s.kind));
  if (at >= 0)
    refuse(
      `steps.${at}`,
      'A snapshot step on a time trigger runs once for the plan: only on a Scheduled rule with no conditions and no card steps',
    );
}

// The checks over the rule read whole, in the order their refusals answer: the shared caps, with the cards a run
// may make between them; then what only a branch may hold and what a trigger with no person behind it may not.
function checkRule(rule: {
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  steps: AutomationStep[];
}): void {
  const { trigger, conditions, steps } = rule;
  checkActionsCap(steps, stepActions);
  if (createsPerRun(steps) > AUTOMATION_CREATED_PER_RUN)
    refuse('steps', `a run makes up to ${AUTOMATION_CREATED_PER_RUN} card`);
  checkStepCaps(steps);
  // Link to the card that started the rule: a branch's alone (outside one, that is the card itself).
  steps.forEach((s, i) => {
    if (s.kind === 'for') return;
    for (const a of stepActions(s))
      if (a.kind === 'link_card' && 'trigger' in a.to)
        refuse(`steps.${i}`, 'only a branch links to the card that started the rule');
  });
  checkSnapshotSteps(rule);
  if (isPersonless(trigger))
    checkPersonless(
      conditions,
      steps,
      isTimeTrigger(trigger)
        ? 'A time trigger'
        : isGithubTrigger(trigger)
          ? 'A GitHub trigger'
          : trigger.kind === 'email_received'
            ? 'Email Received'
            : 'An incoming webhook',
    );
}

export function readRuleBody(v: unknown): { body: AutomationRuleBody } | RuleRefusal {
  return readRuleShell<AutomationTrigger, AutomationCondition, AutomationStep>(v, {
    trigger: readTrigger,
    conditions: readConditions,
    step: (s, path, trigger) => readStep(s, path, placeOf(trigger)),
    check: checkRule,
  });
}
