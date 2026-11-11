// A plan's rules in its copies and its file (docs/specs/026-plan/automations.md "Copies, exports and deletes"): a
// duplicated plan keeps each rule as it was, on or off, with an empty Run Log and no failures counted; the plan's
// file carries them, and a file read into a new plan brings them back off, each checked as a rule write is checked
// (one that does not read back is left behind). A plan's delete drops them with the rest of its SQLite.
import {
  AUTOMATION_RULES_MAX,
  readRuleBody,
  type AutomationRule,
  type AutomationStamp,
} from '@liveplanner/items';
import type { PlanEnv } from '../../types';

// The rules a copy or the file carries, in the list's order. None for a plan whose schema predates them.
export async function copiedRules(env: Pick<PlanEnv, 'PLAN_DB'>): Promise<AutomationRule[]> {
  const { results } = await env.PLAN_DB.prepare(
    'SELECT body FROM automation_rules ORDER BY position, id',
  ).all<{ body: string }>();
  const out: AutomationRule[] = [];
  for (const row of results ?? []) {
    try {
      out.push(JSON.parse(row.body) as AutomationRule);
    } catch {
      // A damaged row stays behind.
    }
  }
  return out;
}

// A copy's rules as rows of the plan they land in: on or off as they were, nothing paused or failed.
export function copiedRuleStatements(
  env: Pick<PlanEnv, 'PLAN_DB'>,
  rules: readonly AutomationRule[],
): D1PreparedStatement[] {
  return rules.slice(0, AUTOMATION_RULES_MAX).map((rule, position) => {
    const { paused: _paused, ...kept } = rule;
    return env.PLAN_DB.prepare(
      'INSERT INTO automation_rules (id, body, enabled, position, failures) VALUES (?, ?, ?, ?, 0)',
    ).bind(rule.id, JSON.stringify(kept), kept.enabled ? 1 : 0, position);
  });
}

const isStamp = (v: unknown): v is AutomationStamp =>
  !!v &&
  typeof v === 'object' &&
  typeof (v as AutomationStamp).at === 'number' &&
  !!(v as AutomationStamp).by;

// A file's rules as a new plan takes them: each checked, under a fresh id, off.
export function rulesFromFile(raw: readonly unknown[], now: number): AutomationRule[] {
  const out: AutomationRule[] = [];
  for (const r of raw.slice(0, AUTOMATION_RULES_MAX)) {
    const read = readRuleBody(r);
    if ('error' in read) continue;
    const held = r as Partial<AutomationRule>;
    const stamp = { by: { id: '', name: 'Someone', color: '#94a3b8' }, at: now };
    out.push({
      ...read.body,
      id: crypto.randomUUID(),
      enabled: false,
      made: isStamp(held.made) ? held.made : stamp,
      edited: isStamp(held.edited) ? held.edited : stamp,
    });
  }
  return out;
}
