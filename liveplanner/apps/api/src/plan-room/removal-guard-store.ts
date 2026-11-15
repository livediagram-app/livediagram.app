// The room's guard against mass card removals (docs/specs/012-collaboration/realtime-conflict-resolution.md "Mass card
// removals"; blueprint item-store.md "Mass removals"). It keeps each caller's run in memory: the boards as the run's
// first removal found them and every card the run has taken. A removal is admitted (and counted) or held at once, with
// no await between the judgement and the count, so two requests interleaving in the object cannot both slip under the
// limit. A held write is kept in the room's storage, the last REMOVAL_QUARANTINE_MAX of them.
//
// In memory on purpose, like the op-rate window (plan-room.ts): a hibernation wake starts every run over, and a burst
// of removals keeps the object awake, so a run in progress is never forgotten mid-burst.
import {
  REMOVAL_GUARD_WINDOW_MS,
  judgeRemoval,
  type RemovalBoard,
  type RemovalVerdict,
} from '@liveplanner/items';

export const REMOVAL_QUARANTINE_KEY = 'removal-quarantine';
// Spec "The quarantine log": the held writes kept, and the card ids kept of each. Safe ranges 10..200, 50..500.
export const REMOVAL_QUARANTINE_MAX = 50;
export const REMOVAL_QUARANTINE_IDS = 200;
// Runs held at once: past it the oldest is forgotten (a flood of distinct callers cannot grow the map). Safe 50..1000.
export const REMOVAL_RUNS_MAX = 200;

export type RemovalActor = { kind: 'person' | 'token'; id: string; name?: string };

// One held write, as the log keeps it.
export type HeldRemoval = RemovalVerdict & {
  at: number;
  actor: RemovalActor;
  cardIds: string[];
  // How many card ids the write named (cardIds keeps at most REMOVAL_QUARANTINE_IDS).
  named: number;
};

type Run = { last: number; boards: RemovalBoard[]; removed: Set<string> };

type GuardStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
};

const runKey = (a: RemovalActor) => `${a.kind}:${a.id}`;

export class RemovalGuard {
  private readonly runs = new Map<string, Run>();
  private readonly storage: GuardStorage;
  private readonly now: () => number;

  constructor(storage: GuardStorage, now: () => number = () => Date.now()) {
    this.storage = storage;
    this.now = now;
  }

  // The caller's run, if it is still going.
  private live(key: string, at: number): Run | undefined {
    const run = this.runs.get(key);
    if (run && at - run.last < REMOVAL_GUARD_WINDOW_MS) return run;
    if (run) this.runs.delete(key);
    return undefined;
  }

  /** Admits `ids` into the caller's run, or answers why they are held. `boardsOf` is read only when a run starts. */
  async admit(
    actor: RemovalActor,
    ids: readonly string[],
    boardsOf: () => Promise<RemovalBoard[]>,
  ): Promise<RemovalVerdict | null> {
    const key = runKey(actor);
    let run = this.live(key, this.now());
    if (!run) {
      const boards = await boardsOf();
      // Another request of the same caller may have started the run while the boards were read.
      run = this.live(key, this.now()) ?? { last: this.now(), boards, removed: new Set() };
    }
    const next = new Set(run.removed);
    for (const id of ids) next.add(id);
    const verdict = judgeRemoval(run.boards, next);
    run.last = this.now();
    // Kept, newest last, whether admitted or held: a caller still sending removals stays in its run.
    this.runs.delete(key);
    this.runs.set(key, run);
    if (this.runs.size > REMOVAL_RUNS_MAX) this.runs.delete(this.runs.keys().next().value!);
    if (verdict) return verdict;
    run.removed = next;
    return null;
  }

  /** Takes back ids an admitted write did not remove (a lost race, a card already gone). */
  release(actor: RemovalActor, ids: readonly string[]): void {
    const run = this.runs.get(runKey(actor));
    if (run) for (const id of ids) run.removed.delete(id);
  }

  /** Keeps a held write in the log, the newest last. */
  async quarantine(
    actor: RemovalActor,
    verdict: RemovalVerdict,
    ids: readonly string[],
  ): Promise<void> {
    const held: HeldRemoval = {
      ...verdict,
      at: this.now(),
      actor,
      cardIds: ids.slice(0, REMOVAL_QUARANTINE_IDS),
      named: ids.length,
    };
    const log = await this.held();
    log.push(held);
    await this.storage.put(REMOVAL_QUARANTINE_KEY, log.slice(-REMOVAL_QUARANTINE_MAX));
  }

  /** The held writes kept, oldest first. */
  async held(): Promise<HeldRemoval[]> {
    return [...((await this.storage.get<HeldRemoval[]>(REMOVAL_QUARANTINE_KEY)) ?? [])];
  }
}
