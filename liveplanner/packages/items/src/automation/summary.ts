// A rule as a Participant or a Viewer reads it (docs/specs/026-plan/automations.md "On cards", "Who may do what"): its
// name, whether it is on, its trigger in words, its conditions and its steps in order, and who made it and when. Built
// from an allow-list, never the stored rule with parts taken out: each line is words the sentence makes (sentence.ts),
// and what a reader must not see reads as a plain label instead: typed-in email addresses ("Email 2 Addresses"), where
// an outgoing action posts ("Post to Slack", never the webhook's name), an AI step ("An AI Step", never what it is
// asked), an Email Received rule's sender, a GitHub trigger's repositories, and a Set Field value that reads as an
// address. No id but the rule's own leaves. Pure.

import { crossAppChip } from '@liveworkspace/automations/cross-app';
import { snapshotStepSummary } from '@liveworkspace/automations/item';
import {
  SUMMARY_AI_STEP,
  looksLikeAddress,
  ruleSummary,
  type AutomationRuleSummary as RuleSummary,
  type AutomationSummaryLine as SummaryLine,
  type AutomationSummaryStep as SummaryStep,
} from '@liveworkspace/automations';
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
import type { AutomationAction, AutomationRule, AutomationStep, AutomationTrigger } from './types';
import { isTimeTrigger } from './types';

// The summary's shape is @liveworkspace/automations', over a plan's step kinds.

/** One action as a reader sees it: its kind (for its icon; an outgoing action's `via` too) and its words. */
export type AutomationSummaryLine = SummaryLine<AutomationStep['kind']>;

/** One step: its line, and an If / Else's or a For Related Cards' own conditions and steps. */
export type AutomationSummaryStep = SummaryStep<AutomationSummaryLine>;

// The rule with its trigger in words ("When Card Moved to Done", "Every Weekday at 9:00") and `picks`: a time
// trigger's conditions pick its cards ("For Cards"), any other's must hold ("Only If").
export type AutomationRuleSummary = RuleSummary<AutomationSummaryStep>;

/** The words an AI step reads as: never what it is asked. */
export { SUMMARY_AI_STEP };

// What a trigger names that a reader is not shown: an Email Received rule's sender, a GitHub trigger's repositories.
function shownTrigger(trigger: AutomationTrigger): AutomationTrigger {
  if (trigger.kind === 'email_received') return { ...trigger, sender: undefined };
  if ('repositories' in trigger) return { ...trigger, repositories: undefined };
  return trigger;
}

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
    case 'plan_card':
    case 'kb_page':
    case 'space_post':
    case 'doc_tab':
    case 'inbox_notice':
      return { kind: step.kind, words: crossAppChip(step) };
    // A reader sees the step, never which snapshot or its name.
    case 'take_snapshot':
    case 'revert_snapshot':
      return { kind: step.kind, words: snapshotStepSummary(step) };
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
  return ruleSummary(rule, {
    trigger,
    picks: isTimeTrigger(rule.trigger),
    conditions: rule.conditions.map((c) => conditionChip(c, outline)),
    steps: rule.steps.map((s) => stepSummary(s, outline)),
  });
}
