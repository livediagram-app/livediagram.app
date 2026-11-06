// The work a board from another tool takes, off the page (docs/specs/026-plan/tracker-import.md "Reading the file",
// blueprints/tracker-import.md "Performance"): reading the file as a board and planning the import, the two that cost
// hundreds of milliseconds at the caps. A runner keeps the boards it read, so a plan names its board by key and the
// board itself never crosses back to the page: only a short summary of it, and the plan, do. Pure: the worker
// (tracker.worker.ts) and the page's fallback (tracker-worker-client.ts) run the same code.
import {
  planTrackerImport,
  type TrackerImportPlan,
  type TrackerPlanContext,
  type TrackerRefusal,
  type TrackerSource,
  type TrackerBoard,
} from '@liveplanner/items';
import { readTrackerText } from '@/lib/tracker-file';

// A board the runner holds: its key, and what the page shows of it before a plan.
export type TrackerBoardRef = { key: number; source: TrackerSource; cards: number };

export type TrackerRead =
  { board: TrackerBoardRef } | { error: string; refusal?: TrackerRefusal['refusal'] };

// A plan's context as it crosses to the worker: data only (no `random`, which the worker's Math.random stands for).
export type TrackerTaskContext = Omit<TrackerPlanContext, 'random'>;

export type TrackerTask =
  | { kind: 'read'; text: string; name: string }
  | { kind: 'plan'; key: number; ctx: TrackerTaskContext };

export type TrackerTaskResult<T extends TrackerTask> = T extends { kind: 'read' }
  ? TrackerRead
  : TrackerImportPlan;

export type TrackerRequest = { id: number; task: TrackerTask };
export type TrackerResponse =
  | { id: number; ok: true; result: TrackerRead | TrackerImportPlan }
  | { id: number; ok: false; error: string };

// How many boards a runner keeps: the one previewed, and one read since (a file dropped while another is shown).
// Bounded, so a session of many files holds two at most.
export const TRACKER_BOARDS_KEPT = 2;

export const TRACKER_BOARD_GONE = 'tracker board gone';

export type TrackerRunner = {
  run: <T extends TrackerTask>(task: T) => TrackerTaskResult<T>;
};

export function createTrackerRunner(): TrackerRunner {
  const boards = new Map<number, TrackerBoard>();
  let next = 1;
  const keep = (board: TrackerBoard): number => {
    const key = next++;
    boards.set(key, board);
    // A Map iterates in insertion order: the oldest goes first.
    while (boards.size > TRACKER_BOARDS_KEPT) boards.delete(boards.keys().next().value!);
    return key;
  };
  const run = (task: TrackerTask): TrackerRead | TrackerImportPlan => {
    if (task.kind === 'read') {
      const read = readTrackerText(task.text, task.name);
      if ('error' in read) return read;
      const { board } = read;
      return { board: { key: keep(board), source: board.source, cards: board.cards.length } };
    }
    const board = boards.get(task.key);
    if (!board) throw new Error(TRACKER_BOARD_GONE);
    return planTrackerImport(board, task.ctx);
  };
  return { run: run as TrackerRunner['run'] };
}

// One request answered: the result, or the error's message (a thrown error does not cross a worker whole).
export function answerTrackerRequest(runner: TrackerRunner, req: TrackerRequest): TrackerResponse {
  try {
    return { id: req.id, ok: true, result: runner.run(req.task) };
  } catch (err) {
    return { id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// What a plan reads of its context, as one string: two contexts with the same key plan a board alike (the board's
// id aside, which is fresh each time and not yet used). The preview's plan is reused at Import only while it holds.
export function trackerContextKey(ctx: TrackerTaskContext): string {
  return JSON.stringify([ctx.types, ctx.statuses, ctx.people, ctx.members, ctx.room]);
}
