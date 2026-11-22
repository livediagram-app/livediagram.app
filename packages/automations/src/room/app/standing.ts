// Where an item stands at the index (liveworkspace/docs/specs/018-automations/automations.md "Where rules live and
// run": an item in the Trash or archived runs nothing; liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "Where an item stands"; blueprint item-engine.md "An app's bindings"). The index pushes `{archived, trashed, at}` on
// every archive, move out, trash and restore; the room keeps the newest under one storage key and, while the item is
// put away, its rules hear nothing and no time rule, Wait or settle wakes it. An item that never heard keeps no key
// and runs as before (fails open). A grant signed after the stored moment says where the item stands too (none is
// signed for an archived item), so a lost restore mends itself the next time anyone opens the item. While it is put
// away, a grant signed before it was (an API token's, cached by its worker) is refused (`refusal`, Work Tracker 1323).
import {
  putAwayRefusal,
  type KeptStanding,
  type PutAwayRefusal,
  type StandingGrant,
} from '@liveworkspace/index-app';
import type { ItemWord } from '../../item';
import { AUTOMATION_LATE_MAX_MS } from '../../limits';
import { settleWaiting } from '../automation-log';
import type { ItemEngine } from '../item/engine';
import type { Sql } from '../sql';
import type { CollabWatch } from './collab-watch';

export type StoredStanding = KeptStanding;

// What a grant says of where its item stands.
export type { StandingGrant };

/** A held run whose time came while the item was put away, more than a day before it came back. */
export const waitPutAwayWords = (itemWord: ItemWord): string =>
  `The ${itemWord} was archived or in the Trash when this run was due`;

export interface ItemStandingInput {
  // The storage key the standing is kept under.
  key: string;
  itemWord: ItemWord;
  put: (key: string, value: StoredStanding) => Promise<unknown>;
  sql: () => Sql;
  ready: () => boolean;
  engine: () => ItemEngine;
  // The comment triggers' watch, where the app has one.
  collab?: () => CollabWatch;
  arm: () => void;
}

export class ItemStandingKeeper {
  private stored: StoredStanding | null = null;
  private readonly input: ItemStandingInput;

  constructor(input: ItemStandingInput) {
    this.input = input;
  }

  get key(): string {
    return this.input.key;
  }

  get putAway(): boolean {
    return this.stored?.putAway === true;
  }

  /** The stored copy as the room's constructor reads it; anything else is no standing (live). */
  restore(value: unknown): void {
    const v = value as Partial<StoredStanding> | null | undefined;
    this.stored =
      v && typeof v.putAway === 'boolean' && typeof v.at === 'number'
        ? { putAway: v.putAway, at: v.at, ...(v.trashed === true ? { trashed: true } : {}) }
        : null;
  }

  /** Whether a request's grant is refused: signed before the item was put away (putAwayRefusal). */
  refusal(grant: StandingGrant): PutAwayRefusal | null {
    return putAwayRefusal(this.stored, grant);
  }

  /** Whether `next` is newer than what is kept. */
  newer(next: StoredStanding): boolean {
    return this.stored === null || next.at > this.stored.at;
  }

  /** What a grant says, when it would change what is kept: only an item that heard it was put away is ever changed
   *  by one, so a grant costs nothing on an item that never was. */
  fromGrant(grant: StandingGrant): StoredStanding | null {
    if (this.stored === null) return null;
    const at = grant.iatMs ?? (typeof grant.iat === 'number' ? grant.iat * 1000 : null);
    if (at === null) return null;
    const trashed = grant.trashed === true;
    const next = { putAway: trashed, trashed, at };
    return next.putAway !== this.stored.putAway && this.newer(next) ? next : null;
  }

  /** Keep `next` when it is newer: stored first, then the rules follow a change of put away. */
  async apply(next: StoredStanding): Promise<void> {
    if (!this.newer(next)) return;
    const was = this.putAway;
    await this.input.put(this.input.key, next);
    this.stored = next;
    if (was === next.putAway) return;
    const engine = this.input.engine();
    if (next.putAway) {
      engine.sync();
      engine.schedule.clear();
      console.info('[standing] put away');
    } else {
      this.resume(Date.now());
      console.info('[standing] back');
    }
    this.input.collab?.().rulesChanged();
    this.input.arm();
  }

  /** The index's push: `{archived, trashed, at}`. */
  take(standing: { archived: boolean; trashed: boolean; at: number }): Promise<void> {
    return this.apply({
      putAway: standing.archived || standing.trashed,
      trashed: standing.trashed,
      at: standing.at,
    });
  }

  /** A grant handed to the room (an API request's, the room-ticket door's): taken when it says something newer (a
   *  failure is logged, never the caller's), then answered with whether the room refuses it as put away. */
  async takeGrant(grant: StandingGrant): Promise<PutAwayRefusal | null> {
    const next = this.fromGrant(grant);
    if (next) {
      try {
        await this.apply(next);
      } catch (err) {
        console.warn('[standing] not taken from the grant', { error: String(err) });
      }
    }
    return this.refusal(grant);
  }

  /** Back from Archived or the Trash: a held run more than a day past its time is Skipped, the rules are heard again
   *  and the schedule restores. A time rule's next moment stays the one it waited for, so the wake that follows
   *  takes the latest moment missed, a day late at most, and no other (schedule.ts). */
  resume(now: number): void {
    if (this.input.ready()) {
      const sql = this.input.sql();
      const late = sql
        .exec<{ id: string }>(
          'DELETE FROM automation_waiting WHERE at < ? RETURNING id',
          now - AUTOMATION_LATE_MAX_MS,
        )
        .toArray();
      const words = waitPutAwayWords(this.input.itemWord);
      for (const row of late) settleWaiting(sql, row.id, 'skipped', words);
    }
    const engine = this.input.engine();
    engine.restore(now);
    engine.sync();
  }

  /** The item is gone. */
  forget(): void {
    this.stored = null;
  }
}
