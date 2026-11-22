// Send to Plan's chips kept live (liveworkspace/docs/specs/004-index/send-to-plan.md "The chip"; items.md "Sent
// From"): a card that came from another app carries its Sent From, so when an items op upserts or removes one, the
// room gathers it for PLAN_CARDS_SETTLE_MS and tells the index once with each card's title, column, done state and
// whether it is gone; the index tells the source's app, whose open editors read their chips again. A card without a
// Sent From costs one field read and nothing else. Never polled.
import { isTrashed, SENT_FROM_FIELD, type Item } from '@liveplanner/items';
import {
  PLAN_CARDS_CHANGED_MAX,
  PLAN_CARDS_SETTLE_MS,
  type IndexAppClient,
  type PlanCardChange,
} from '@liveworkspace/index-client';
import { isItemsOp } from './items-op-split';

type Sql = { exec: (query: string, ...bindings: unknown[]) => { toArray(): unknown[] } };

/** The board's word for a card: its column's name, and whether that column is a done one. */
export type CardPlaces = {
  columnOf: (status: string | undefined) => string;
  isDone: (status: string | undefined) => boolean;
};

type Signal = Pick<IndexAppClient, 'planCardsChanged'>;

const SCHEMA = 'CREATE TABLE IF NOT EXISTS sent_cards (card_id TEXT PRIMARY KEY)';

const statusOf = (item: Item) =>
  typeof item.fields['status'] === 'string' ? item.fields['status'] : undefined;

export class SentCards {
  // A card's newest state, or null for one removed.
  private readonly pending = new Map<string, Item | null>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  // The room's SQL, read when used: a storage with none (a test's) keeps no sent cards.
  private readonly sql: () => Sql | undefined;
  private readonly planId: () => string | null;
  private readonly places: () => Promise<CardPlaces | null>;
  private readonly signal: () => Signal | null;
  private readonly settleMs: number;

  constructor(
    sql: () => Sql | undefined,
    planId: () => string | null,
    places: () => Promise<CardPlaces | null>,
    signal: () => Signal | null,
    settleMs = PLAN_CARDS_SETTLE_MS,
  ) {
    this.sql = sql;
    this.planId = planId;
    this.places = places;
    this.signal = signal;
    this.settleMs = settleMs;
  }

  // Made on every use (cheap), so a purge's deleteAll never leaves a stale "made" mark behind.
  private table(sql: Sql): Sql {
    sql.exec(SCHEMA);
    return sql;
  }

  // An op the room relayed: the sent cards it touches are gathered.
  changed(op: unknown): void {
    const sql = this.sql();
    if (!sql || !isItemsOp(op)) return;
    let any = false;
    const upserts = op.upserts;
    for (const item of upserts) {
      if (typeof item?.fields?.[SENT_FROM_FIELD] !== 'string') continue;
      if (!any) this.table(sql);
      any = true;
      sql.exec('INSERT OR IGNORE INTO sent_cards (card_id) VALUES (?)', item.id);
      this.pending.set(item.id, item);
    }
    const removed = (op.removed as unknown[]).filter((id): id is string => typeof id === 'string');
    if (removed.length > 0) {
      const known = this.table(sql)
        .exec(
          'SELECT card_id FROM sent_cards WHERE card_id IN (SELECT value FROM json_each(?))',
          JSON.stringify(removed),
        )
        .toArray() as { card_id: string }[];
      for (const { card_id } of known) {
        this.pending.set(card_id, null);
        any = true;
      }
    }
    if (any) this.timer ??= setTimeout(() => void this.flush(), this.settleMs);
  }

  // Tell the index about the gathered cards, once; a removed one is forgotten here too.
  async flush(): Promise<void> {
    this.timer = null;
    const entries = [...this.pending].slice(0, PLAN_CARDS_CHANGED_MAX);
    this.pending.clear();
    const planId = this.planId();
    const client = this.signal();
    if (entries.length === 0 || !planId || !client) return;
    try {
      const places = await this.places();
      if (!places) return;
      const cards: PlanCardChange[] = entries.map(([id, item]) => {
        if (!item) return { id, title: '', column: '', done: false, gone: true };
        const status = statusOf(item);
        const title = typeof item.fields['title'] === 'string' ? item.fields['title'] : '';
        return {
          id,
          title: title.slice(0, 200),
          column: places.columnOf(status).slice(0, 120),
          done: places.isDone(status),
          gone: isTrashed(item),
        };
      });
      const gone = cards.filter((c) => c.gone && !entries.find(([id, i]) => id === c.id && i));
      const sql = this.sql();
      if (gone.length > 0 && sql) {
        this.table(sql).exec(
          'DELETE FROM sent_cards WHERE card_id IN (SELECT value FROM json_each(?))',
          JSON.stringify(gone.map((c) => c.id)),
        );
      }
      await client.planCardsChanged(planId, cards);
    } catch (err) {
      console.warn('[plan] sent cards not told', { error: String(err) });
    }
  }
}
