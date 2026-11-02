// Repeating cards, run from the plan's own alarm (docs/specs/026-plan/items.md "Repeating cards", blueprint
// item-store.md "Repeats"). The rule is the card's `repeat` field (@liveplanner/items repeat.ts); its schedule is
// `item_repeats` (card-repeats-schema.ts), which triggers keep. This module asks for a wake when a rule changed or a
// copy is due, and on that wake settles changed rules and makes the copies due, one per card per day, bounded per
// wake. A plan without a repeating card has no rows, asks for no wake and does none of this.
import {
  ITEMS_MAX,
  ITEM_WRITE_RETRIES,
  REPEAT_PERSON,
  isTrashed,
  itemPlacer,
  itemRepeat,
  itemStatus,
  makeItem,
  planOutline,
  repeatCopyFields,
  repeatCopyId,
  repeatCopyStatus,
  repeatSchedule,
  settledFloor,
  typeIn,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { getItemStoreHead, insertItems, listItems, readItem } from '../db';
import { appendItemHistory } from '../db/item-history';
import { planTabs } from '../routes/plan-route';
import type { PlanEnv } from '../types';
import { readPlanOutline } from './plan-content';

// Rows of each kind (changed rules, copies due) one wake handles; the rest wait REPEAT_MORE_MS for the next.
export const REPEAT_COPIES_PER_WAKE = 25;
export const REPEAT_MORE_MS = 1000;

type Sql = Pick<SqlStorage, 'exec'>;
type Row = { item_id: string; last_made: string | null };

// What the copies of one wake read once: the store (for keys and ranks), and the plan's types and column names.
type WakeReads = {
  ids: Set<string>;
  keys: Set<number>;
  placer: ReturnType<typeof itemPlacer>;
  types: readonly ItemTypeDef[];
  statusNames: [string, string][];
};

export type RepeatRun = { made: number; settled: number };

export class RepeatSchedule {
  // The wake this schedule asks for, or null.
  at: number | null = null;

  private readonly sql: () => Sql;
  // Whether the plan's schema exists (a plan never started holds no table to ask).
  private readonly ready: () => boolean;

  constructor(sql: () => Sql, ready: () => boolean) {
    this.sql = sql;
    this.ready = ready;
  }

  private hasDirty(): boolean {
    return (
      this.sql().exec('SELECT 1 FROM item_repeats WHERE dirty = 1 LIMIT 1').toArray().length > 0
    );
  }

  // The next wake from what is stored: now when a rule changed, else the earliest copy due.
  private earliest(now: number): number | null {
    if (this.hasDirty()) return now;
    const row = this.sql()
      .exec('SELECT MIN(next_at) AS at FROM item_repeats WHERE dirty = 0 AND next_at IS NOT NULL')
      .toArray()[0];
    return typeof row?.['at'] === 'number' ? row['at'] : null;
  }

  // After a wake: what the stored schedule asks for.
  restore(now: number): void {
    this.at = this.ready() ? this.earliest(now) : null;
  }

  // After a content write: a rule set, changed, stopped, trashed or restored asks for a wake now. Whether the alarm
  // needs arming.
  noteWrite(now: number): boolean {
    if (!this.ready() || !this.hasDirty()) return false;
    if (this.at !== null && this.at <= now) return false;
    this.at = now;
    return true;
  }

  due(now: number): boolean {
    return this.at !== null && this.at <= now;
  }

  clear(): void {
    this.at = null;
  }

  private rows(query: string, ...bindings: unknown[]): Row[] {
    return this.sql()
      .exec(query, ...bindings)
      .toArray()
      .map((r) => ({
        item_id: typeof r['item_id'] === 'string' ? r['item_id'] : '',
        last_made: typeof r['last_made'] === 'string' ? r['last_made'] : null,
      }));
  }

  private settle(id: string, lastMade: string | null, nextAt: number | null): void {
    this.sql().exec(
      'UPDATE item_repeats SET last_made = ?, next_at = ?, dirty = 0 WHERE item_id = ?',
      lastMade,
      nextAt,
      id,
    );
  }

  private drop(id: string): void {
    this.sql().exec('DELETE FROM item_repeats WHERE item_id = ?', id);
  }

  // A row whose card is gone, no longer repeats or sits in the Trash: none goes, a trashed one waits (next_at NULL)
  // until a change dirties it again. Answers whether it was one of those.
  private retire(row: Row, card: Item | null): boolean {
    if (!card || !itemRepeat(card)) {
      this.drop(row.item_id);
      return true;
    }
    if (isTrashed(card)) {
      this.settle(row.item_id, row.last_made, null);
      return true;
    }
    return false;
  }

  // One wake: changed rules settled, then the copies due made. `relay` hands each copy to the room.
  async run(
    env: PlanEnv,
    planId: string,
    now: number,
    relay: (items: Item[], rev: number) => void,
  ): Promise<RepeatRun> {
    const out: RepeatRun = { made: 0, settled: 0 };
    const changed = this.rows(
      'SELECT item_id, last_made FROM item_repeats WHERE dirty = 1 LIMIT ?',
      REPEAT_COPIES_PER_WAKE + 1,
    );
    for (const row of changed.slice(0, REPEAT_COPIES_PER_WAKE)) {
      try {
        const card = await readItem(env, planId, row.item_id);
        if (this.retire(row, card)) continue;
        const rule = itemRepeat(card!)!;
        const settled = settledFloor(rule, row.last_made, now);
        const { make, nextAt } = repeatSchedule(rule, settled, now);
        // Today's copy, when today is due and not yet made, comes in this same wake (below).
        this.settle(row.item_id, settled, make === null ? nextAt : now);
        out.settled += 1;
      } catch (error) {
        this.fail(planId, row, error);
      }
    }
    const due = this.rows(
      'SELECT item_id, last_made FROM item_repeats WHERE dirty = 0 AND next_at <= ? ORDER BY next_at LIMIT ?',
      now,
      REPEAT_COPIES_PER_WAKE + 1,
    );
    let reads: WakeReads | null = null;
    for (const row of due.slice(0, REPEAT_COPIES_PER_WAKE)) {
      try {
        reads ??= await this.read(env, planId);
        if (await this.copy(env, planId, now, row, reads, relay)) out.made += 1;
      } catch (error) {
        this.fail(planId, row, error);
      }
    }
    const more = changed.length > REPEAT_COPIES_PER_WAKE || due.length > REPEAT_COPIES_PER_WAKE;
    this.at = more ? now + REPEAT_MORE_MS : this.earliest(now);
    return out;
  }

  // A row that threw is parked (no wake asks for it again) rather than retried on every wake; a change to its card
  // dirties it again.
  private fail(planId: string, row: Row, error: unknown): void {
    console.warn('[repeats] failed', { planId, error: String(error) });
    this.settle(row.item_id, row.last_made, null);
  }

  private async read(env: PlanEnv, planId: string): Promise<WakeReads> {
    const [items, { itemTypes }] = await Promise.all([
      listItems(env, planId),
      readPlanOutline(env, planId),
    ]);
    const outline = planOutline(await planTabs({ env }, planId, null), itemTypes);
    return {
      ...storeReads(items),
      types: outline.types,
      statusNames: outline.statuses.map((s) => [s.status, s.name]),
    };
  }

  // The copy one due row asks for, if its day has come. Whether a copy was made.
  private async copy(
    env: PlanEnv,
    planId: string,
    now: number,
    row: Row,
    reads: WakeReads,
    relay: (items: Item[], rev: number) => void,
  ): Promise<boolean> {
    const card = await readItem(env, planId, row.item_id);
    if (this.retire(row, card)) return false;
    const source = card!;
    const rule = itemRepeat(source)!;
    const settled = row.last_made ?? settledFloor(rule, null, now);
    const { make, nextAt } = repeatSchedule(rule, settled, now);
    if (make === null) {
      this.settle(row.item_id, settled, nextAt);
      return false;
    }
    const id = repeatCopyId(source.id, make);
    const type = typeIn(reads.types, source.type);
    const status = repeatCopyStatus(rule, type, reads.statusNames, itemStatus(source));
    // The day settled in the copy's own transaction: a restart can never find the copy without it.
    const settle = env.PLAN_DB.prepare(
      'UPDATE item_repeats SET last_made = ?, next_at = ?, dirty = 0 WHERE item_id = ?',
    ).bind(make, nextAt, source.id);
    for (let attempt = 1; ; attempt += 1) {
      // The day's copy is already there (a copy imported back, or one an earlier attempt landed): no second copy.
      if (reads.ids.has(id)) {
        console.info('[repeats] settled', { planId });
        this.settle(row.item_id, make, nextAt);
        return false;
      }
      const head = await getItemStoreHead(env, planId);
      if (head.count >= ITEMS_MAX) {
        console.warn('[repeats] items_full', { planId });
        this.settle(row.item_id, make, nextAt);
        return false;
      }
      let key = head.nextKey;
      while (reads.keys.has(key)) key += 1;
      const made = makeItem(
        {
          type: source.type,
          fields: repeatCopyFields(source, rule, make, type),
          ...(status ? { place: { status } } : {}),
        },
        { id, key, now, by: REPEAT_PERSON, items: reads.placer },
      );
      try {
        const rev = await insertItems(env, planId, [made], [settle]);
        reads.ids.add(id);
        reads.keys.add(key);
        reads.placer.add(made);
        relay([made], rev);
        await appendItemHistory(env, planId, [{ before: null, after: made }], 'repeat');
        console.info('[repeats] made', { planId });
        return true;
      } catch (error) {
        // A key or the id taken since the store was read: read it again. Past the retries the row is parked.
        if (attempt >= ITEM_WRITE_RETRIES) throw error;
        Object.assign(reads, storeReads(await listItems(env, planId)));
      }
    }
  }
}

// The store as one wake's copies place against it.
function storeReads(items: readonly Item[]): Pick<WakeReads, 'ids' | 'keys' | 'placer'> {
  return {
    ids: new Set(items.map((i) => i.id)),
    keys: new Set(items.map((i) => i.key)),
    placer: itemPlacer(items),
  };
}
