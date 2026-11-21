// An item's rule in words (blueprint item-engine.md "Words"): the Rules list's sentence, a run's first line, the
// format agents and Describe a Rule are told, and what a rule names that the item lacks. Every word comes from the
// kinds' own definitions. Pure.

import { AUTOMATION_ACTIONS_MAX, AUTOMATION_CONDITIONS_MAX } from '../limits';
import type { AutomationPerson } from '../types';
import { AUTOMATION_SHARED_VALUE_NAMES } from '../values';
import { waitWords, type RuleSentencePart } from '../words';
import type { ItemKinds } from './kinds';
import { UNPICKED_NAMES, type ItemNames, type ItemRefKind } from './names';
import { refsOf, type ItemOwnRef, type ItemRef } from './refs';
import { ITEM_RESUME_EVENT, type ItemEvent, type ItemPart, type ItemRuleBody } from './types';

type RuleParts = Pick<ItemRuleBody, 'trigger' | 'conditions' | 'steps'>;

// A part of a kind the registry lacks (an app's kind since removed) reads as its kind.
const unknownPart = (part: ItemPart): RuleSentencePart[] => [{ chip: part.kind }];

export const triggerWords = (kinds: ItemKinds, part: ItemPart, names: ItemNames) =>
  kinds.trigger(part.kind)?.words(part, names) ?? unknownPart(part);
export const conditionWords = (kinds: ItemKinds, part: ItemPart, names: ItemNames) =>
  kinds.condition(part.kind)?.words(part, names) ?? unknownPart(part);
export const stepWords = (kinds: ItemKinds, part: ItemPart, names: ItemNames) =>
  kinds.action(part.kind)?.words(part, names) ?? unknownPart(part);

/** Parts as one line of text. */
export const sentenceText = (parts: readonly RuleSentencePart[]): string =>
  parts.map((p) => ('word' in p ? p.word : p.chip)).join(' ');

/** The Rules list's sentence: "When … only if … and … then … and …". */
export function itemRuleSentence(
  rule: RuleParts,
  kinds: ItemKinds,
  names: ItemNames,
): RuleSentencePart[] {
  const out: RuleSentencePart[] = [{ word: 'When' }, ...triggerWords(kinds, rule.trigger, names)];
  rule.conditions.forEach((c, i) =>
    out.push({ word: i === 0 ? 'only if' : 'and' }, ...conditionWords(kinds, c, names)),
  );
  rule.steps.forEach((s, i) =>
    out.push({ word: i === 0 ? 'then' : 'and' }, ...stepWords(kinds, s, names)),
  );
  return out;
}

/** A run's first line on the Audit Trail: what started it, and who. */
export function itemTriggerLine(
  rule: Pick<ItemRuleBody, 'trigger'>,
  event: ItemEvent,
  kinds: ItemKinds,
  names: ItemNames,
): { kind: 'trigger'; text: string; by?: AutomationPerson } {
  if (event.kind === ITEM_RESUME_EVENT) {
    const waited = waitWords(event.waited ?? 1)
      .replace('Wait ', 'waiting ')
      .toLowerCase();
    return { kind: 'trigger', text: `After ${waited}` };
  }
  const text = kinds.trigger(rule.trigger.kind)?.said(rule.trigger, event, names);
  return {
    kind: 'trigger',
    text: text ?? rule.trigger.kind,
    ...(event.by ? { by: event.by } : {}),
  };
}

/** The rule body's format in prose, for an agent's tool description and Describe a Rule's model. */
export function itemRuleFormat(kinds: ItemKinds): {
  trigger: string;
  conditions: string;
  steps: string;
} {
  const personless = kinds.triggers.filter((t) => t.personless).map((t) => t.kind);
  const values = [
    ...kinds.values.map(
      (v) =>
        `{{${v.name}}}${v.under ? ` (only under ${v.under.join(', ')})` : ''}${v.afterAi ? ' (only after an ai step)' : ''}`,
    ),
    ...AUTOMATION_SHARED_VALUE_NAMES.map((name) => `{{${name}}}`),
    '{{now + Nd}} and {{now - Nd}} (a day N days from today)',
  ];
  return {
    trigger:
      `What starts the rule, exactly one: ${kinds.triggers.map((t) => t.format).join('; ')}. ` +
      `Nobody is behind ${personless.join(', ')}: such a rule holds no who condition and no email to "trigger".`,
    conditions:
      `Up to ${AUTOMATION_CONDITIONS_MAX}, every one must hold: ` +
      `${kinds.conditions.map((c) => c.format).join('; ')}. Defaults to none.`,
    steps:
      `Up to ${AUTOMATION_ACTIONS_MAX} actions, run in order: ${kinds.actions.map((a) => a.format).join('; ')}. ` +
      `A step's text may hold values: ${values.join(', ')}.`,
  };
}

/** The kinds whose format does not show their own kind: an agent could never write them. A test holds this empty. */
export const undescribedKinds = (kinds: ItemKinds): string[] =>
  [...kinds.triggers, ...kinds.conditions, ...kinds.actions]
    .filter((k) => !k.format.includes(`"kind":"${k.kind}"`))
    .map((k) => k.kind);

// ---- What a rule needs ----------------------------------------------------------------------------------------------

// What the item has, by id; a list the caller lacks is not checked.
export type ItemHave = Partial<Record<ItemRefKind, ReadonlySet<string>>>;

/** What the rule names that the item lacks (gone), or has still to pick (an empty id), each once, in order. */
export const ruleNeeds = (rule: RuleParts, have: ItemHave): ItemRef[] =>
  refsOf({ trigger: rule.trigger, conditions: rule.conditions, steps: rule.steps }).filter(
    (ref) => ref.id === '' || have[ref.kind]?.has(ref.id) === false,
  );

const NEED_WORDS: Readonly<Record<ItemRefKind, string>> = {
  tab: 'Tab',
  snapshot: 'Snapshot',
  connection: 'Connection',
  template: 'Template',
  person: 'Person',
};

/** A need as a line for agents, by stored id: "Tab t1 is gone", "Pick a snapshot". */
export const needLine = (need: ItemRef): string =>
  need.id === ''
    ? `Pick ${UNPICKED_NAMES[need.kind]}`
    : `${NEED_WORDS[need.kind]} ${need.id} is gone`;

/** A need of the app's own as a line for agents: "Version v1 is gone", "Pick a version". */
export const ownNeedLine = (own: ItemOwnRef, id: string): string =>
  id === '' ? `Pick ${own.noun}` : `${own.title} ${id} is gone`;
