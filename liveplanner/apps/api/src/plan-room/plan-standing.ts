// Where the plan stands at the index (docs/specs/026-plan/automations.md "Put away"; blueprint automations.md "Put
// away"; liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Where an item stands"). The index pushes
// `{archived, trashed, at}` on every archive, move out, trash and restore; the room keeps the newest under one storage
// key and, while the plan is put away, its schedules read as empty (no time rule, Wait or repeating card wakes it) and
// its rules hear nothing. A plan that never heard keeps no key and runs as before (fails open). A grant signed after
// the stored moment says where the plan stands too (no grant is signed for an archived item), so a lost move out or
// restore mends itself the next time anyone opens the plan. While it is put away, a grant signed before it was (an API
// token's, cached by its worker) is refused (`refusal`, Work Tracker 1323).
import { AUTOMATION_LATE_MAX_MS } from '@liveplanner/items';
import {
  isPutAway,
  putAwayRefusal,
  type ItemStanding,
  type KeptStanding,
  type PutAwayRefusal,
  type StandingGrant,
} from '@liveworkspace/index-client';
import { settleWaiting } from './automations/automation-log';
import { clearAgentsFor } from './plan-room-presence';
import { closeAllIfTrashed, closeSessionsForAccessChange } from './plan-room-sockets';
import type { PlanRoom } from './plan-room';

export const STANDING_KEY = 'planStanding';

// A held run whose time came while the plan was put away, more than a day before it came back.
export const WAIT_PUT_AWAY = 'The plan was archived or in the Trash when this run was due';

export type StoredStanding = KeptStanding;

export class PlanStanding {
  private stored: StoredStanding | null = null;

  get putAway(): boolean {
    return this.stored?.putAway === true;
  }

  // The stored copy as the constructor reads it; anything else is no standing (live).
  restore(value: unknown): void {
    const v = value as Partial<StoredStanding> | null | undefined;
    this.stored =
      v && typeof v.putAway === 'boolean' && typeof v.at === 'number'
        ? { putAway: v.putAway, at: v.at, ...(v.trashed === true ? { trashed: true } : {}) }
        : null;
  }

  // Whether a request's grant is refused: signed before the plan was put away (putAwayRefusal).
  refusal(grant: StandingGrant): PutAwayRefusal | null {
    return putAwayRefusal(this.stored, grant);
  }

  // Whether `next` is newer than what is kept.
  newer(next: StoredStanding): boolean {
    return this.stored === null || next.at > this.stored.at;
  }

  // What a grant signed at `iat` (epoch seconds) says, when it would change what is kept: only a plan that heard it
  // was put away is ever changed by one, so a grant costs nothing on a plan that never was.
  fromGrant(grant: { iat?: number; trashed?: boolean }): StoredStanding | null {
    if (this.stored === null || typeof grant.iat !== 'number') return null;
    const trashed = grant.trashed === true;
    const next = { putAway: trashed, trashed, at: grant.iat * 1000 };
    return next.putAway !== this.stored.putAway && this.newer(next) ? next : null;
  }

  set(next: StoredStanding): void {
    this.stored = next;
  }
}

// Keep `next` when it is newer: stored first, then the room's schedules follow a change of put away.
export async function applyStanding(room: PlanRoom, next: StoredStanding): Promise<void> {
  if (!room.standing.newer(next)) return;
  const was = room.standing.putAway;
  await room.state.storage.put(STANDING_KEY, next);
  room.standing.set(next);
  if (was === next.putAway) return;
  if (next.putAway) {
    room.repeats.clear();
    room.automations.schedule.clear();
    console.info('[standing] put away');
  } else {
    resumePlan(room, Date.now());
    console.info('[standing] back');
  }
  room.armAlarm();
}

// The index's push. A newer word that the plan went to the Trash (from the editor, the Explorer, the REST API or MCP
// alike) ends every session there (docs/specs/013-workspace/trash.md "Open editors"; Work Tracker 1141): each hears
// project-trashed, its socket closes with 4004 and the agents' presence clears. A newer word that it was archived ends
// every session with 4010 and no op. Nothing more is kept, so a restore's next join is admitted as before.
export async function takeStanding(room: PlanRoom, standing: ItemStanding): Promise<void> {
  const next = { putAway: isPutAway(standing), trashed: standing.trashed, at: standing.at };
  const fresh = room.standing.newer(next);
  await applyStanding(room, next);
  if (!fresh) return;
  // A newer word that the plan was archived (Work Tracker 1242, one-explorer.md "Archived from elsewhere while open"):
  // every socket closes with 4010, telling nobody anything else, and each editor leaves for the Explorer.
  if (standing.archived && !standing.trashed) {
    closeSessionsForAccessChange(room, { match: 'archived' });
    return;
  }
  if (!standing.trashed) return;
  const op = { kind: 'project-trashed' };
  room.broadcastSystemOp(op);
  const closed = closeAllIfTrashed(room, op);
  await clearAgentsFor(room, op);
  console.info('[standing] trashed', { closed });
}

// A grant handed to the room (an API request's, a session's renewal). A failure is logged, never the caller's.
export async function takeGrantStanding(
  room: PlanRoom,
  grant: { iat?: number; trashed?: boolean },
): Promise<void> {
  const next = room.standing.fromGrant(grant);
  if (!next) return;
  try {
    await applyStanding(room, next);
  } catch (err) {
    console.warn('[standing] not taken from the grant', { error: String(err) });
  }
}

// Back from Archived or the Trash: each repeating card settles afresh (yesterday at the latest, so at most today's
// copy comes), a held run more than a day past its time is Skipped, and both schedules restore. A time rule's
// `next_at` stays the moment it waited for, so the wake that follows takes the latest moment missed, a day late at
// most (automation-time.ts latestMissed), and no other.
export function resumePlan(room: PlanRoom, now: number): void {
  if (room.schemaReady) {
    const sql = room.state.storage.sql;
    sql.exec('UPDATE item_repeats SET dirty = 1');
    const late = sql
      .exec(
        'DELETE FROM automation_waiting WHERE at < ? RETURNING id',
        now - AUTOMATION_LATE_MAX_MS,
      )
      .toArray() as unknown as { id: string }[];
    for (const row of late) settleWaiting(sql, row.id, 'skipped', WAIT_PUT_AWAY);
  }
  room.repeats.restore(now);
  room.automations.schedule.restore(now);
}
