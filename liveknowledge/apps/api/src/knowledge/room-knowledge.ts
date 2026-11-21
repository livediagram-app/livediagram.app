// The room's side of a knowledgebase's knowledge (blueprint "Wiring"): the database hooks that keep the index in
// step (knowledge-index.ts), the alarm's turns (the backfill of queued pages, the work it owes), and the daily
// prune. One per room; the room's alarm asks `at` when it is next due and calls `turn`.
import type { ItemDbHooks, ItemSql } from '@liveworkspace/index-app';
import {
  READS_KEPT_DAYS,
  pruneCounters,
  prunePageAnswers,
  pruneQuestions,
  pruneReads,
} from '@liveknowledge/knowledge';
import { pruneAgentSeen } from './agent-seen';
import { pruneEmailMarks } from './email-marks';
import { pruneSuggestions } from './suggestions';
import {
  hasQueuedPages,
  settleQueued,
  withKnowledgeIndex,
  type IndexedPage,
} from './knowledge-index';

/** The pause between two batches of the backfill: the room's alarm never fires sooner than a second on. */
export const BACKFILL_GAP_MS = 1_000;

export type KnowledgeStorage = {
  sql: ItemSql;
  transactionSync: <T>(fn: () => T) => T;
};

export type KnowledgeWork = (now: number) => Promise<number | null>;

export class RoomKnowledge {
  /** When the alarm should next give this a turn; null for nothing owed. */
  at: number | null = null;
  // What else the alarm does on a turn (conflict checks, emails: knowledge-work.ts), answering when it is next due.
  work: KnowledgeWork | null = null;
  private readonly storage: KnowledgeStorage;
  private readonly arm: () => void;
  /** Told the pages whose writing a write indexed anew. */
  onIndexed: ((pages: readonly IndexedPage[]) => void) | null = null;
  /** Told that a page's verification changed. */
  onTrust: (() => void) | null = null;

  constructor(storage: KnowledgeStorage, arm: () => void) {
    this.storage = storage;
    this.arm = arm;
  }

  /** The room's database hooks with the index kept in step. */
  hooks(base: ItemDbHooks): ItemDbHooks {
    return withKnowledgeIndex(this.storage.sql, base, {
      onQueued: () => this.wake(Date.now() + BACKFILL_GAP_MS),
      onIndexed: (pages) => this.onIndexed?.(pages),
      onTrust: () => this.onTrust?.(),
    });
  }

  /** Ask for a turn at `at`, or sooner if one is already due sooner. */
  wake(at: number): void {
    if (this.at !== null && this.at <= at) return;
    this.at = at;
    this.arm();
  }

  /** After the room wakes with a schema: pick up what a turn still owes. */
  restore(now: number, workDueAt: number | null): void {
    const due = hasQueuedPages(this.storage.sql) ? now + BACKFILL_GAP_MS : null;
    const next = [due, workDueAt].filter((at): at is number => at !== null);
    this.at = next.length > 0 ? Math.min(...next) : null;
  }

  /** The alarm's turn: one batch of the backfill, then the work that is due. */
  async turn(now: number): Promise<void> {
    this.at = null;
    let next: number | null = null;
    try {
      const settled = this.storage.transactionSync(() => settleQueued(this.storage.sql));
      if (settled.pages > 0)
        console.info('[knowledge] backfill', { pages: settled.pages, queued: settled.queued });
      if (settled.queued > 0) next = now + BACKFILL_GAP_MS;
      if (settled.indexed.length > 0) this.onIndexed?.(settled.indexed);
      if (settled.trust > 0) this.onTrust?.();
    } catch (error) {
      console.warn('[knowledge] backfill failed', { error: String(error) });
    }
    const workAt = this.work ? await this.work(now) : null;
    if (workAt !== null) next = next === null ? workAt : Math.min(next, workAt);
    // A wake asked for while the turn ran stands.
    const asked: number | null = this.at;
    this.at = asked !== null && (next === null || asked < next) ? asked : next;
  }
}

/** The daily prune (the room's upkeep): reads past 90 days, counters past their window, questions past the cap,
 *  suggestions nobody decided about in 90 days or whose page is gone, connections not seen in 90 days, the
 *  questions answered from each page past 30 days or past their cap. */
export function pruneKnowledge(sql: ItemSql, now: number): void {
  for (const statement of [
    pruneReads(now),
    pruneCounters(now),
    ...pruneQuestions(),
    ...prunePageAnswers(now),
    ...pruneSuggestions(now),
    pruneAgentSeen(now, READS_KEPT_DAYS),
    ...pruneEmailMarks(),
  ])
    sql.exec(statement.sql, ...statement.params);
}
