// Home's reads, folded (README "How it loads"). Home opens with three questions about items, each asked from its own
// part of the page, and two about what was shared:
//
//   - Jump Back In: Recent's first page with Most Used beside it (HomePane);
//   - the hero's pill: how many items are in My Work (HomeHero);
//   - the first run: whether the person can open anything at all (WelcomeProvider);
//   - Shared With You Recently (HomePane) and the sidebar's Shared With Me count (one page of the same list).
//
// Asked in the same tick (the effects of one commit), the items' questions go to the index as one request
// (`view=recent&used=…&mine=…&any=1`), and the two Shared reads as one page of the larger size, each asker taking
// its own part. Asked alone, each is the one request it always was. A request is cancelled only once every asker
// has let go of it.

import { LIST_LIMIT_MAX, type App, type IndexClient, type Item } from '@liveworkspace/index-client';
import type { AppFilter } from '../words';

/** Recent's first page and its Most Used. */
export type RecentAsk = { limit: number; used: number };
export type RecentAnswer = { items: Item[]; nextCursor: string | null; mostUsed: Item[] };
export type MineAnswer = { count: number; more: boolean };

type HomeAsk = { recent?: RecentAsk; mine?: number; any?: true };
type HomeAnswer = { recent?: RecentAnswer; mine?: MineAnswer; any?: boolean };

type SharedPage = Awaited<ReturnType<IndexClient['listShared']>>;

type Waiter<A, R> = {
  ask: A;
  resolve: (answer: R) => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
};

type Batch<A, R> = { waiters: Waiter<A, R>[] };

const abortError = () => new DOMException('The read was cancelled.', 'AbortError');

/**
 * One request for the asks made under the same key in the same tick. `run` gets every live ask and a signal that
 * aborts only when every asker has aborted; each asker gets the shared answer back.
 */
function batcher<A, R>(run: (client: IndexClient, asks: A[], signal: AbortSignal) => Promise<R>) {
  const open = new WeakMap<IndexClient, Map<string, Batch<A, R>>>();
  return (client: IndexClient, key: string, ask: A, signal?: AbortSignal): Promise<R> =>
    new Promise<R>((resolve, reject) => {
      if (signal?.aborted) return reject(abortError());
      const waiter: Waiter<A, R> = { ask, resolve, reject, signal };
      signal?.addEventListener('abort', () => reject(abortError()), { once: true });
      let byKey = open.get(client);
      if (!byKey) open.set(client, (byKey = new Map()));
      const batch = byKey.get(key);
      if (batch) {
        batch.waiters.push(waiter);
        return;
      }
      const fresh: Batch<A, R> = { waiters: [waiter] };
      byKey.set(key, fresh);
      queueMicrotask(() => {
        byKey.delete(key);
        const live = fresh.waiters.filter((w) => !w.signal?.aborted);
        if (live.length === 0) return;
        const controller = new AbortController();
        let left = live.length;
        for (const w of live) {
          w.signal?.addEventListener(
            'abort',
            () => {
              left -= 1;
              if (left === 0) controller.abort();
            },
            { once: true },
          );
        }
        run(
          client,
          live.map((w) => w.ask),
          controller.signal,
        ).then(
          (answer) => {
            for (const w of live) w.resolve(answer);
          },
          (error: unknown) => {
            for (const w of live) w.reject(error);
          },
        );
      });
    });
}

const scopeKey = (app: App, filter: AppFilter) => (filter === 'app' ? app : '*');
const appOf = (app: App, filter: AppFilter) => (filter === 'app' ? { app } : {});

const homeBatch = batcher<HomeAsk & { scope: { app: App; filter: AppFilter } }, HomeAnswer>(
  async (client, asks, signal) => {
    const { app, filter } = asks[0]!.scope;
    const recents = asks.flatMap((a) => (a.recent ? [a.recent] : []));
    const mines = asks.flatMap((a) => (a.mine ? [a.mine] : []));
    const recent =
      recents.length > 0
        ? {
            limit: Math.max(...recents.map((r) => r.limit)),
            used: Math.max(...recents.map((r) => r.used)),
          }
        : null;
    const mine = mines.length > 0 ? Math.min(Math.max(...mines), LIST_LIMIT_MAX) : undefined;
    const any = asks.some((a) => a.any);
    // Recent's page carries the others; without it, the smallest page of everything that opens carries them, and
    // itself says whether anything does.
    const res = await client.listItems(
      recent
        ? {
            view: 'recent',
            limit: recent.limit,
            used: recent.used,
            mine,
            any: any || undefined,
            ...appOf(app, filter),
          }
        : { view: 'search', limit: 1, mine, ...appOf(app, filter) },
      { signal },
    );
    const answer: HomeAnswer = {};
    if (recent)
      answer.recent = {
        items: res.items,
        nextCursor: res.nextCursor,
        mostUsed: res.mostUsed ?? [],
      };
    if (mine !== undefined && res.mine) answer.mine = res.mine;
    if (any) answer.any = recent ? res.any : res.items.length > 0;
    return answer;
  },
);

function askHome(
  c: IndexClient,
  app: App,
  filter: AppFilter,
  ask: HomeAsk,
  signal?: AbortSignal,
): Promise<HomeAnswer> {
  return homeBatch(c, scopeKey(app, filter), { ...ask, scope: { app, filter } }, signal);
}

/** Jump Back In's read: Recent's first page with Most Used, folded with Home's other reads asked with it. */
export async function readRecentForHome(
  c: IndexClient,
  app: App,
  filter: AppFilter,
  recent: RecentAsk,
  signal?: AbortSignal,
): Promise<RecentAnswer> {
  const answer = await askHome(c, app, filter, { recent }, signal);
  return answer.recent!;
}

/** My Work's count up to `cap`, for the hero's pill. */
export async function readMineCount(
  c: IndexClient,
  app: App,
  filter: AppFilter,
  cap: number,
  signal?: AbortSignal,
): Promise<MineAnswer> {
  const answer = await askHome(c, app, filter, { mine: cap }, signal);
  if (answer.mine) return answer.mine;
  // An index that doesn't count beside a page: one page of My Work, counted.
  const res = await c.listItems(
    { view: 'all', team: 'personal', limit: cap, ...appOf(app, filter) },
    { signal },
  );
  return { count: res.items.length, more: res.nextCursor !== null };
}

/** Whether the person can open anything at all, for the first run. */
export async function readAnyItem(
  c: IndexClient,
  app: App,
  filter: AppFilter,
  signal?: AbortSignal,
): Promise<boolean> {
  const answer = await askHome(c, app, filter, { any: true }, signal);
  if (answer.any !== undefined) return answer.any;
  const res = await c.listItems({ view: 'search', limit: 1, ...appOf(app, filter) }, { signal });
  return res.items.length > 0;
}

const sharedBatch = batcher<{ app: App; filter: AppFilter; limit: number }, SharedPage>(
  (client, asks, signal) => {
    const { app, filter } = asks[0]!;
    const limit = Math.min(Math.max(...asks.map((a) => a.limit)), LIST_LIMIT_MAX);
    return client.listShared({ limit, ...appOf(app, filter) }, { signal });
  },
);

/**
 * Shared With Me's first page of `limit`, folded with any other first page of it asked in the same tick: the larger
 * page is read once and each asker takes its own (`shared` cut to its limit; `more` whether its own page was full).
 */
export async function readSharedFirstPage(
  c: IndexClient,
  app: App,
  filter: AppFilter,
  limit: number,
  signal?: AbortSignal,
): Promise<{ shared: SharedPage['shared']; more: boolean }> {
  const res = await sharedBatch(c, scopeKey(app, filter), { app, filter, limit }, signal);
  return {
    shared: res.shared.slice(0, limit),
    more: res.shared.length > limit || res.nextCursor !== null,
  };
}
