// The room's side of the collaboration ledger, shared by every product's room (liveworkspace/docs/specs/
// 002-architecture/architecture.md "A room's collaboration ledger"; each product's docs/specs/012-collaboration/
// collab-race-hardening.md). Each answer, tick, comment event or dot the room sequences is noted in DO storage, one
// key per element, and read back when the api merges a save. What an entry holds, and how a save is merged with it,
// is the product's pure `collab-ledger` module (`rules`); this stores the entries, stamps each with the op that last
// changed it, hands a save only the entries that can change it, and cuts the ones nobody has touched for a month.
//
// Cost: a save reads only the entries changed after its cursor or in the last day, found through an index of the
// tab's entries by the seq that last changed them (`ledger-seq:`), so a long-lived tab no longer reads, let alone
// ships, its whole month of entries on every autosave. Until a room's upkeep has indexed the entries written before
// the index existed (`ledger-indexed`), a save lists the tab as it used to. The daily upkeep pages through every
// ledger key once.

/** The storage value limit is 128 KiB; an entry that would pass it stops growing rather than failing the write. */
export const LEDGER_VALUE_MAX_CHARS = 120_000;
/** An entry changed this recently goes with every save, whatever its cursor (see `read`). */
export const LEDGER_RECENT_MS = 24 * 60 * 60 * 1000;
/** An entry nobody has touched this long is cut by the upkeep: the Trash's and the changesets' 30 days. */
export const LEDGER_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** Keys per upkeep page: what one page holds in memory at once. */
export const LEDGER_UPKEEP_PAGE = 128;
/** Every product keys its ledger under this. */
export const LEDGER_KEY_PREFIX = 'ledger:';
/** The highest seq the upkeep has cut: a save's cursor below it may have missed a cut entry. */
export const LEDGER_FLOOR_KEY = 'ledger-floor';
/** Each entry's row in its tab's index: `ledger-seq:<tab>:<seq, 16 digits>:<entry key>`, valued with its time. */
export const LEDGER_INDEX_PREFIX = 'ledger-seq:';
/** Set once an upkeep pass has indexed every entry: before it, a save lists the whole tab. */
export const LEDGER_INDEXED_KEY = 'ledger-indexed';
/** The room's seq at a moment, noted at most every LEDGER_MARK_EVERY_MS: where the last day starts in the index. */
export const LEDGER_MARKS_KEY = 'ledger-marks';
export const LEDGER_MARK_EVERY_MS = 60 * 60 * 1000;
/** Keys per batched get: the runtime's limit. */
export const LEDGER_GET_BATCH = 128;
const SEQ_DIGITS = 16;

/** The op that last changed an entry: its room seq and when the room took it. Never leaves the room. */
export type LedgerStamp = { seq: number; at: number };
const STAMP = 'ledgerStamp';

/** A product's pure ledger module, as the store calls it. */
export type LedgerRules<E extends object, L> = {
  ledgerKey(op: unknown): string | null;
  ledgerPrefix(tabId: string): string;
  recordInLedger(prev: E | undefined, op: unknown, seq: number): E | null;
  tabLedgerFrom(tabId: string, entries: Iterable<[string, unknown]>): L;
  // An entry whose merge needs every op of its round (a vote's dots, an idea box's cards): recorded afresh after a
  // cut, it would stand for the whole round. Kept while its tab lives.
  ledgerEntryAccumulates?(key: string, entry: E): boolean;
};

export type LedgerStorage = {
  get<T>(key: string): Promise<T | undefined>;
  get<T>(keys: string[]): Promise<Map<string, T>>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(opts: {
    prefix: string;
    startAfter?: string;
    limit?: number;
  }): Promise<Map<string, unknown>>;
};

/** What the upkeep is told: the time, the room's seq now, and the ids of the tabs the room stores (null: unknown). */
export type LedgerUpkeep = { now: number; seq: number; tabs: ReadonlySet<string> | null };
export type LedgerUpkeepResult = { dropped: number; stamped: number };

function stampOf(value: object): LedgerStamp | null {
  const s = (value as Record<string, unknown>)[STAMP] as Partial<LedgerStamp> | undefined;
  return s && typeof s.seq === 'number' && typeof s.at === 'number'
    ? { seq: s.seq, at: s.at }
    : null;
}

function unstamped<E extends object>(value: object): E {
  if (!(STAMP in value)) return value as E;
  const { [STAMP]: _stamp, ...entry } = value as Record<string, unknown>;
  return entry as E;
}

const isEntry = (value: unknown): value is object => !!value && typeof value === 'object';

/** The room's seq and the time of one op it recorded. */
type LedgerMark = { seq: number; at: number };

const isMark = (m: unknown): m is LedgerMark =>
  isEntry(m) &&
  typeof (m as LedgerMark).seq === 'number' &&
  typeof (m as LedgerMark).at === 'number';

// The tab an entry key belongs to (`ledger:<tab>:...`), or null for a key the index can't place.
function tabOfKey(key: string): string | null {
  const end = key.indexOf(':', LEDGER_KEY_PREFIX.length);
  return key.startsWith(LEDGER_KEY_PREFIX) && end > LEDGER_KEY_PREFIX.length
    ? key.slice(LEDGER_KEY_PREFIX.length, end)
    : null;
}

const indexPrefix = (tabId: string) => `${LEDGER_INDEX_PREFIX}${tabId}:`;
const padSeq = (seq: number) => String(seq).padStart(SEQ_DIGITS, '0');
const indexKey = (tabId: string, seq: number, key: string) =>
  `${indexPrefix(tabId)}${padSeq(seq)}:${key}`;

// The marks kept after noting `mark`: every one from its last day, and the newest before that (where a read starts).
function marksAfter(marks: readonly LedgerMark[], mark: LedgerMark): LedgerMark[] {
  let from = 0;
  marks.forEach((m, i) => {
    if (m.at <= mark.at - LEDGER_RECENT_MS) from = i;
  });
  return [...marks.slice(from), mark];
}

export class RoomLedgerStore<E extends object, L> {
  // Writes are chained, so entries apply in the order the room sequenced the ops, and a read waits for every op
  // sequenced before it. The upkeep runs on the same chain.
  private queue: Promise<void> = Promise.resolve();
  // The stored floor, read once per instance (a woken room reads it again).
  private floor: number | null = null;
  // Whether every entry has its index row, and the room's seq marks: each read once per instance.
  private indexed: boolean | null = null;
  private marks: LedgerMark[] | null = null;

  private readonly storage: LedgerStorage;
  private readonly rules: LedgerRules<E, L>;
  private readonly clock: () => number;

  constructor(
    storage: LedgerStorage,
    rules: LedgerRules<E, L>,
    clock: () => number = () => Date.now(),
  ) {
    this.storage = storage;
    this.rules = rules;
    this.clock = clock;
  }

  // A malformed or untracked op, or an entry grown past the value limit, is skipped: the merge then falls back to
  // what the save carries.
  record(op: unknown, seq: number): void {
    const key = this.rules.ledgerKey(op);
    if (!key) return;
    // When the room took the op, not when the chain reaches it.
    const at = this.clock();
    this.queue = this.queue
      .then(async () => {
        const stored = await this.storage.get<unknown>(key);
        const prev = isEntry(stored) ? unstamped<E>(stored) : undefined;
        const next = this.rules.recordInLedger(prev, op, seq);
        if (!next || JSON.stringify(next).length > LEDGER_VALUE_MAX_CHARS) return;
        const marks = await this.storedMarks();
        // Issued together with no wait between, so the runtime lands the entry and its index row as one write.
        const writes: Promise<unknown>[] = [
          this.storage.put(key, { ...next, [STAMP]: { seq, at } }),
        ];
        const tab = tabOfKey(key);
        if (tab !== null) {
          const was = isEntry(stored) ? stampOf(stored) : null;
          if (was) writes.push(this.storage.delete(indexKey(tab, was.seq, key)));
          writes.push(this.storage.put(indexKey(tab, seq, key), at));
        }
        const last = marks[marks.length - 1];
        if (!last || at - last.at >= LEDGER_MARK_EVERY_MS) {
          this.marks = marksAfter(marks, { seq, at });
          writes.push(this.storage.put(LEDGER_MARKS_KEY, this.marks));
        }
        await Promise.all(writes);
      })
      .catch(() => {});
  }

  // Resolves once every write already queued has landed, so a purge cannot be followed by a late put.
  settled(): Promise<void> {
    return this.queue;
  }

  // A tab's ledger. With `since` (the saver's cursor), only the entries that can change its merge: one changed
  // after the cursor, or in the last day (an idea card or a comment's author a stale snapshot may lack, whatever
  // its cursor says). Every part of an older entry has a seq at or below the cursor, which the merge skips.
  async read(tabId: string, since?: number): Promise<L> {
    await this.queue;
    if (since !== undefined) await this.noteStaleCursor(tabId, since);
    const recent = this.clock() - LEDGER_RECENT_MS;
    const from = since === undefined ? null : await this.indexedFrom(tabId, since, recent);
    const listed =
      from === null
        ? await this.storage.list({ prefix: this.rules.ledgerPrefix(tabId) })
        : await this.indexedEntries(tabId, from, since!, recent);
    const entries: [string, unknown][] = [];
    for (const [key, value] of listed) {
      if (!isEntry(value)) continue;
      const stamp = stampOf(value);
      if (since !== undefined && stamp && stamp.seq <= since && stamp.at <= recent) continue;
      entries.push([key, unstamped<E>(value)]);
    }
    return this.rules.tabLedgerFrom(tabId, entries);
  }

  // The seq a save's index walk starts after: its cursor, or the room's seq before the last day began when that is
  // lower. Null when the index can't answer: a tab id it can't place, entries not yet indexed, or no mark from before
  // the last day (the save then lists the tab).
  private async indexedFrom(tabId: string, since: number, recent: number): Promise<number | null> {
    if (tabId.includes(':') || this.rules.ledgerPrefix(tabId) !== `${LEDGER_KEY_PREFIX}${tabId}:`)
      return null;
    if (!(await this.storedIndexed())) return null;
    let mark: LedgerMark | undefined;
    for (const m of await this.storedMarks()) if (m.at <= recent) mark = m;
    return mark ? Math.min(since, mark.seq) : null;
  }

  // The entries whose index row is past `from` and that a save at `since` can use, fetched in batches.
  private async indexedEntries(
    tabId: string,
    from: number,
    since: number,
    recent: number,
  ): Promise<Map<string, unknown>> {
    const prefix = indexPrefix(tabId);
    // ';' sorts just after ':', so the walk starts past every row of `from` itself.
    const rows = await this.storage.list({ prefix, startAfter: `${prefix}${padSeq(from)};` });
    const keys = new Set<string>();
    for (const [row, at] of rows) {
      const seq = Number(row.slice(prefix.length, prefix.length + SEQ_DIGITS));
      // A store that ignores the cursor hands every row back: the walk's own bounds still hold.
      if (!(seq > from) || (seq <= since && typeof at === 'number' && at <= recent)) continue;
      keys.add(row.slice(prefix.length + SEQ_DIGITS + 1));
    }
    const wanted = [...keys];
    const entries = new Map<string, unknown>();
    for (let i = 0; i < wanted.length; i += LEDGER_GET_BATCH) {
      const got = await this.storage.get<unknown>(wanted.slice(i, i + LEDGER_GET_BATCH));
      for (const [key, value] of got) entries.set(key, value);
    }
    return entries;
  }

  // The daily upkeep: an entry from before stamps is stamped now, and one untouched for LEDGER_RETENTION_MS goes,
  // unless it accumulates and its tab is still stored.
  upkeep(input: LedgerUpkeep): Promise<LedgerUpkeepResult> {
    const run = this.queue.then(() => this.cut(input));
    this.queue = run.then(
      () => {},
      () => {},
    );
    return run;
  }

  private async cut({ now, seq, tabs }: LedgerUpkeep): Promise<LedgerUpkeepResult> {
    const prefixes =
      tabs && tabs.size > 0 ? [...tabs].map((t) => this.rules.ledgerPrefix(t)) : null;
    const tabLives = (key: string) => !prefixes || prefixes.some((p) => key.startsWith(p));
    const cutoff = now - LEDGER_RETENTION_MS;
    const result: LedgerUpkeepResult = { dropped: 0, stamped: 0 };
    // A pass before the room's first complete one also indexes every entry it keeps.
    const indexed = await this.storedIndexed();
    let floor = 0;
    let after: string | undefined;
    for (;;) {
      const page = await this.storage.list({
        prefix: LEDGER_KEY_PREFIX,
        limit: LEDGER_UPKEEP_PAGE,
        ...(after !== undefined ? { startAfter: after } : {}),
      });
      const writes: Promise<unknown>[] = [];
      const from = after;
      let fresh = 0;
      for (const [key, value] of page) {
        // A store that ignores the cursor hands the same keys back, maybe unsorted: skip the ones an earlier page
        // went past, so the loop still ends.
        if (from !== undefined && key <= from) continue;
        fresh++;
        if (after === undefined || key > after) after = key;
        if (!isEntry(value)) continue;
        const stamp = stampOf(value);
        const tab = tabOfKey(key);
        if (!stamp) {
          writes.push(this.storage.put(key, { ...value, [STAMP]: { seq, at: now } }));
          if (tab !== null) writes.push(this.storage.put(indexKey(tab, seq, key), now));
          result.stamped++;
          continue;
        }
        const keep =
          stamp.at > cutoff ||
          (tabLives(key) && this.rules.ledgerEntryAccumulates?.(key, unstamped<E>(value)));
        if (keep) {
          if (!indexed && tab !== null)
            writes.push(this.storage.put(indexKey(tab, stamp.seq, key), stamp.at));
          continue;
        }
        writes.push(this.storage.delete(key));
        if (tab !== null) writes.push(this.storage.delete(indexKey(tab, stamp.seq, key)));
        result.dropped++;
        floor = Math.max(floor, stamp.seq);
      }
      await Promise.all(writes);
      if (fresh === 0 || page.size < LEDGER_UPKEEP_PAGE) break;
    }
    if (floor > (await this.storedFloor())) {
      this.floor = floor;
      await this.storage.put(LEDGER_FLOOR_KEY, floor);
    }
    if (!indexed) {
      await this.storage.put(LEDGER_INDEXED_KEY, true);
      this.indexed = true;
    }
    return result;
  }

  private async storedIndexed(): Promise<boolean> {
    this.indexed ??= (await this.storage.get<unknown>(LEDGER_INDEXED_KEY)) === true;
    return this.indexed;
  }

  private async storedMarks(): Promise<readonly LedgerMark[]> {
    if (this.marks === null) {
      const stored = await this.storage.get<unknown>(LEDGER_MARKS_KEY);
      this.marks = Array.isArray(stored) ? stored.filter(isMark) : [];
    }
    return this.marks;
  }

  private async storedFloor(): Promise<number> {
    if (this.floor === null) {
      const stored = await this.storage.get<unknown>(LEDGER_FLOOR_KEY);
      this.floor = typeof stored === 'number' ? stored : 0;
    }
    return this.floor;
  }

  // A cursor below the floor may have missed an entry the upkeep cut: said, so it can be seen if it ever happens.
  private async noteStaleCursor(tabId: string, since: number): Promise<void> {
    const floor = await this.storedFloor();
    if (since < floor) console.warn('[ledger] stale cursor', { tabId, since, floor });
  }
}
