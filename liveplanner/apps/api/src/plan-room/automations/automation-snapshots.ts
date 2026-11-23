// A plan rule's Take Snapshot and Revert to Snapshot (docs/specs/026-plan/automations.md "Snapshot steps"; blueprint
// automations.md "Snapshot steps"): planned with their lines (plan-actions.ts snapshotStep), run here once the run's
// card writes, messages and steps in other apps are done, each through the platform's runners
// (@liveworkspace/automations/room runTakeSnapshot, runRevertSnapshot) over the plan's own snapshots: the same door a
// person's History uses (plan-snapshots.ts), so a revert is the ordinary one (the safety snapshot first, the plan
// replaced, every open editor closed onto it). Both are by Automation with the rule's name. A failure stops the run
// there; a test says what each would do and changes nothing.
import type { AutomationGone, AutomationStepLine, PlannedSnapshot } from '@liveplanner/items';
import { snapshotStepWould } from '@liveworkspace/automations/item';
import {
  automationAuthor,
  kitSnapshots,
  runRevertSnapshot,
  runTakeSnapshot,
  type ItemRoomKit,
} from '@liveworkspace/automations/room';
import { listSnapshots, revertToSnapshot, takeSnapshot } from '@liveworkspace/snapshots/server';
import type { PlanEnv } from '../../types';
import { planSnapshotDoor } from '../plan-snapshots';
import type { AutomationTally } from './automation-telemetry';

/** The plan's snapshots as a rule's steps take and revert them. */
export function planKitSnapshots(env: PlanEnv, planId: string): ItemRoomKit['snapshots'] {
  const db = env.PLAN_DB;
  const door = () => planSnapshotDoor(env, planId);
  return kitSnapshots({
    itemWord: 'plan',
    list: () => listSnapshots(db, planId),
    exportFile: () => door().exportFile(),
    kept: async () => (await door().kept?.()) ?? [],
    take: (taken) => takeSnapshot(db, { itemId: planId, kind: 'manual', ...taken }),
    revert: (snapshotId, author) =>
      revertToSnapshot({ db, itemId: planId, snapshotId, door: door(), author }),
  });
}

export interface PlanSnapshotRun {
  env: PlanEnv;
  planId: string;
  rule: { name: string };
  dry: boolean;
  tally?: AutomationTally | undefined;
}

export type PlanSnapshotOutcome = { failed?: string; gone?: AutomationGone; reverted?: true };

/** The run's snapshot steps, in their order, each settling its line. Stops at the first that fails. */
export async function runPlanSnapshotSteps(
  run: PlanSnapshotRun,
  planned: readonly PlannedSnapshot[],
  lines: AutomationStepLine[],
  offset: number,
): Promise<PlanSnapshotOutcome> {
  if (planned.length === 0) return {};
  const snapshots = run.dry ? null : planKitSnapshots(run.env, run.planId);
  const author = automationAuthor({ rule: run.rule });
  const outcome: PlanSnapshotOutcome = {};
  for (const p of planned) {
    const at = offset + p.line;
    if (!snapshots) {
      // Take Snapshot's name was filled from the card as it was planned.
      lines[at] = {
        kind: 'action',
        ok: true,
        text: snapshotStepWould(p.step, () => p.filled),
      };
      continue;
    }
    const s = p.step;
    const out =
      s.kind === 'take_snapshot'
        ? await runTakeSnapshot(p.filled, snapshots, author)
        : await runRevertSnapshot(s, s.name ?? 'the snapshot', () =>
            snapshots.revert(s.snapshot, author),
          );
    lines[at] = { kind: 'action', ok: out.ok, text: out.text };
    const step = s.kind === 'take_snapshot' ? 'take' : 'revert';
    console.info('[automations] snapshot', { step, ok: out.ok });
    if (!out.ok) {
      run.tally?.track('Plan', 'Ran', 'AutomationSnapshotFailed');
      return {
        failed: out.text,
        ...(out.gone ? { gone: { kind: 'snapshot', id: out.gone.id } } : {}),
      };
    }
    if (step === 'take') run.tally?.track('Plan', 'Ran', 'AutomationSnapshotTaken');
    else {
      run.tally?.track('Plan', 'Ran', 'AutomationSnapshotReverted');
      outcome.reverted = true;
    }
  }
  return outcome;
}
