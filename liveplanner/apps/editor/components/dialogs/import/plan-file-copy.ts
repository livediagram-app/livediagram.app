// The Import dialog's A Whole Plan words (docs/specs/026-plan/plan-tabs.md "The Import dialog"): the row, the
// preview's lines, and each refusal, by what refused the file. Pure.
import type { ProjectEnvelopeFailure, ProjectFileSummary } from '@liveplanner/project';

export const PLAN_ROW_LABEL = 'liveplanner Plan';
export const PLAN_ROW_HINT = 'A whole plan’s .liveplanner file from Export. Makes a new plan.';
export const PLAN_SECTION = 'A Whole Plan';
// Why the row is dimmed while the browser is offline: the new plan is made on the server.
export const PLAN_OFFLINE = 'You’re offline. Connect to import a whole plan.';
// What the picker asks for: the file Export saves, or the same JSON renamed.
// A plan's file by its name, as Export names it.
export const PLAN_FILE_EXTENSION = '.liveplanner';
export const PROJECT_FILE_ACCEPT =
  '.liveplanner,application/vnd.liveplanner+json,.json,application/json';

export const PLAN_NOT_A_PLAN =
  'That file isn’t a liveplanner plan. Export one with Whole Plan, then import it.';
export const PLAN_NEWER =
  'That plan was exported by a newer liveplanner. Reload the page, then try again.';
export const PLAN_TOO_BIG = 'That plan’s file is over 20 MB, the most an import reads.';
export const PLAN_DAMAGED =
  'Couldn’t import that plan: its file is damaged or holds more than a plan can.';
export const PLAN_FAILED = 'Couldn’t import that plan. Try again.';

export const PLAN_RULES_OFF = 'Rules come in off: turn them on in Automations.';
export const PLAN_PICTURES =
  'Pictures stay with the plan they came from: they show here only to whoever uploaded them.';

// Why a file read in the browser is not a plan to preview.
export function planFileRefusal(failure: ProjectEnvelopeFailure): string {
  return failure === 'unsupported_version' ? PLAN_NEWER : PLAN_NOT_A_PLAN;
}

// "1 Tab", "120 Cards": a count and its noun, Title Case as the preview's tiles name them.
const counted = (n: number, one: string, many: string) => ({ n, label: n === 1 ? one : many });

// The counts the preview shows, each above zero, in the plan's own order: tabs, then what lives on them.
export function planFileCounts(summary: ProjectFileSummary): { n: number; label: string }[] {
  return [
    counted(summary.tabs, 'Tab', 'Tabs'),
    counted(summary.cards, 'Card', 'Cards'),
    counted(summary.cardTypes, 'Card Type', 'Card Types'),
    counted(summary.threads, 'Comment Thread', 'Comment Threads'),
    counted(summary.rules, 'Rule', 'Rules'),
  ].filter((c) => c.n > 0);
}
