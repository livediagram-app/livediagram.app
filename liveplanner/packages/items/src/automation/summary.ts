// A rule as a Participant or a Viewer reads it (docs/specs/026-plan/automations.md "On cards", "Who may do what"): its
// name, whether it is on, its trigger in words, its conditions and its steps in order, and who made it and when. Built
// from an allow-list, never the stored rule with parts taken out: each line is words the sentence makes (sentence.ts),
// and what a reader must not see reads as a plain label instead: typed-in email addresses ("Email 2 Addresses"), where
// an outgoing action posts ("Post to Slack", never the webhook's name), an AI step ("An AI Step", never what it is
// asked), an Email Received rule's sender, a GitHub trigger's repositories, and a Set Field value that reads as an
// address. No id but the rule's own leaves. Pure.

import type { RuleSentenceOutline } from './sentence';
import {
  AUTOMATION_NOTIFY_NAMES,
  actionChip,
  branchWords,
  conditionChip,
  triggerParts,
  waitWords,
  outlineFieldName,
} from './sentence';
import type {
  AutomationAction,
  AutomationRule,
  AutomationStep,
  AutomationTrigger,
  AutomationVia,
} from './types';
import { isTimeTrigger } from './types';

/** One action as a reader sees it: its kind (for its icon; an outgoing action's `via` too) and its words. */
export type AutomationSummaryLine = {
  kind: AutomationStep['kind'];
  via?: AutomationVia;
  words: string;
};

/** One step: its line, and an If / Else's or a For Related Cards' own conditions and steps. */
export type AutomationSummaryStep = AutomationSummaryLine & {
  conditions?: string[];
  then?: AutomationSummaryLine[];
  else?: AutomationSummaryLine[];
};

export type AutomationRuleSummary = {
  id: string;
  name: string;
  on: boolean;
  // Turned itself off after failing (the reason stays the Editor's).
  paused: boolean;
  // "When Card Moved to Done", "Every Weekday at 9:00".
  trigger: string;
  // A time trigger's conditions pick its cards ("For Cards"); any other's must hold ("Only If").
  picks: boolean;
  conditions: string[];
  steps: AutomationSummaryStep[];
  made: { by: string; at: number };
};

/** The words an AI step reads as: never what it is asked. */
export const SUMMARY_AI_STEP = 'An AI Step';

// What a trigger names that a reader is not shown: an Email Received rule's sender, a GitHub trigger's repositories.
function shownTrigger(trigger: AutomationTrigger): AutomationTrigger {
  if (trigger.kind === 'email_received') return { ...trigger, sender: undefined };
  if ('repositories' in trigger) return { ...trigger, repositories: undefined };
  return trigger;
}

// A typed value that reads as an address (an email, a link) is left to the builder.
const looksLikeAddress = (text: string) => text.includes('@') || text.includes('://');

function actionLine(action: AutomationAction, outline: RuleSentenceOutline): AutomationSummaryLine {
  return { kind: action.kind, words: actionWords(action, outline) };
}

function actionWords(action: AutomationAction, outline: RuleSentenceOutline): string {
  if (action.kind === 'email' && 'addresses' in action.to) {
    const n = action.to.addresses.length;
    return `Email ${n} ${n === 1 ? 'Address' : 'Addresses'}`;
  }
  if (action.kind === 'set_field' && 'text' in action.value && looksLikeAddress(action.value.text))
    return `Set ${outlineFieldName(action.field, outline)}`;
  return actionChip(action, outline);
}

function stepSummary(step: AutomationStep, outline: RuleSentenceOutline): AutomationSummaryStep {
  const actions = (list: readonly AutomationAction[]) => list.map((a) => actionLine(a, outline));
  const conditions = (step: { conditions: AutomationRule['conditions'] }) =>
    step.conditions.map((c) => conditionChip(c, outline));
  switch (step.kind) {
    case 'if':
      return {
        kind: 'if',
        words: 'If',
        conditions: conditions(step),
        then: actions(step.then),
        else: actions(step.else),
      };
    case 'for':
      return {
        kind: 'for',
        words: branchWords(step.related, outline),
        conditions: conditions(step),
        then: actions(step.then),
      };
    case 'notify':
      return { kind: 'notify', via: step.via, words: AUTOMATION_NOTIFY_NAMES[step.via] };
    case 'ai':
      return { kind: 'ai', words: SUMMARY_AI_STEP };
    case 'wait':
      return { kind: 'wait', words: waitWords(step.hours) };
    default:
      return actionLine(step, outline);
  }
}

export function automationRuleSummary(
  rule: AutomationRule,
  outline: RuleSentenceOutline,
): AutomationRuleSummary {
  const trigger = triggerParts(shownTrigger(rule.trigger), outline)
    .map((p) => ('word' in p ? p.word : p.chip))
    .join(' ');
  return {
    id: rule.id,
    name: rule.name,
    on: rule.enabled,
    paused: !!rule.paused,
    trigger,
    picks: isTimeTrigger(rule.trigger),
    conditions: rule.conditions.map((c) => conditionChip(c, outline)),
    steps: rule.steps.map((s) => stepSummary(s, outline)),
    made: { by: rule.made.by.name, at: rule.made.at },
  };
}
