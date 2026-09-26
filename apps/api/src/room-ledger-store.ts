import {
  ledgerKey,
  ledgerPrefix,
  recordInLedger,
  tabLedgerFrom,
  type ElementLedger,
  type TabLedger,
  type VoteLedger,
} from '@livediagram/diagram';

// The room's side of the collaboration ledger (docs/specs/012-collaboration/collab-race-hardening.md phase 3): each answer,
// idea, tick, comment and dot the room sequences is noted in DO storage, one
// key per element (plus the tab's vote), and read back whole when the api
// merges a save. What the entries hold, and how a save is merged with them,
// is the pure `collab-ledger` module; this only stores them.

// The storage value limit is 128 KiB; an entry that would pass it (a board of
// extremely long ideas) stops growing rather than failing the write.
const LEDGER_VALUE_MAX_CHARS = 120_000;

type LedgerStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  list(opts: { prefix: string }): Promise<Map<string, unknown>>;
};

export class RoomLedgerStore {
  // Writes are chained, so entries apply in the order the room sequenced the
  // ops, and a read waits for every op sequenced before it.
  private queue: Promise<void> = Promise.resolve();
  private readonly storage: LedgerStorage;

  constructor(storage: LedgerStorage) {
    this.storage = storage;
  }

  // A malformed or untracked op, or an entry grown past the value limit, is
  // skipped: the merge then falls back to what the save carries.
  record(op: unknown, seq: number): void {
    const key = ledgerKey(op);
    if (!key) return;
    this.queue = this.queue
      .then(async () => {
        const prev = await this.storage.get<ElementLedger | VoteLedger>(key);
        const next = recordInLedger(prev, op, seq);
        if (next && JSON.stringify(next).length <= LEDGER_VALUE_MAX_CHARS) {
          await this.storage.put(key, next);
        }
      })
      .catch(() => {});
  }

  async read(tabId: string): Promise<TabLedger> {
    await this.queue;
    return tabLedgerFrom(tabId, await this.storage.list({ prefix: ledgerPrefix(tabId) }));
  }
}
