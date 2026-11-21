// An item's rule as a Participant or a Viewer reads it (liveworkspace/docs/specs/018-automations/automations.md "Who
// may do what"; blueprint item-engine.md "Words"), on stage 1's allow-listed shell: each step by its kind's own
// reader's words, never a typed-in address, a connection's name or what an AI step is asked. Pure.

import {
  looksLikeAddress,
  ruleSummary,
  type AutomationRuleSummary,
  type AutomationSummaryLine,
  type AutomationSummaryStep,
} from '../summary';
import type { AutomationOutgoing } from '../types';
import type { ItemKinds } from './kinds';
import type { ItemNames } from './names';
import type { ItemIf, ItemPart, ItemRule } from './types';
import { conditionWords, sentenceText, triggerWords } from './words';

function lineOf(kinds: ItemKinds, step: ItemPart, names: ItemNames): AutomationSummaryLine {
  const def = kinds.action(step.kind);
  return {
    kind: step.kind,
    ...(step.kind === 'notify' ? { via: (step as unknown as AutomationOutgoing).via } : {}),
    words: def?.summary?.(step, names) ?? def?.name ?? step.kind,
  };
}

// A condition's words, or its kind's name when they would show an address.
function conditionLine(kinds: ItemKinds, condition: ItemPart, names: ItemNames): string {
  const words = sentenceText(conditionWords(kinds, condition, names));
  // Only a kind the registry holds says anything of its own: one it lacks reads as its kind, which is no address.
  return looksLikeAddress(words) ? kinds.condition(condition.kind)!.name : words;
}

function stepOf(kinds: ItemKinds, step: ItemPart, names: ItemNames): AutomationSummaryStep {
  const line = lineOf(kinds, step, names);
  if (step.kind !== 'if') return line;
  const branch = step as unknown as ItemIf;
  return {
    ...line,
    conditions: branch.conditions.map((c) => conditionLine(kinds, c, names)),
    then: branch.then.map((a) => lineOf(kinds, a, names)),
    else: branch.else.map((a) => lineOf(kinds, a, names)),
  };
}

/** The summary of `rule`: no id but its own, no address, no connection, no AI ask. */
export function itemRuleSummary(
  rule: ItemRule,
  kinds: ItemKinds,
  names: ItemNames,
): AutomationRuleSummary {
  return ruleSummary(rule, {
    trigger: sentenceText(triggerWords(kinds, rule.trigger, names)),
    picks: false,
    conditions: rule.conditions.map((c) => conditionLine(kinds, c, names)),
    steps: rule.steps.map((s) => stepOf(kinds, s, names)),
  });
}
