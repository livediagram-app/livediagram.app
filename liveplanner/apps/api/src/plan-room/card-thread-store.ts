// A card's comment threads across plans (docs/specs/026-plan/items.md "Comments", blueprint item-store.md "Across
// plans"). A thread is stored once, in its home plan's own SQLite; every write is applied there, by
// `writeThread`, whichever plan it was made through: directly when the caller views it through the home, else over
// the home's `threadWrite` RPC. The home then tells every other plan the thread is on (`threadsRelayed`), which keeps
// its links' counts, keys its Inbox push and relays the room op to its sessions.
//
// The plan a write comes through (`via`) has already checked the caller's role on it; the home checks the thread
// still lists a card of that plan, and the actor's right to the write against the thread as stored (author ids are
// whole here). Nothing a browser sends reaches this but through those routes.

import {
  CARD_THREADS_MAX,
  applyThreadChange,
  threadForRoom,
  type CardThread,
  type ThreadChange,
  type ThreadRefusal,
  threadOnlyBy,
} from '@liveplanner/project';
import {
  deleteLinksStatement,
  deleteThreadStatement,
  insertLinkStatement,
  insertThreadStatement,
  linksOfPlan,
  linksOfThread,
  openCommentsStatement,
  readThread,
  readThreads,
  threadCountOfItem,
  updateThreadStatement,
  type ThreadLink,
} from '../db/card-threads';
import { readItem } from '../db/items';
import { planRoom } from '../plan-client';
import { relayThreads } from '../room-client';
import type { PlanEnv } from '../types';

/** Who is writing, as the plan they came through settled it. `editor`: an Editor there; `agent`: an API token. */
export type ThreadActor = { owner: string; editor: boolean; agent: boolean };

export type ThreadOp =
  | { kind: 'change'; change: ThreadChange; actor: ThreadActor }
  | { kind: 'delete'; actor: ThreadActor };

export type ThreadError =
  | Exclude<ThreadRefusal, 'unchanged'>
  | 'thread_not_found'
  | 'forbidden'
  | 'thread_busy'
  | 'thread_has_others';

export type ThreadWriteResult =
  { ok: true; thread: CardThread | null } | { ok: false; error: ThreadError | 'unchanged' };

// How long a new link may wait for its home to list its card before a read takes it as stale.
export const LINK_GRACE_MS = 120_000;

// Lost races a write retries before it answers thread_busy (an item write's ITEM_WRITE_RETRIES).
const THREAD_WRITE_RETRIES = 4;

// What `actor` may not do to `thread` (null: they may): the rules items.md "Who may do what" gives each write.
// A thread is deleted only by someone every comment in it is theirs, Editors included; an agent never.
export function threadRightRefusal(
  thread: CardThread,
  op: ThreadOp,
): 'forbidden' | 'thread_has_others' | null {
  const { actor } = op;
  if (op.kind === 'delete') {
    if (actor.agent) return 'forbidden';
    return threadOnlyBy(thread, actor.owner) ? null : 'thread_has_others';
  }
  const change = op.change;
  const own = (commentId: string) => {
    const c = thread.comments.find((x) => x.id === commentId);
    // A missing comment is the write's own refusal (comment_not_found), not a right.
    if (!c) return true;
    return c.authorId === actor.owner && (!actor.agent || c.ai === true);
  };
  switch (change.kind) {
    case 'edit':
      return own(change.commentId) ? null : 'forbidden';
    case 'remove':
      return own(change.commentId) || (actor.editor && !actor.agent) ? null : 'forbidden';
    // Agents read reactions, never leave them (docs/specs/012-collaboration/comment-reactions.md).
    case 'rename':
    case 'addCard':
    case 'react':
      return actor.agent ? 'forbidden' : null;
    default:
      return null;
  }
}

type Defer = (p: Promise<unknown>) => void;

/** One write on a thread `home` stores, made through plan `via`. Applied to the thread as stored, guarded by its rev
 *  (a lost race reads again), then told to every plan it is on. */
export async function writeThread(
  env: PlanEnv,
  home: string,
  threadId: string,
  op: ThreadOp,
  via: string,
  defer: Defer,
): Promise<ThreadWriteResult> {
  for (let attempt = 1; attempt <= THREAD_WRITE_RETRIES; attempt += 1) {
    const thread = await readThread(env, home, threadId);
    if (!thread || !thread.cards.some((c) => c.projectId === via))
      return { ok: false, error: 'thread_not_found' };
    const refused = threadRightRefusal(thread, op);
    if (refused) {
      console.info('[threads] write.refused', {
        kind: opKind(op),
        agent: op.actor.agent,
        error: refused,
      });
      return { ok: false, error: refused };
    }
    let next: CardThread | null;
    if (op.kind === 'delete') next = null;
    else {
      const result = applyThreadChange(thread, op.change, Date.now());
      if (!result.ok) return { ok: false, error: result.reason };
      next = result.thread;
    }
    const landed =
      next === null
        ? await env.PLAN_DB.batch([
            deleteThreadStatement(env, home, threadId),
            deleteLinksStatement(env, home, threadId),
          ]).then((r) => (r[0]?.meta?.changes ?? 0) > 0)
        : await env.PLAN_DB.batch([
            updateThreadStatement(env, next, thread.rev),
            openCommentsStatement(env, home, next),
          ]).then((r) => (r[0]?.meta?.changes ?? 0) > 0);
    if (landed) {
      console.info('[threads] written', { kind: opKind(op), gone: next === null });
      defer(relayThread(env, home, thread, next));
      return { ok: true, thread: next };
    }
    console.info('[threads] write.retry', { attempt });
  }
  console.warn('[threads] write.busy');
  return { ok: false, error: 'thread_busy' };
}

const opKind = (op: ThreadOp) => (op.kind === 'delete' ? 'delete' : op.change.kind);

/** A new thread, stored here, on one of this plan's cards (which the caller already found). */
export async function insertThread(env: PlanEnv, thread: CardThread, defer: Defer): Promise<void> {
  const card = thread.cards[0]!;
  await env.PLAN_DB.batch([
    insertThreadStatement(env, thread),
    insertLinkStatement(env, thread.home, {
      itemId: card.itemId,
      threadId: thread.id,
      home: thread.home,
      openComments: thread.comments.length,
    }),
  ]);
  defer(relayThread(env, thread.home, null, thread));
}

/** The threads of `ids` stored here that list a card of plan `via`: what that plan may read of them. */
export async function threadsForVia(
  env: PlanEnv,
  home: string,
  ids: readonly string[],
  via: string,
): Promise<CardThread[]> {
  const threads = await readThreads(env, home, ids);
  return threads.filter((t) => t.cards.some((c) => c.projectId === via));
}

export type ThreadLinkRefusal = 'item_not_found' | 'threads_full' | 'thread_on_card';
// The card's number, for the thread's card list, or why it takes no link.
export type ThreadLinked = { ok: true; key: number } | { ok: false; error: ThreadLinkRefusal };

/** A card of this plan takes a thread (stored here or elsewhere): its link, after the card and its room are checked. */
export async function linkThread(
  env: PlanEnv,
  plan: string,
  link: { threadId: string; home: string; itemId: string; openComments: number },
): Promise<ThreadLinked> {
  const item = await readItem(env, plan, link.itemId);
  if (!item) return { ok: false, error: 'item_not_found' };
  const held = await linksOfThread(env, plan, link.threadId);
  if (held.some((l) => l.itemId === link.itemId)) return { ok: false, error: 'thread_on_card' };
  if ((await threadCountOfItem(env, plan, link.itemId)) >= CARD_THREADS_MAX)
    return { ok: false, error: 'threads_full' };
  await insertLinkStatement(env, plan, link).run();
  return { ok: true, key: item.key };
}

/** Takes a link `linkThread` made back off (the home then refused the card). */
export async function unlinkThread(
  env: PlanEnv,
  plan: string,
  threadId: string,
  itemId: string,
): Promise<void> {
  await deleteLinksStatement(env, plan, threadId, [itemId]).run();
}

export type ThreadsRelay = { upserts: CardThread[]; removed: string[] };

/** What another plan's write means here: each thread's count on this plan's cards (keying the Inbox push), a removed
 *  thread's links gone, and the room told. Answers the upserted threads this plan holds no link to (`gone`), so the
 *  home takes this plan's cards off them. */
export async function threadsRelayed(
  env: PlanEnv,
  plan: string,
  relay: ThreadsRelay,
): Promise<string[]> {
  const links = await linksOfPlan(env, plan);
  const linked = new Set(links.map((l) => l.threadId));
  const held = relay.upserts.filter((t) => linked.has(t.id));
  const gone = relay.upserts.filter((t) => !linked.has(t.id)).map((t) => t.id);
  const stmts = [
    ...held.map((t) => openCommentsStatement(env, plan, t)),
    ...relay.removed
      .filter((id) => linked.has(id))
      .map((id) => deleteLinksStatement(env, plan, id)),
  ];
  if (stmts.length) await env.PLAN_DB.batch(stmts);
  const removed = relay.removed.filter((id) => linked.has(id));
  if (held.length || removed.length)
    await relayThreads(env, plan, { kind: 'threads', upserts: held.map(threadForRoom), removed });
  return gone;
}

// Every plan the thread was or is on, the home first.
function plansOf(home: string, ...threads: (CardThread | null)[]): string[] {
  const plans = new Set<string>([home]);
  for (const t of threads) for (const c of t?.cards ?? []) plans.add(c.projectId);
  return [...plans];
}

/** Tells every plan `before` or `after` is on of the write: the home's own room directly, each other plan through
 *  its `threadsRelayed`. A plan that no longer holds the thread is taken off its cards (`card.gone`). Each failure is
 *  logged and left: the next read there reads the thread afresh. */
export async function relayThread(
  env: PlanEnv,
  home: string,
  before: CardThread | null,
  after: CardThread | null,
): Promise<void> {
  const id = (after ?? before)!.id;
  const relay: ThreadsRelay = after
    ? { upserts: [threadForRoom(after)], removed: [] }
    : { upserts: [], removed: [id] };
  await Promise.all(
    plansOf(home, before, after).map(async (plan) => {
      try {
        if (plan === home) {
          await relayThreads(env, home, { kind: 'threads', ...relay });
          return;
        }
        const gone = await planRoom(env, plan).threadsRelayed(relay);
        if (gone.includes(id) && after) await dropPlanCards(env, home, id, plan);
      } catch (err) {
        console.warn('[threads] relay.failed', { error: String(err) });
      }
    }),
  );
}

// A plan that answered it holds none of the thread's cards any more (a card deleted there before its home heard, a
// plan gone): its cards come off the thread, as a card delete would take them.
async function dropPlanCards(env: PlanEnv, home: string, id: string, plan: string): Promise<void> {
  const thread = await readThread(env, home, id);
  for (const card of thread?.cards.filter((c) => c.projectId === plan) ?? []) {
    console.info('[threads] card.gone');
    await writeThread(
      env,
      home,
      id,
      {
        kind: 'change',
        change: { kind: 'removeCard', projectId: plan, itemId: card.itemId },
        actor: SYSTEM_ACTOR,
      },
      plan,
      () => {},
    );
  }
}

// The plan itself, taking a gone card off a thread: never refused a right.
export const SYSTEM_ACTOR: ThreadActor = { owner: '', editor: true, agent: false };

/** Every thread on a card of plan `plan`: its own, read here, and each other home's in one call per home. A home
 *  that answers without a thread no longer holds it there, and the stale links go; one that cannot answer is left
 *  out this time (`home.unreachable`). */
export async function planThreads(
  env: PlanEnv,
  plan: string,
  links?: readonly ThreadLink[],
): Promise<CardThread[]> {
  const all = links ?? (await linksOfPlan(env, plan));
  const byHome = new Map<string, Set<string>>();
  for (const l of all) {
    const ids = byHome.get(l.home) ?? new Set<string>();
    ids.add(l.threadId);
    byHome.set(l.home, ids);
  }
  const parts = await Promise.all(
    [...byHome].map(async ([home, ids]): Promise<CardThread[]> => {
      const wanted = [...ids];
      if (home === plan) return readThreads(env, plan, wanted);
      try {
        const got = await planRoom(env, home).threadsFor(wanted, plan);
        const held = new Set(got.map((t) => t.id));
        // A link a moment old may be waiting on its home to list the card (Add to Card links first).
        const settled = Date.now() - LINK_GRACE_MS;
        const stale = wanted.filter(
          (id) => !held.has(id) && all.some((l) => l.threadId === id && l.addedAt < settled),
        );
        if (stale.length) {
          console.info('[threads] links.stale', { count: stale.length });
          await env.PLAN_DB.batch(stale.map((id) => deleteLinksStatement(env, plan, id)));
        }
        return got;
      } catch (err) {
        console.warn('[threads] home.unreachable', { error: String(err) });
        return [];
      }
    }),
  );
  return parts.flat();
}
