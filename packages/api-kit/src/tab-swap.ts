// The room's writes of one stored tab row: a compare-and-swap, and a per-tab drain of the Participant changes waiting
// for it (each product's docs/specs/013-workspace/blueprints/share-roles.md "Behaviour and state", the Write step).
//
// A Participant never saves a whole tab: the room applies each change it sends to the STORED tab and writes the row
// back only when nobody wrote it since. The guard is the row's version, its `rev` with its `updated_at`: the
// `tabs_rev_advances` trigger makes every write of `data` advance `rev` by exactly one, so a row still at the version
// we read still holds the body we read, and the swap never binds or compares the body itself. `updated_at` closes the
// one gap the trigger leaves, a tab deleted and inserted again under its id at the revision we read.
//
// Changes queued for one tab drain together (`TabChangeQueue`): one read and parse, every change applied in order to
// the tab the change before it produced, one write. Each change answers exactly what it would have alone: in order,
// against the same tab, and a change that throws fails alone. Only a tab over its cap is a question per change (which
// one pushed it over), so a drain the cap refuses answers each change on its own, as it always did.

/** How many re-reads a write takes before it gives up (409): only an autosave or a linked tab's room beats it. */
export const TAB_CAS_MAX_ATTEMPTS = 8;

/** A stored tab row's version: the compare-and-swap's guard. */
export type TabVersion = { rev: number; updatedAt: number };

/** A stored tab row as a write reads it. */
export type StoredTabRow = TabVersion & { data: string };

export type TabSwapFailure = { ok: false; status: 404 | 409 | 413 };
export type TabSwapResult<T> = { ok: true; answer: T } | TabSwapFailure;

type NamedTab = { id: string; name: string };

/** The stored body: the tab without its id and name, which the row keeps elsewhere. */
export type StoredTabBody<Tab extends NamedTab> = Omit<Tab, 'id' | 'name'>;

/** One change: the next tab, or null to write nothing, and what it answers. Pure. */
export type TabChange<Tab, T> = (tab: Tab) => { next: Tab | null; answer: T };

/** One product's tab row, as the swap reaches it. */
export type TabSwapStore<Tab extends NamedTab> = {
  tabId: string;
  read: () => Promise<StoredTabRow | null>;
  /** Writes `data` (`body`, serialised) only while the row is at `expected`; answers whether it did. */
  write: (expected: TabVersion, data: string, body: StoredTabBody<Tab>) => Promise<boolean>;
  /** The product's over-the-cap error, answered as 413. */
  tooLarge: (error: unknown) => boolean;
};

/** What one change of a drain came to: its result, or the error it threw (it alone fails). */
export type TabChangeOutcome<T> = TabSwapResult<T> | { ok: 'threw'; error: unknown };

const failAll = <T>(count: number, status: TabSwapFailure['status']): TabChangeOutcome<T>[] =>
  Array.from({ length: count }, () => ({ ok: false, status }));

/** Applies `changes` in order to the stored tab and writes the result once, re-reading while another writer wins. */
export async function swapTabChanges<Tab extends NamedTab, T>(
  store: TabSwapStore<Tab>,
  changes: readonly TabChange<Tab, T>[],
): Promise<TabChangeOutcome<T>[]> {
  for (let attempt = 0; attempt < TAB_CAS_MAX_ATTEMPTS; attempt++) {
    const row = await store.read();
    if (row === null) return failAll(changes.length, 404);
    let tab = { ...(JSON.parse(row.data) as object), id: store.tabId, name: '' } as Tab;
    let changed = false;
    const outcomes = changes.map((change): TabChangeOutcome<T> => {
      try {
        const { next, answer } = change(tab);
        if (next !== null) {
          tab = next;
          changed = true;
        }
        return { ok: true, answer };
      } catch (error) {
        return { ok: 'threw', error };
      }
    });
    if (!changed) return outcomes;
    const { id: _id, name: _name, ...body } = tab;
    try {
      if (await store.write(row, JSON.stringify(body), body)) return outcomes;
    } catch (error) {
      if (!store.tooLarge(error)) throw error;
      if (changes.length === 1) return [{ ok: false, status: 413 }];
      return eachAlone(store, changes);
    }
  }
  return failAll(changes.length, 409);
}

// Which change pushed the tab over its cap: each answered as it would be alone, in order. A store error on one
// change is that change's answer alone: the changes before it are already written, so throwing would tell their
// senders they failed (and they would send them again).
async function eachAlone<Tab extends NamedTab, T>(
  store: TabSwapStore<Tab>,
  changes: readonly TabChange<Tab, T>[],
): Promise<TabChangeOutcome<T>[]> {
  const outcomes: TabChangeOutcome<T>[] = [];
  for (const change of changes) {
    try {
      outcomes.push(...(await swapTabChanges(store, [change])));
    } catch (error) {
      outcomes.push({ ok: 'threw', error });
    }
  }
  return outcomes;
}

/** One change on its own: its result, or its error thrown. */
export async function swapTabChange<Tab extends NamedTab, T>(
  store: TabSwapStore<Tab>,
  change: TabChange<Tab, T>,
): Promise<TabSwapResult<T>> {
  const [outcome] = await swapTabChanges(store, [change]);
  return settled(outcome!);
}

function settled<T>(outcome: TabChangeOutcome<T>): TabSwapResult<T> {
  if (outcome.ok === 'threw') throw outcome.error;
  return outcome;
}

type Waiting = {
  change: TabChange<never, unknown>;
  resolve: (result: TabSwapResult<unknown>) => void;
  reject: (error: unknown) => void;
};

type Drain = { store: TabSwapStore<never>; waiting: Waiting[] };

/** Runs one step on the room's tab write queue, after every step before it. */
export type TabWriteEnqueue = <T>(step: () => Promise<T>) => Promise<T>;

// A macrotask turn: frames that reached the room while it was busy are taken before the drain starts, so they join it.
const nextTurn = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * The room's Participant changes, drained per tab on its tab write queue. The first change for a tab puts one drain
 * on the queue; every change for that tab that arrives before the drain starts joins it.
 */
export class TabChangeQueue {
  private readonly drains = new Map<string, Drain>();

  private readonly enqueue: TabWriteEnqueue;

  private readonly turn: () => Promise<void>;

  constructor(enqueue: TabWriteEnqueue, turn: () => Promise<void> = nextTurn) {
    this.enqueue = enqueue;
    this.turn = turn;
  }

  /** Queues `change` for the tab `key` names; `store` is asked for once per drain. */
  submit<Tab extends NamedTab, T>(
    key: string,
    store: () => TabSwapStore<Tab>,
    change: TabChange<Tab, T>,
  ): Promise<TabSwapResult<T>> {
    return new Promise<TabSwapResult<T>>((resolve, reject) => {
      let drain = this.drains.get(key);
      if (!drain) {
        drain = { store: store() as unknown as TabSwapStore<never>, waiting: [] };
        this.drains.set(key, drain);
        // The turn starts now, so a busy queue costs it nothing.
        const ready = this.turn();
        const mine = drain;
        void this.enqueue(async () => {
          await ready;
          // Closed from here: a change arriving while this one writes waits for the next drain.
          this.drains.delete(key);
          await this.run(mine);
        });
      }
      drain.waiting.push({
        change: change as unknown as TabChange<never, unknown>,
        resolve: resolve as (result: TabSwapResult<unknown>) => void,
        reject,
      });
    });
  }

  private async run(drain: Drain): Promise<void> {
    let outcomes: TabChangeOutcome<unknown>[];
    try {
      outcomes = await swapTabChanges(
        drain.store,
        drain.waiting.map((w) => w.change),
      );
    } catch (error) {
      for (const w of drain.waiting) w.reject(error);
      return;
    }
    drain.waiting.forEach((w, i) => {
      const outcome = outcomes[i]!;
      if (outcome.ok === 'threw') w.reject(outcome.error);
      else w.resolve(outcome);
    });
  }
}
