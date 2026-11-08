// Undo and redo snapshots that take a peer's ops lazily (docs/specs/012-collaboration/realtime-conflict-resolution.md
// "Locked decisions", Undo is local).
//
// A peer's op belongs in every undo and redo snapshot as well as on screen, so a restored snapshot already holds it
// and undo takes back only the person's own edits. Applying each op to every snapshot when it arrived cost one pass
// over the tab per snapshot (12 ms per op, 6 s for an agent's 500-element changeset, on a 2,000-element tab with 500
// steps) and gave every snapshot a fresh copy of the tab, undoing the sharing between snapshots.
//
// So the history keeps the ops instead: an append-only log, and for each snapshot the log position it was taken at.
// Restoring a snapshot (undo, redo, a cancelled gesture) applies only the ops it is missing, in arrival order, which
// gives exactly what applying them on arrival would have, since an op is a pure function of the state it is given.
// Ops next to each other in one run (a peer's element ops on one tab) are applied together, one pass over the tab
// for the whole run. The log reaches back only to the oldest snapshot still held, and holds at most
// REMOTE_OP_LOG_LIMIT ops: past that, the snapshots behind take the oldest half of it, run by run, and it is dropped.
//
// Generic over the snapshot (an editor's tab list); each editor's history module builds its transitions on these.

/** Most ops the log holds (safe range 50 to ~5,000). A restore replays at most this many. Past it, the snapshots
 *  still missing the oldest half take it and it is dropped: about one eager pass over the history every
 *  REMOTE_OP_LOG_LIMIT / 2 ops while every op is in a run, never more than an eager pass per op. */
export const REMOTE_OP_LOG_LIMIT = 500;

/** Ops that can be applied together: `items` of consecutive ops with the same `key` and the same `applyAll` are
 *  concatenated and applied in one call, which must equal applying the ops one by one. */
export type RemoteOpRun<S> = {
  readonly key: string;
  readonly items: readonly unknown[];
  readonly applyAll: (state: S, key: string, items: readonly unknown[]) => S;
};

/** A peer's op as a pure function of the state: it returns its input when it changes nothing there. With `run`, it
 *  can be applied together with its neighbours in the same run. */
export type RemoteOp<S> = ((state: S) => S) & { readonly run?: RemoteOpRun<S> };

/** The ops some snapshot still lacks, oldest first. `ops[0]` sits at log position `start`, so the head (the position
 *  the present has reached) is `start + ops.length`. */
export type RemoteOpLog<S> = { readonly start: number; readonly ops: readonly RemoteOp<S>[] };

/** A bounded undo / redo history whose snapshots take peer ops lazily. `pastAt` / `futureAt` run beside `past` /
 *  `future`: the log position each snapshot was taken at. Absent (a history built by hand, or one with no peer op
 *  yet) means every snapshot is up to date. */
export type RebasingHistory<S> = {
  past: S[];
  present: S;
  future: S[];
  pastAt?: number[];
  futureAt?: number[];
  remote?: RemoteOpLog<S>;
};

type Stacks<S> = Pick<RebasingHistory<S>, 'past' | 'future' | 'pastAt' | 'futureAt' | 'remote'>;

const headOf = <S>(log: RemoteOpLog<S> | undefined): number =>
  log ? log.start + log.ops.length : 0;

// The positions beside a stack, filling in "up to date" for a stack built without them.
function positions(at: number[] | undefined, length: number, head: number): number[] {
  return at !== undefined && at.length === length ? at : new Array<number>(length).fill(head);
}

const sameRun = <S>(a: RemoteOpRun<S>, b: RemoteOpRun<S> | undefined): boolean =>
  b !== undefined && a.key === b.key && a.applyAll === b.applyAll;

// `snapshot`, taken at log position `at`, with the ops from there up to position `to` applied in order: one call per
// run of ops that go together, one per op otherwise.
function caughtUp<S>(
  log: RemoteOpLog<S> | undefined,
  snapshot: S,
  at: number,
  to = headOf(log),
): S {
  if (!log) return snapshot;
  const { ops } = log;
  const end = to - log.start;
  let state = snapshot;
  let i = Math.max(0, at - log.start);
  while (i < end) {
    const op = ops[i]!;
    const run = op.run;
    let j = i + 1;
    if (run) while (j < end && sameRun(run, ops[j]!.run)) j++;
    if (j - i === 1) state = op(state);
    else
      state = run!.applyAll(
        state,
        run!.key,
        ops.slice(i, j).flatMap((o) => o.run!.items),
      );
    i = j;
  }
  return state;
}

// Drop the ops every live snapshot already holds; no snapshot left, no log.
function settled<S>(stacks: Stacks<S>): Stacks<S> {
  const { past, future, remote } = stacks;
  if (past.length === 0 && future.length === 0) {
    return { past, future, pastAt: [], futureAt: [], remote: undefined };
  }
  if (!remote) return stacks;
  let oldest = headOf(remote);
  for (const at of stacks.pastAt!) if (at < oldest) oldest = at;
  for (const at of stacks.futureAt!) if (at < oldest) oldest = at;
  if (oldest <= remote.start) return stacks;
  return { ...stacks, remote: { start: oldest, ops: remote.ops.slice(oldest - remote.start) } };
}

// Bring every snapshot taken before position `to` up to it, then drop the ops before it: what keeps the log within
// its limit.
function retiredTo<S>(stacks: Stacks<S>, to: number): Stacks<S> {
  const remote = stacks.remote!;
  const advance = (snapshots: S[], at: number[]): [S[], number[]] => {
    let outSnapshots = snapshots;
    let outAt = at;
    at.forEach((position, i) => {
      if (position >= to) return;
      if (outSnapshots === snapshots) {
        outSnapshots = snapshots.slice();
        outAt = at.slice();
      }
      outSnapshots[i] = caughtUp(remote, snapshots[i]!, position, to);
      outAt[i] = to;
    });
    return [outSnapshots, outAt];
  };
  const [past, pastAt] = advance(stacks.past, stacks.pastAt!);
  const [future, futureAt] = advance(stacks.future, stacks.futureAt!);
  return settled({
    past,
    pastAt,
    future,
    futureAt,
    remote: { start: to, ops: remote.ops.slice(to - remote.start) },
  });
}

/** A peer's op: applied to the present now and logged for the snapshots, which take it when restored. Returns `h`
 *  itself when the op changes nothing on screen and there is no snapshot to log it for. */
export function withRemoteOp<S, H extends RebasingHistory<S>>(
  h: H & RebasingHistory<S>,
  apply: RemoteOp<S>,
): H {
  const present = apply(h.present);
  if (h.past.length === 0 && h.future.length === 0)
    return present === h.present ? h : { ...h, present };
  const head = headOf(h.remote);
  let stacks: Stacks<S> = {
    past: h.past,
    future: h.future,
    pastAt: positions(h.pastAt, h.past.length, head),
    futureAt: positions(h.futureAt, h.future.length, head),
    remote: { start: h.remote?.start ?? head, ops: [...(h.remote?.ops ?? []), apply] },
  };
  if (stacks.remote!.ops.length > REMOTE_OP_LOG_LIMIT) {
    stacks = retiredTo(stacks, headOf(stacks.remote) - Math.floor(REMOTE_OP_LOG_LIMIT / 2));
  }
  return { ...h, ...stacks, present };
}

/** The stacks after a new step: the present pushed onto the past (capped at `limit`), the redo side cleared. */
export function stacksAfterStep<S>(h: RebasingHistory<S>, limit: number): Stacks<S> {
  const head = headOf(h.remote);
  return settled({
    past: [...h.past, h.present].slice(-limit),
    pastAt: [...positions(h.pastAt, h.past.length, head), head].slice(-limit),
    future: [],
    futureAt: [],
    remote: h.remote,
  });
}

/** The stacks with the redo side cleared and the past kept: a new step that is not a snapshot. */
export function stacksWithoutRedo<S>(h: RebasingHistory<S>): Stacks<S> {
  return settled({
    past: h.past,
    pastAt: positions(h.pastAt, h.past.length, headOf(h.remote)),
    future: [],
    futureAt: [],
    remote: h.remote,
  });
}

/** Step back: the newest past snapshot, brought up to date, and the stacks without it. With `keepPresent` (undo)
 *  the present goes onto the redo side, capped at `limit`; without it (a cancelled gesture) it is discarded. Call only
 *  when the past is not empty. */
export function stepBack<S>(
  h: RebasingHistory<S>,
  limit: number,
  keepPresent: boolean,
): { snapshot: S; stacks: Stacks<S> } {
  const head = headOf(h.remote);
  const pastAt = positions(h.pastAt, h.past.length, head);
  const futureAt = positions(h.futureAt, h.future.length, head);
  const last = h.past.length - 1;
  return {
    snapshot: caughtUp(h.remote, h.past[last]!, pastAt[last]!),
    stacks: settled({
      past: h.past.slice(0, -1),
      pastAt: pastAt.slice(0, -1),
      future: keepPresent ? [h.present, ...h.future].slice(0, limit) : h.future,
      futureAt: keepPresent ? [head, ...futureAt].slice(0, limit) : futureAt,
      remote: h.remote,
    }),
  };
}

/** Step forward (redo): the next future snapshot, brought up to date, and the stacks with the present pushed onto
 *  the past (capped at `limit`). Call only when the future is not empty. */
export function stepForward<S>(
  h: RebasingHistory<S>,
  limit: number,
): { snapshot: S; stacks: Stacks<S> } {
  const head = headOf(h.remote);
  const futureAt = positions(h.futureAt, h.future.length, head);
  return {
    snapshot: caughtUp(h.remote, h.future[0]!, futureAt[0]!),
    stacks: settled({
      past: [...h.past, h.present].slice(-limit),
      pastAt: [...positions(h.pastAt, h.past.length, head), head].slice(-limit),
      future: h.future.slice(1),
      futureAt: futureAt.slice(1),
      remote: h.remote,
    }),
  };
}

/** Empty stacks and no log: a history starting over. */
export function clearedStacks<S>(): Stacks<S> {
  return { past: [], future: [], pastAt: [], futureAt: [], remote: undefined };
}

/** One snapshot as a restore would see it, every op it is missing applied: for tests and inspection. */
export function rebasedSnapshot<S>(
  h: RebasingHistory<S>,
  side: 'past' | 'future',
  index: number,
): S {
  const head = headOf(h.remote);
  const stack = side === 'past' ? h.past : h.future;
  const at = positions(side === 'past' ? h.pastAt : h.futureAt, stack.length, head);
  return caughtUp(h.remote, stack[index]!, at[index]!);
}

/** How many peer ops the history is holding for its snapshots. */
export function remoteOpCount<S>(h: RebasingHistory<S>): number {
  return h.remote?.ops.length ?? 0;
}
