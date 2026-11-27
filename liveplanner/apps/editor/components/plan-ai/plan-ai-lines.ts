// What a turn's changes did, a line each (docs/specs/026-plan/plan-ai.md "The panel"): what was made, or, last, why a
// change could not be made.
import { PLAN_AI_CHANGES_MAX, type PlanAiKind, type PlanAiRole } from '@liveplanner/items';

export type PlanAiLine = { text: string; ok: boolean };

/** What a turn's changes came to: their lines, and how many undo steps they took (the turn's Undo takes as many). */
export type PlanAiApplied = { lines: PlanAiLine[]; steps: number };

export const NOTHING_APPLIED: PlanAiApplied = { lines: [], steps: 0 };

/** A change whose shape its check refused, in plain words: the check's own words are for an agent. */
export const unreadableChange = (op: string) =>
  `That change (${op.replace(/_/g, ' ')}) couldn’t be read, so it wasn’t made. Try saying it another way.`;

// What a role may not change on each kind, said when the api left a change out for it (spec "Share roles").
const EDITOR_ONLY: Readonly<Record<PlanAiKind, string>> = {
  board: 'Only an Editor can delete cards.',
  sheet: 'Only an Editor can change more than the cells: their values and formats.',
  form: 'Only an Editor can change the form.',
  dashboard: 'Only an Editor can change the layout.',
};

/** The line for the changes the api left out: the role may not make them, or the turn made its most. */
export function droppedLine(kind: PlanAiKind, role: PlanAiRole, dropped: number): PlanAiLine {
  const text =
    role === 'view'
      ? 'You can view this tab, not change it.'
      : role === 'participate'
        ? EDITOR_ONLY[kind]
        : `${dropped} more ${dropped === 1 ? 'change was' : 'changes were'} left out: a turn makes at most ${PLAN_AI_CHANGES_MAX}.`;
  return { text, ok: false };
}

export const PLAN_AI_NONE_MADE = 'Nothing was changed.';
export const PLAN_AI_SOME_MADE = 'Only part of that was made: the changes below are what was.';

/** The words a turn shows: the AI's own, unless a change it asked for wasn't made, when they would claim it was. */
export function replyShown(reply: string, lines: readonly PlanAiLine[]): string {
  if (!lines.some((l) => !l.ok)) return reply;
  return lines.some((l) => l.ok) ? PLAN_AI_SOME_MADE : PLAN_AI_NONE_MADE;
}

// The agent verbs' refusals end by naming the tool to call next ("List them with list_items."): those sentences are
// for an agent, so a person sees the refusal without them.
const TOOL_SENTENCE = /[^.]*\b(?:list|change|read|add|find|set)_[a-z_]+\b[^.]*\.?/g;
// Also for an agent: the op's tool name in the batch's "Change 2 (delete_question): " lead (which change stays), and
// the list of every name and id to pick from ('Questions: "How was it? (q-1)", "Email (q-2)".').
const CHANGE_LEAD = /^(Change \d+) \([a-z_]+\):/;
const NAME_LIST = /\s*\b[A-Z][a-z]+s: (?:"[^"]*"(?:, )?)+\./g;

export function forPeople(message: string): string {
  const out = message
    .replace(CHANGE_LEAD, '$1:')
    .replace(NAME_LIST, '')
    .replace(TOOL_SENTENCE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return out || message;
}
