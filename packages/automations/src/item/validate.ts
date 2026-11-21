// An item's rule, checked (liveworkspace/docs/specs/018-automations/automations.md "A rule", "Revert to Snapshot",
// "Values", "Runs, limits and loops"; blueprint item-engine.md "The check"). Stage 1's shell with the kinds' own
// readers, and the rules that hold over the rule as a whole: where a step that ends the run may stand, where a
// value a Summarise step makes may be read, and what a rule keeps of the item's snapshots. Pure.

import { AUTOMATION_CONDITIONS_MAX } from '../limits';
import type { AutomationKind } from '../types';
import {
  checkActionsCap,
  checkStepCaps,
  countActions,
  readRuleShell,
  stepActions,
} from '../validate';
import {
  Refused,
  isObj,
  obj,
  refuse,
  unsupported,
  type Obj,
  type RuleRefusal,
} from '../validate-read';
import { unknownValueIn, valuesIn } from '../values';
import type { ItemKinds, ItemReadContext } from './kinds';
import { ownRefsOf, refsOf, type ItemOwnRef, type ItemRef } from './refs';
import {
  AUTOMATION_KEPT_SNAPSHOTS_MAX,
  type ItemIf,
  type ItemPart,
  type ItemRuleBody,
} from './types';
import { itemValueKnown } from './values';

const kindOf = (o: Obj): string => (typeof o['kind'] === 'string' ? o['kind'] : '');

/** The values a part names: each `{{…}}` in a string it holds, and a Text condition's own `value`. */
export function itemValueNames(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(...valuesIn(value));
  else if (Array.isArray(value)) for (const x of value) itemValueNames(x, out);
  else if (isObj(value)) {
    if (value['kind'] === 'text' && typeof value['value'] === 'string') out.push(value['value']);
    for (const x of Object.values(value)) itemValueNames(x, out);
  }
  return out;
}

// The readers of one rule, made once its trigger is read.
function readersOf(kinds: ItemKinds, trigger: ItemPart) {
  const personless = kinds.trigger(trigger.kind)!.personless === true;
  // Whether a Summarise step comes first is checked over the whole rule (checkRule), once every step is read.
  const known = (name: string) => itemValueKnown(kinds, { trigger, afterAi: true }, name);
  const conditions = (value: unknown, path: string): ItemPart[] => {
    if (!Array.isArray(value) || value.length > AUTOMATION_CONDITIONS_MAX)
      refuse(path, `${path} must be a list of up to ${AUTOMATION_CONDITIONS_MAX} conditions`);
    return (value as unknown[]).map((raw, i) => {
      const at = `${path}.${i}`;
      const o = obj(raw, at);
      const def =
        kinds.condition(kindOf(o)) ?? refuse(`${at}.kind`, `${at}.kind is not a condition`);
      if (def.personal && personless)
        unsupported(
          'automation_condition_unsupported',
          at,
          `nobody is behind this trigger, so ${def.name} never holds`,
        );
      return def.read(o, at, ctx);
    });
  };
  const step = (value: unknown, path: string, top: boolean): ItemPart => {
    const o = obj(value, path);
    const def = kinds.action(kindOf(o)) ?? refuse(`${path}.kind`, `${path}.kind is not a step`);
    if (def.top && !top)
      unsupported('automation_step_unsupported', path, `an If can't hold ${def.kind}`);
    return def.read(o, path, ctx);
  };
  const ctx: ItemReadContext = {
    trigger,
    personless,
    known,
    text: { unknownValue: (text) => unknownValueIn(text, known) },
    conditions,
    action: (value, path) => step(value, path, false),
  };
  return { conditions, step };
}

// A value only a Summarise step makes, named in `part`.
const summaryIn = (kinds: ItemKinds, part: unknown): string | undefined =>
  itemValueNames(part).find((name) => kinds.value(name)?.afterAi === true);

// The checks over the rule read whole.
function checkRule(kinds: ItemKinds, rule: { conditions: ItemPart[]; steps: ItemPart[] }): void {
  checkActionsCap(rule.steps);
  checkStepCaps(rule.steps);
  const early = (path: string, name: string): never => {
    throw new Refused({
      error: 'automation_value_unknown',
      path,
      message: `{{${name}}} needs a Summarise with AI step before it`,
    });
  };
  const inConditions = summaryIn(kinds, rule.conditions);
  if (inConditions) early('conditions', inConditions);
  const end = rule.steps.length - 1;
  let summarised = false;
  rule.steps.forEach((step, i) => {
    const path = `steps.${i}`;
    const named = summarised ? undefined : summaryIn(kinds, step);
    if (named) early(path, named);
    if (step.kind === 'ai') summarised = true;
    const ended = (kind: string, at: string, isLast: boolean) => {
      const def = kinds.action(kind)!;
      if (def.last && !isLast)
        unsupported('automation_step_unsupported', at, `${def.name} must be the rule's last step`);
    };
    if (step.kind !== 'if') return ended(step.kind, path, i === end);
    const branch = step as unknown as ItemIf;
    for (const list of ['then', 'else'] as const)
      branch[list].forEach((action, j) =>
        ended(action.kind, `${path}.${list}.${j}`, i === end && j === branch[list].length - 1),
      );
  });
}

/** The rule as it is kept (unknown keys dropped), or the first refusal with the `path` of the part at fault. */
export function readItemRule(
  value: unknown,
  kinds: ItemKinds,
): { body: ItemRuleBody } | RuleRefusal {
  let readers: ReturnType<typeof readersOf> | undefined;
  return readRuleShell<ItemPart, ItemPart, ItemPart>(value, {
    trigger: (raw) => {
      const o = obj(raw, 'trigger');
      const def =
        kinds.trigger(kindOf(o)) ?? refuse('trigger.kind', 'trigger.kind is not a trigger');
      const trigger = def.read(o, 'trigger');
      readers = readersOf(kinds, trigger);
      return trigger;
    },
    conditions: (raw, path) => readers!.conditions(raw, path),
    step: (raw, path) => readers!.step(raw, path, true),
    check: (rule) => checkRule(kinds, rule),
  });
}

type Steps = { steps: readonly AutomationKind[] };

/** Whether the rule has a step to run: one with none is kept off. */
export const ruleHasStep = (rule: Steps): boolean => countActions(rule.steps) > 0;

/** Whether only a person may save the rule: it holds a step an API token may not (Revert to Snapshot). */
export const ruleNeedsPerson = (rule: Steps, kinds: ItemKinds): boolean =>
  rule.steps.some((s) => stepActions(s).some((a) => kinds.action(a.kind)?.needsPerson === true));

/** The snapshots the rules name, on or off: the ones the item keeps for them. */
export function ruleSnapshotIds(rules: readonly Steps[]): string[] {
  const ids = new Set<string>();
  for (const rule of rules)
    for (const ref of refsOf(rule.steps)) if (ref.kind === 'snapshot' && ref.id) ids.add(ref.id);
  return [...ids];
}

/** Whether the rules would keep more snapshots than an item keeps for its rules. */
export const snapshotsFull = (rules: readonly Steps[]): boolean =>
  ruleSnapshotIds(rules).length > AUTOMATION_KEPT_SNAPSHOTS_MAX;

/** What the rule names that is still to pick: left empty by a template, a copy or a file. */
export const ruleUnpicked = (
  rule: Pick<ItemRuleBody, 'trigger' | 'conditions' | 'steps'>,
): ItemRef[] =>
  refsOf({ trigger: rule.trigger, conditions: rule.conditions, steps: rule.steps }).filter(
    (ref) => ref.id === '',
  );

/** The references of the app's own the rule still has to pick, each kind once. */
export function ruleOwnUnpicked(
  rule: Pick<ItemRuleBody, 'trigger' | 'conditions' | 'steps'>,
  kinds: Pick<ItemKinds, 'ownRefs'>,
): ItemOwnRef[] {
  const empty = new Set(
    ownRefsOf(
      { trigger: rule.trigger, conditions: rule.conditions, steps: rule.steps },
      kinds.ownRefs,
    )
      .filter((ref) => ref.id === '')
      .map((ref) => ref.field),
  );
  return (kinds.ownRefs ?? []).filter((own) => empty.has(own.field));
}

/** Whether anything the rule names is still to pick: a rule is not turned on until nothing is. */
export const ruleLeftToPick = (
  rule: Pick<ItemRuleBody, 'trigger' | 'conditions' | 'steps'>,
  kinds: Pick<ItemKinds, 'ownRefs'>,
): boolean => ruleUnpicked(rule).length > 0 || ruleOwnUnpicked(rule, kinds).length > 0;
