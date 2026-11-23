// An item's Automations as its room holds them (liveworkspace/docs/specs/018-automations/automations.md "Where rules
// live and run"; blueprint item-engine.md "The holder"): stage 1's holder over the app's kinds, with what the item
// engine adds. The rules that settle and the kinds a rule hears straight are kept in memory, rebuilt on every rule
// write, so a write that no rule hears costs one Set lookup. `automation_hears` and `automation_quiet` mirror them
// for the SQL triggers. The wake also reads what those triggers wrote with no JavaScript run: a settle's due time
// and a queued tab event.
import type { ItemTier } from '@liveworkspace/subscription';
import { LEGACY_AUTOMATION_LIMITS, type AutomationLimits } from '../automation-store';
import { automationLimitsOf } from '../tier';
import { nextMoment, type AutomationTimed } from '../../schedule';
import {
  ITEM_EDIT_EVENT,
  type ItemEvent,
  type ItemKinds,
  type ItemRule,
  type ItemSettle,
  type TriggerKind,
} from '../../item';
import { AutomationSchedule, ItemAutomations, type AutomationsHook } from '../automation-queue';
import type { AutomationStoreKit } from '../automation-store';
import type { Sql } from '../sql';
import type { ItemDeps, ItemRoomKit } from './kit';

// The kinds the SQL triggers feed (schema.ts): no call site queues them.
export const ITEM_SQL_KINDS = ['tab_added', 'tab_removed', ITEM_EDIT_EVENT] as const;

// A rule that is on whose trigger settles.
export interface ItemSettler {
  rule: ItemRule;
  def: TriggerKind;
  settle: ItemSettle;
}

// What an app's call sites ask of the engine (intake.ts queueItemEvent).
export interface ItemHook extends AutomationsHook {
  readonly settlers: readonly ItemSettler[];
  // The kinds some rule hears straight (not only as a settle's start).
  readonly direct: ReadonlySet<string>;
  // A settle was started or called off: the alarm asks again.
  settled(): void;
}

/** What the store asks of a rule, from its trigger's definition. */
export function itemStoreKit(kinds: ItemKinds): AutomationStoreKit<ItemRule, string> {
  return {
    hears: (rule) => {
      const def = kinds.trigger(rule.trigger.kind);
      if (!def) return [];
      return [...def.hears, ...(def.settle?.after ?? []), ...(def.settle?.cancel ?? [])];
    },
    nextAt: (rule, now) =>
      kinds.trigger(rule.trigger.kind)?.time
        ? nextMoment(rule.trigger as unknown as AutomationTimed, rule.timeZone, now)
        : null,
  };
}

/** The queue's wake, the time triggers' and the settles'. */
export class ItemSchedule extends AutomationSchedule<ItemEvent> {
  settleAt: number | null = null;

  private readonly itemSql: () => Sql;
  private readonly awake: () => boolean;
  // Whether a rule hears a kind the SQL triggers feed: only then are the tables asked on a read.
  private readonly fed: () => boolean;

  constructor(sql: () => Sql, awake: () => boolean, fed: () => boolean) {
    super(sql, awake);
    this.itemSql = sql;
    this.awake = awake;
    this.fed = fed;
  }

  // What the SQL triggers wrote: the earliest settle, and whether a trigger waits. One statement, two indexed
  // reads.
  poll(now = Date.now()): void {
    if (!this.awake()) {
      this.settleAt = null;
      return;
    }
    const row = this.itemSql()
      .exec(
        `SELECT (SELECT MIN(due_at) FROM automation_settles) AS settle,
                EXISTS (SELECT 1 FROM automation_queue) AS queued`,
      )
      .toArray()[0]!;
    this.settleAt =
      typeof row['settle'] === 'number' ? Math.max(row['settle'], this.retryAt) : null;
    if (row['queued'] && this.at === null) this.at = now;
  }

  override restoreTimes(): void {
    super.restoreTimes();
    this.poll();
  }

  override get wakeAt(): number | null {
    if (this.fed()) this.poll();
    const at = super.wakeAt;
    if (this.settleAt === null) return at;
    return at === null ? this.settleAt : Math.min(at, this.settleAt);
  }

  settleDue(now: number): boolean {
    return this.settleAt !== null && this.settleAt <= now;
  }

  override due(now: number): boolean {
    const at = this.wakeAt;
    return at !== null && at <= now;
  }

  override clear(): void {
    super.clear();
    this.settleAt = null;
  }
}

export interface ItemEngineInput {
  sql: () => Sql;
  // Whether the item's schema exists.
  ready: () => boolean;
  // Arms the room's alarm for the schedule's wake.
  arm: () => void;
  kinds: ItemKinds;
  // The room's kit; null while the room holds no item.
  kit: () => ItemRoomKit | null;
  // Whether the item is archived or in the Trash.
  putAway: () => boolean;
  // The item's tier (the room's ItemTier); absent, or with Pro off, every limit is the legacy one.
  tier?: () => ItemTier | null;
}

// The item's limits as its tier holds them now: the legacy ones without a tier.
const tierLimits = (tier: ItemTier | null | undefined): AutomationLimits =>
  tier ? automationLimitsOf(tier) : LEGACY_AUTOMATION_LIMITS;

export class ItemEngine
  extends ItemAutomations<ItemRule, string, ItemEvent, ItemDeps>
  implements ItemHook
{
  readonly defs: ItemKinds;
  settlers: ItemSettler[] = [];
  readonly direct = new Set<string>();
  // Whether a rule that is on hears a kind the SQL triggers feed.
  private fed = false;
  private readonly live: () => boolean;
  private readonly armRoom: () => void;
  declare readonly schedule: ItemSchedule;

  constructor(input: ItemEngineInput) {
    // Read only once the holder stands (a run, a wake), never inside `super`.
    const self: { engine?: ItemEngine } = {};
    const wake = () => {
      self.engine!.schedule.restoreTimes();
      input.arm();
    };
    super({
      sql: input.sql,
      ready: input.ready,
      arm: input.arm,
      putAway: input.putAway,
      kit: itemStoreKit(input.kinds),
      ...(input.tier ? { limits: () => tierLimits(input.tier?.()) } : {}),
      deps: () => {
        const kit = input.ready() ? input.kit() : null;
        const tier = input.tier?.() ?? null;
        return kit
          ? {
              kit,
              sql: input.sql,
              store: self.engine!.store,
              wake,
              fed: () => self.engine!.fed,
              tier: tier?.on ? tier : null,
            }
          : null;
      },
      schedule: (sql, awake) => new ItemSchedule(sql, awake, () => self.engine!.fed),
    });
    self.engine = this;
    this.defs = input.kinds;
    this.live = input.ready;
    this.armRoom = input.arm;
    // Every rule write: the settlers and the triggers' tables follow, then the alarm asks again.
    const rearm = this.store.onSchedule;
    this.store.onSchedule = () => {
      this.sync();
      rearm();
    };
  }

  // The settlers and the straight kinds, from the rules that are on (none when put away).
  private rebuild(): void {
    this.settlers = [];
    this.direct.clear();
    const hears = this.kinds;
    const rules = this.live() && hears.size > 0 ? this.store.enabled() : [];
    for (const rule of rules) {
      const def = this.defs.trigger(rule.trigger.kind);
      if (!def) continue;
      for (const kind of def.hears) this.direct.add(kind);
      if (def.settle) this.settlers.push({ rule, def, settle: def.settle });
    }
    this.fed = ITEM_SQL_KINDS.some((kind) => hears.has(kind));
  }

  /** The settlers, and the SQL triggers' tables, from the rules as they now stand. After every rule write (the
   *  store calls it), and when the item is put away or brought back (the app does). */
  sync(): void {
    this.rebuild();
    if (!this.live()) return;
    const sql = this.sql();
    const hears = this.kinds;
    sql.exec('DELETE FROM automation_hears');
    sql.exec(
      'INSERT INTO automation_hears (kind) SELECT value FROM json_each(?)',
      JSON.stringify(ITEM_SQL_KINDS.filter((kind) => hears.has(kind))),
    );
    const quiet = this.settlers
      .filter((s) => s.settle.after.includes(ITEM_EDIT_EVENT))
      .map((s) => ({
        rule: s.rule.id,
        ms: s.settle.quietMs(s.rule.trigger),
        // A settling rule kept to one tab names it by `tab`, as every kind does (refs.ts).
        tab: typeof s.rule.trigger['tab'] === 'string' ? s.rule.trigger['tab'] : '',
      }));
    sql.exec('DELETE FROM automation_quiet');
    sql.exec(
      `INSERT INTO automation_quiet (rule_id, quiet_ms, tab)
       SELECT value ->> '$.rule', value ->> '$.ms', value ->> '$.tab' FROM json_each(?)`,
      JSON.stringify(quiet),
    );
    // A quiet stretch under way belongs to a rule that still settles.
    sql.exec(
      'DELETE FROM automation_settles WHERE rule_id NOT IN (SELECT value FROM json_each(?))',
      JSON.stringify(this.settlers.map((s) => s.rule.id)),
    );
  }

  override restore(now: number): void {
    super.restore(now);
    this.rebuild();
  }

  settled(): void {
    this.schedule.poll();
    this.armRoom();
  }
}
