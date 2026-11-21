// A rule as a Participant or a Viewer reads it (liveworkspace/docs/specs/018-automations/automations.md "Who may do
// what"): its name, whether it is on, its trigger in words, its conditions and its steps in order, and who made it
// and when. Built from an allow-list, never the stored rule with parts taken out: each line is words the app's
// sentence makes, and what a reader must not see reads as a plain label instead (where a message posts, what an AI
// step is asked, a typed-in address). No id but the rule's own leaves. The shape, and the shell an app's lines go
// in. Pure.

import type { AutomationPerson, AutomationRule, AutomationVia } from './types';

// One action as a reader sees it: its kind (for its icon; a message step's `via` too) and its words. (Line comments
// here: an app's own alias carries the words its API describes.)
export type AutomationSummaryLine<Kind extends string = string> = {
  kind: Kind;
  via?: AutomationVia;
  words: string;
};

// One step: its line, and the conditions and actions of a step that holds some. `Line`: the app's own line.
export type AutomationSummaryStep<Line extends AutomationSummaryLine = AutomationSummaryLine> =
  Line & {
    conditions?: string[];
    then?: Line[];
    else?: Line[];
  };

// `Step`: the app's own step.
export type AutomationRuleSummary<Step extends AutomationSummaryStep = AutomationSummaryStep> = {
  id: string;
  name: string;
  on: boolean;
  // Turned itself off after failing (the reason stays the Editor's).
  paused: boolean;
  // "Every Weekday at 9:00".
  trigger: string;
  // A trigger whose conditions pick what it runs on ("For …"); any other's must hold ("Only If").
  picks: boolean;
  conditions: string[];
  steps: Step[];
  made: { by: string; at: number };
};

/** The words an AI step reads as: never what it is asked. */
export const SUMMARY_AI_STEP = 'An AI Step';

/** A typed value that reads as an address (an email, a link) is left to the builder. */
export const looksLikeAddress = (text: string): boolean =>
  text.includes('@') || text.includes('://');

/** The summary of `rule` around the words the app made of its trigger, conditions and steps. */
export function ruleSummary<Step extends AutomationSummaryStep>(
  rule: Pick<AutomationRule, 'id' | 'name' | 'enabled'> & {
    paused?: object;
    made: { by: Pick<AutomationPerson, 'name'>; at: number };
  },
  words: Pick<AutomationRuleSummary<Step>, 'trigger' | 'picks' | 'conditions' | 'steps'>,
): AutomationRuleSummary<Step> {
  return {
    id: rule.id,
    name: rule.name,
    on: rule.enabled,
    paused: !!rule.paused,
    trigger: words.trigger,
    picks: words.picks,
    conditions: words.conditions,
    steps: words.steps,
    made: { by: rule.made.by.name, at: rule.made.at },
  };
}
