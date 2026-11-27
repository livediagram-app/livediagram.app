// Plan AI on the wire (docs/specs/026-plan/plan-ai.md; blueprint plan-ai.md "The api"): one tab as the editor read it
// and the person's instruction, answered with words to show and the changes to make, which the editor makes as the
// person's own edits. The route writes nothing but Ask's count. `POST /api/plan-ai`.

import type { PlanAiChange, PlanAiKind, PlanAiRole, PlanAiTurn } from '@liveplanner/items';

export interface PlanAiRequest {
  projectId: string;
  kind: PlanAiKind;
  tabName: string;
  // The tab as the editor read it, cut to PLAN_AI_TAB_MAX.
  tab: string;
  instruction: string;
  turns?: PlanAiTurn[];
  // The plan's team, whose key applies (Ask's rule); absent for a person's own plan.
  teamId?: string;
  // The person picked built-in AI in the pill, though a key applies.
  ai?: 'built-in';
}

export interface PlanAiResponse {
  reply: string;
  changes: PlanAiChange[];
  // How many changes the reply held that the role may not make (or past a turn's 40): left out, and said in the panel.
  dropped: number;
  // Which AI answered: `built-in`, or the key's provider.
  provider: string;
  // The role the changes were read for, as the plan's grant says it.
  role: PlanAiRole;
}

export const PLAN_AI_ERRORS = [
  // A guest (403): Plan AI is for signed-in people only, as Ask is.
  'plan_ai_needs_account',
  // No such plan, or no access to it (403).
  'plan_ai_no_access',
  // An empty, over-long or unreadable request (400).
  'plan_ai_invalid',
  // A reply that never read (422).
  'plan_ai_unreadable',
  // Built-in AI's questions for the day spent (429), shared with Ask.
  'ask_built_in_limit',
  // No model, one that erred or was slow, or a count that couldn't be read (503).
  'plan_ai_unavailable',
  // On a key: the provider refused it or it will not open (422), with `aiKey`.
  'ai_key_failed',
  // With Pro on: the month's AI credits used (429), or the plan's day of questions by others spent.
  'ai_credits_used',
  'ask_by_others_limit',
] as const;
export type PlanAiError = (typeof PLAN_AI_ERRORS)[number];
