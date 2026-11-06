// The Import dialog's worker (docs/specs/026-plan/tracker-import.md "Reading the file"): the tasks it runs, the boards
// it keeps, and the page's side of it, falling back to the page where a worker can't start or dies.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEMS_MAX } from '@liveplanner/items';
import {
  TRACKER_BOARDS_KEPT,
  TRACKER_BOARD_GONE,
  answerTrackerRequest,
  createTrackerRunner,
  trackerContextKey,
  type TrackerRequest,
  type TrackerResponse,
  type TrackerTaskContext,
} from './tracker-tasks';
import {
  createTrackerTasks,
  trackerTasks,
  type TrackerWorkerLike,
} from './tracker-worker-client';

const JIRA = 'Summary,Issue key,Status\nFix it,AB-1,To Do\nShip it,AB-2,Done\n';
const ctx: TrackerTaskContext = {
  types: [],
  statuses: [],
  people: [],
  members: [],
  room: ITEMS_MAX,
  boardId: 'b1',
};

afterEach(() => vi.restoreAllMocks());

describe('the tasks', () => {
  it('reads a file into a kept board, the page getting its summary alone', () => {
    const runner = createTrackerRunner();
    const read = runner.run({ kind: 'read', text: JIRA, name: 'issues.csv' });
    expect(read).toEqual({ board: { key: 1, source: 'jira', cards: 2 } });
    const plan = runner.run({ kind: 'plan', key: 1, ctx });
    expect(plan.creates).toHaveLength(2);
    expect(plan.board.id).toBe('b1');
  });

  it('says why a file is refused, keeping nothing', () => {
    const runner = createTrackerRunner();
    expect(runner.run({ kind: 'read', text: '{"a":1}', name: 'a.json' })).toMatchObject({
      refusal: 'unknown_source',
    });
    expect(() => runner.run({ kind: 'plan', key: 1, ctx })).toThrow(TRACKER_BOARD_GONE);
  });

  it('keeps the last boards read, the oldest let go', () => {
    const runner = createTrackerRunner();
    for (let i = 0; i < TRACKER_BOARDS_KEPT + 1; i++)
      runner.run({ kind: 'read', text: JIRA, name: 'issues.csv' });
    expect(() => runner.run({ kind: 'plan', key: 1, ctx })).toThrow(TRACKER_BOARD_GONE);
    for (let key = 2; key <= TRACKER_BOARDS_KEPT + 1; key++)
      expect(runner.run({ kind: 'plan', key, ctx }).creates).toHaveLength(2);
  });

  it('answers a request with its result or its error’s message', () => {
    const runner = createTrackerRunner();
    expect(
      answerTrackerRequest(runner, { id: 7, task: { kind: 'read', text: JIRA, name: 'x.csv' } }),
    ).toMatchObject({ id: 7, ok: true, result: { board: { source: 'jira' } } });
    expect(answerTrackerRequest(runner, { id: 8, task: { kind: 'plan', key: 9, ctx } })).toEqual({
      id: 8,
      ok: false,
      error: TRACKER_BOARD_GONE,
    });
    const throwing = { run: () => Promise.reject(0) as never };
    vi.spyOn(throwing, 'run').mockImplementation(() => {
      throw 'plain';
    });
    expect(answerTrackerRequest(throwing, { id: 1, task: { kind: 'plan', key: 1, ctx } })).toEqual(
      { id: 1, ok: false, error: 'plain' },
    );
  });

  it('keys a context by what a plan reads of it, never its fresh board id', () => {
    expect(trackerContextKey(ctx)).toBe(trackerContextKey({ ...ctx, boardId: 'b2' }));
    expect(trackerContextKey(ctx)).not.toBe(trackerContextKey({ ...ctx, room: ITEMS_MAX - 1 }));
    expect(trackerContextKey(ctx)).not.toBe(
      trackerContextKey({ ...ctx, people: [{ id: 'n-ana', name: 'Ana' }] as never }),
    );
  });
});

// A worker in the test's hands: it runs the tasks itself, as tracker.worker.ts does, or fails on demand.
function fakeWorker({ answers = true } = {}) {
  const runner = createTrackerRunner();
  const on: { message?: (e: MessageEvent<TrackerResponse>) => void; error?: (e: Event) => void } =
    {};
  const sent: TrackerRequest[] = [];
  const w: TrackerWorkerLike = {
    postMessage: (req) => {
      sent.push(req);
      if (answers)
        queueMicrotask(() =>
          on.message?.({ data: answerTrackerRequest(runner, req) } as MessageEvent),
        );
    },
    addEventListener: ((type: 'message' | 'error', fn: never) => {
      on[type] = fn;
    }) as TrackerWorkerLike['addEventListener'],
    terminate: vi.fn(),
  };
  return { w, sent, fail: () => on.error?.(new Event('error')), on };
}

describe('the page’s side', () => {
  it('sends each task to one worker, made on first use, and takes its answers', async () => {
    const fake = fakeWorker();
    const make = vi.fn(() => fake.w);
    const tasks = createTrackerTasks(make);
    const read = await tasks.run({ kind: 'read', text: JIRA, name: 'issues.csv' });
    expect(read).toEqual({ board: { key: 1, source: 'jira', cards: 2 } });
    const plan = await tasks.run({ kind: 'plan', key: 1, ctx });
    expect(plan.creates).toHaveLength(2);
    expect(make).toHaveBeenCalledOnce();
    expect(fake.sent.map((r) => r.id)).toEqual([1, 2]);
  });

  it('rejects a task the worker could not do, and ignores an answer to nothing', async () => {
    const fake = fakeWorker();
    const tasks = createTrackerTasks(() => fake.w);
    await expect(tasks.run({ kind: 'plan', key: 5, ctx })).rejects.toThrow(TRACKER_BOARD_GONE);
    fake.on.message?.({ data: { id: 99, ok: true, result: { error: 'x' } } } as MessageEvent);
  });

  it('runs on the page where there are no workers, or one will not start', async () => {
    for (const make of [
      null,
      () => {
        throw new Error('blocked');
      },
    ]) {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const tasks = createTrackerTasks(make);
      const read = await tasks.run({ kind: 'read', text: JIRA, name: 'issues.csv' });
      expect(read).toMatchObject({ board: { source: 'jira' } });
      expect((await tasks.run({ kind: 'plan', key: 1, ctx })).creates).toHaveLength(2);
    }
  });

  it('runs what a dying worker held on the page, and every task after', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fake = fakeWorker({ answers: false });
    const make = vi.fn(() => fake.w);
    const tasks = createTrackerTasks(make);
    const pending = tasks.run({ kind: 'read', text: JIRA, name: 'issues.csv' });
    fake.fail();
    fake.fail();
    expect(await pending).toMatchObject({ board: { source: 'jira' } });
    expect(fake.w.terminate).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
    expect((await tasks.run({ kind: 'plan', key: 1, ctx })).creates).toHaveLength(2);
    expect(make).toHaveBeenCalledOnce();
  });

  it('shares one set of tasks across the page', () => {
    expect(trackerTasks()).toBe(trackerTasks());
  });
});

describe('the cost on the page', () => {
  it('hands the page a summary of the board, not the board', () => {
    const big = ['Summary,Issue key,Status']
      .concat(Array.from({ length: 2_000 }, (_, i) => `Issue ${i},K-${i},To Do`))
      .join('\n');
    const runner = createTrackerRunner();
    const read = runner.run({ kind: 'read', text: big, name: 'big.csv' });
    // What crosses back to the page is a few dozen bytes, whatever the file's size.
    expect(JSON.stringify(read).length).toBeLessThan(80);
  });
});
