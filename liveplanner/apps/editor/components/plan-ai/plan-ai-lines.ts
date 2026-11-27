// What a turn's changes did, a line each (docs/specs/026-plan/plan-ai.md "The panel"): what was made, or, last, why a
// change could not be made.
export type PlanAiLine = { text: string; ok: boolean };

/** What a turn's changes came to: their lines, and how many undo steps they took (the turn's Undo takes as many). */
export type PlanAiApplied = { lines: PlanAiLine[]; steps: number };

export const NOTHING_APPLIED: PlanAiApplied = { lines: [], steps: 0 };

// The agent verbs' refusals end by naming the tool to call next ("List them with list_items."): those sentences are
// for an agent, so a person sees the refusal without them.
const TOOL_SENTENCE = /[^.]*\b(?:list|change|read|add|find|set)_[a-z_]+\b[^.]*\.?/g;

export function forPeople(message: string): string {
  const out = message
    .replace(TOOL_SENTENCE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return out || message;
}
