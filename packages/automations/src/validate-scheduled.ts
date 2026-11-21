// Automations: the Scheduled trigger, checked (liveworkspace/docs/specs/018-automations/automations.md "Triggers every
// app has"). Read with the primitives of validate-read.ts, so a part at fault throws its refusal for readRuleShell
// (validate.ts) to answer. Pure.

import type { AutomationScheduled } from './types';
import { clock, refuse, whole, type Obj } from './validate-read';

const EVERY = new Set(['day', 'weekday', 'week', 'month']);

function readWeekdays(v: unknown, path: string): number[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > 7)
    refuse(path, `${path} must name 1 to 7 days`);
  const days = (v as unknown[]).map((d, i) => whole(d, `${path}.${i}`, 0, 6));
  return [...new Set(days)].sort((a, b) => a - b);
}

export function readScheduled(t: Obj): AutomationScheduled {
  const every = t['every'];
  if (typeof every !== 'string' || !EVERY.has(every))
    refuse('trigger.every', 'trigger.every must be day, weekday, week or month');
  const at = clock(t['at'], 'trigger.at');
  if (every === 'week')
    return { kind: 'scheduled', every, days: readWeekdays(t['days'], 'trigger.days'), at };
  if (every === 'month')
    return {
      kind: 'scheduled',
      every,
      dayOfMonth: whole(t['dayOfMonth'], 'trigger.dayOfMonth', 1, 31),
      at,
    };
  return { kind: 'scheduled', every: every as 'day' | 'weekday', at };
}
