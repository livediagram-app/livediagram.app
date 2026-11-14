// Automations: the rest of a run planned afresh after an AI step (docs/specs/026-plan/automations.md "How a step
// runs"; blueprint automations.md "Steps after an AI step"). planActions plans a whole run ahead, from the card as it
// was; once an AI step has written (or the day's cap skipped it), the api plans the steps after it again from the card
// it left, and `replanAfter` puts that plan in place of the old one's tail: its lines, its later AI steps and outgoing
// messages (their lines shifted to the run's), its Wait, its failure and the turns it takes. Pure.

import type { AutomationGone, AutomationStepLine } from './types';
import type { PlannedAi } from './ai-steps';
import type { PlannedRun, PlannedSegment, PlannedSend } from './plan-walk';

/** A run's plan as it goes: the run's lines (the plan's from `offset`, nothing after them), the AI steps still to
 *  ask, the outgoing messages, the Wait it reaches, the planning's failure and the Assign in Turn turns it takes. */
export interface LivePlan {
  lines: AutomationStepLine[];
  offset: number;
  ai: PlannedAi[];
  sends: PlannedSend[];
  wait: { hours: number; from: number } | undefined;
  failed: string | null;
  gone: AutomationGone | undefined;
  turns: number;
}

/** `live` with everything after AI step `p` replaced by `next`, the steps after it planned afresh (planActions from
 *  `p.step + 1`, carrying `p.carry`). `live.ai` is changed in place (the AI steps after `p` replaced), so the loop
 *  asking them meets the new ones. Answers the writes of the steps up to the next AI step: what the api writes now. */
export function replanAfter(live: LivePlan, p: PlannedAi, next: PlannedRun): PlannedSegment {
  const at = p.line + 1;
  const writes = 'failed' in next ? next.done : next;
  live.lines.splice(live.offset + at, live.lines.length - live.offset - at, ...next.lines);
  const shift = <T extends { line: number }>(x: T): T => ({ ...x, line: x.line + at });
  const i = live.ai.indexOf(p);
  live.ai.splice(i + 1, live.ai.length - i - 1, ...(writes.ai ?? []).map(shift));
  live.sends = [...live.sends.filter((s) => s.line < at), ...writes.sends.map(shift)];
  live.wait = 'failed' in next ? undefined : next.wait;
  live.failed = 'failed' in next ? next.failed : null;
  live.gone = 'failed' in next ? next.gone : undefined;
  live.turns = writes.turns;
  return {
    patch: writes.patch,
    comments: writes.comments,
    created: writes.created,
    emails: writes.emails,
    mentions: writes.mentions,
    resolve: writes.resolve,
    related: writes.related,
  };
}
