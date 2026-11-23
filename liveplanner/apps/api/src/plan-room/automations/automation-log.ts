// A plan's Audit Trail on its own SQLite (docs/specs/026-plan/automations.md "Runs, limits and loops", "The Automations
// screen"; blueprint automations.md "Storage", "The run"). The log is @liveworkspace/automations/room's
// (liveworkspace/docs/specs/018-automations/blueprints/engine.md "The room entry"); here its list reads a plan's runs,
// each about a card.
import type { AutomationRun } from '@liveplanner/items';
import type { AutomationRunsQuery } from '@liveplanner/api-schema';
import { listRuns as listStoredRuns, type Sql } from '@liveworkspace/automations/room';

export {
  AUTOMATION_NO_MATCH_LOG_MAX,
  AUTOMATION_RUNS_LIST_MAX,
  burstLineId,
  claimRun,
  derivedLineId,
  dropRun,
  markAiAsked,
  monthLineId,
  noteLineOnce,
  unmarkAiAsked,
  ruleStats,
  runsToday,
  settleRun,
  settleWaiting,
  timeLineId,
  trimRuns,
} from '@liveworkspace/automations/room';

// The Audit Trail, newest first: by rule, result and since when, at most AUTOMATION_RUNS_LIST_MAX.
export const listRuns = (sql: Sql, query: AutomationRunsQuery): AutomationRun[] =>
  listStoredRuns<AutomationRun>(sql, query);
