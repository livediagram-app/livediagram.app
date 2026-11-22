// A plan rule's steps in other apps (docs/specs/026-plan/automations.md "Steps in other apps"; liveworkspace blueprint
// cross-app.md "Running"): planned with their texts filled (plan-actions.ts crossStep), sent here once the run's card
// writes have landed, each through the platform's runner (@liveworkspace/automations/room runCrossAppStep) as the
// rule's author: the account behind the person who last saved it, as the plan knows its people. Each answer settles its
// step's line. Lost access pauses the rule at once; a loop or a cap skips the step and the run ends Skipped; any other
// refusal fails the run. A test says what each would do and sends nothing.
import type { AutomationRule, AutomationStepLine, PlannedCross } from '@liveplanner/items';
import { chainOf, type CrossAppChain } from '@liveworkspace/automations/cross-app';
import {
  kitCrossApp,
  runCrossAppStep,
  type CrossAppOutcome,
} from '@liveworkspace/automations/room';
import { indexAppClient } from '../../index-service';
import type { PlanEnv } from '../../types';
import type { AutomationPlan } from './automation-plan';
import type { Sql } from './automation-store';
import type { AutomationTally } from './automation-telemetry';

export interface PlanCrossRun {
  env: PlanEnv;
  planId: string;
  sql: Sql;
  rule: AutomationRule;
  plan: Pick<AutomationPlan, 'accounts' | 'name'>;
  // The chain the run's event carried from another app, if any.
  carried: CrossAppChain | undefined;
  runId: string;
  // The link back: the card's, or the plan's for a run with no card.
  url: string;
  dry: boolean;
  now: number;
  tally?: AutomationTally | undefined;
}

export type PlanCrossOutcome = { failed?: string; pause?: string; skipped?: string };

const EVENT: Record<string, string> = {
  done: 'CrossAppDone',
  pause: 'CrossAppNoAccess',
  loop: 'CrossAppLoop',
  capped: 'CrossAppCapped',
  failed: 'CrossAppFailed',
};

const eventOf = (out: CrossAppOutcome): string =>
  out.ok
    ? EVENT['done']!
    : out.pause
      ? EVENT['pause']!
      : out.skip
        ? /loop|hops/.test(out.text)
          ? EVENT['loop']!
          : EVENT['capped']!
        : EVENT['failed']!;

export async function runPlanCrossSteps(
  run: PlanCrossRun,
  cross: readonly PlannedCross[],
  lines: AutomationStepLine[],
  offset: number,
): Promise<PlanCrossOutcome> {
  if (cross.length === 0) return {};
  const outcome: PlanCrossOutcome = {};
  // The account kept on the stamp, else the plan person's account (a rule saved before stamps kept it).
  const author = run.rule.edited.account ?? run.plan.accounts.get(run.rule.edited.by.id) ?? null;
  const chain = chainOf(run.carried, run.runId);
  const client = run.dry ? null : kitCrossApp(indexAppClient(run.env));
  for (const c of cross) {
    const at = offset + c.line;
    const line = lines[at];
    if (run.dry) {
      if (line)
        lines[at] = {
          ...line,
          kind: 'action',
          ok: true,
          text: `Would ${lowerFirst(line.text ?? '')}`,
        };
      continue;
    }
    const out = await runCrossAppStep(
      {
        client,
        sql: run.sql,
        app: 'liveplanner',
        itemId: run.planId,
        rule: { id: run.rule.id, name: run.rule.name },
        author,
        from: { title: run.plan.name || 'Untitled', url: run.url },
        chain,
        key: `${run.runId}:${c.step}`,
        now: run.now,
      },
      c.filled,
    );
    lines[at] = { kind: 'action', ok: out.ok, text: out.text };
    run.tally?.track('Plan', 'Ran', eventOf(out));
    if (out.ok) continue;
    if (out.pause) return { pause: out.text };
    if (out.skip) {
      outcome.skipped ??= out.text;
      continue;
    }
    return { failed: out.text };
  }
  return outcome;
}

const lowerFirst = (text: string) => (text ? text[0]!.toLowerCase() + text.slice(1) : text);
