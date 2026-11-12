// A shared tab's standalone parts (tab-shares.ts, which re-exports them): a tab's leave before its delete, and when
// the room next sends its shared tabs' holders what they are owed.

import { FLUSH_IDLE_MS, FLUSH_RETRY_MS, outboxDueAt, type SqlExec } from './outbox';
import type { ShareDb, ShareDrain } from './tab-share-types';

// Before a tab's delete from an item, in the same batch: every other holder hears that this item left, and nothing
// else it owed them about the tab is sent. Before the tab row's delete, which takes its `tab_shares`. Standalone, so
// the app's tab delete needs no more of the kit than its database.
export function shareLeaveStatements(db: ShareDb, tabId: string): D1PreparedStatement[] {
  return [
    db
      .prepare("DELETE FROM share_outbox WHERE tab_id = ? AND kind IN ('body', 'join')")
      .bind(tabId),
    db
      .prepare(
        `INSERT OR REPLACE INTO share_outbox (kind, tab_id, to_item)
         SELECT 'leave', tab_id, item_id FROM tab_shares WHERE tab_id = ?`,
      )
      .bind(tabId),
  ];
}

// When the item's SQLite next owes another holder something (ms; 0 for a key never tried), or null when it owes
// nothing but parked keys. The room arms its share send from this.
export function sharesDueAt(sql: SqlExec): number | null {
  return outboxDueAt(sql, 'share_outbox');
}

// When the room next sends its shared tabs' holders what they are owed: on idle after a write (FLUSH_IDLE_MS), not
// held to the index outbox's once a minute, since it is a call to another item rather than a push; after a failure,
// when the earliest key's wait is over (`drain`). The room reads `at` into its one alarm, and runs `send` from the
// alarm when `due`. `dueAt` is sharesDueAt over the room's SQLite (null before its schema).
export class ShareSchedule {
  at: number | null = null;
  private readonly dueAt: () => number | null;
  private readonly now: () => number;

  constructor(dueAt: () => number | null, now: () => number = Date.now) {
    this.dueAt = dueAt;
    this.now = now;
  }

  // After a wake: anything owed goes now, or when its wait is over.
  restore(): void {
    const due = this.dueAt();
    if (due !== null) this.at = Math.max(this.now(), due);
  }

  // A write happened: true when it armed a send (the room then re-arms its alarm). A send set on idle stays without
  // a read; one set far off, for a key in backoff, gives way to the key just written.
  noteWrite(): boolean {
    const now = this.now();
    if (this.at !== null && this.at <= now + FLUSH_IDLE_MS) return false;
    const due = this.dueAt();
    if (due === null) return false;
    const at = Math.max(now + FLUSH_IDLE_MS, due);
    if (this.at !== null && this.at <= at) return false;
    this.at = at;
    return true;
  }

  due(now: number): boolean {
    return this.at !== null && this.at <= now;
  }

  clear(): void {
    this.at = null;
  }

  // One drain; more to send goes on idle, a key that failed when its wait is over, and a drain that threw tries
  // again in a minute.
  async send(drain: () => Promise<ShareDrain>): Promise<ShareDrain | null> {
    this.at = null;
    let result: ShareDrain | null = null;
    try {
      result = await drain();
      if (result.more) this.at = this.now() + FLUSH_IDLE_MS;
    } catch (error) {
      console.warn('[tab-shares] send failed', { error: String(error) });
      this.at = this.now() + FLUSH_RETRY_MS;
    }
    // What failed goes when its wait is over; anything written while the send was in flight goes on idle.
    if (this.at === null) {
      const due = this.dueAt();
      if (due !== null) this.at = Math.max(this.now() + FLUSH_IDLE_MS, due);
    }
    return result;
  }
}
