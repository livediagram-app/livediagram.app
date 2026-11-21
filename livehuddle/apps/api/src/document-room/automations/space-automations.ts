// A Space's Automations as its room holds them (docs/specs/013-workspace/automations.md; blueprint automations.md
// "The engine in the room"; liveworkspace/docs/specs/018-automations/blueprints/item-engine.md "Wiring an app"): the
// one ItemEngine over livehuddle's kinds, where the Space stands, the room as the public doors need it, what the
// alarm makes of them, and what a purge leaves. Each is the platform's (@liveworkspace/automations/room), bound here
// to this room. livehuddle has no comment threads, so there is no collab watch. The kit the engine runs with is
// space-kit.ts.
import { KINDS } from '@livehuddle/document/automations';
import {
  ItemEngine,
  ItemStandingKeeper,
  runItemAutomations,
  type ItemDoorRoom,
} from '@liveworkspace/automations/room';
import type { DocumentRoom } from '../document-room';
import { spaceKit } from './space-kit';

// The storage key the Space's standing is kept under.
export const STANDING_KEY = 'documentStanding';

/** The room's engine. Its schedule reads as empty, and its rules hear nothing, until the schema stands and while
 *  the Space is put away. */
export function newSpaceAutomations(room: DocumentRoom): ItemEngine {
  return new ItemEngine({
    sql: () => room.state.storage.sql,
    ready: () => room.schemaReady,
    arm: () => room.armAlarm(),
    kinds: KINDS,
    kit: () => spaceKit(room),
    putAway: () => room.standing.putAway,
  });
}

/** Where the Space stands at the index: while it is archived or in the Trash its rules hear nothing and nothing of
 *  theirs wakes it. */
export function newStanding(room: DocumentRoom): ItemStandingKeeper {
  return new ItemStandingKeeper({
    key: STANDING_KEY,
    itemWord: KINDS.itemWord,
    put: (key, value) => room.state.storage.put(key, value),
    sql: () => room.state.storage.sql,
    ready: () => room.schemaReady,
    engine: () => room.automations,
    arm: () => room.armAlarm(),
  });
}

/** The room as the public doors need it (an Incoming Webhook call, a rule email's unsubscribe). */
export const automationDoors = (room: DocumentRoom): ItemDoorRoom => ({
  started: () => room.hasSchema(),
  ensure: () => room.ensureSchema(),
  engine: room.automations,
  arm: () => room.armAlarm(),
});

/** After a wake, once the schema stands: the rules heard, the queue's, the times' and the settles' next wake. */
export function restoreAutomations(room: DocumentRoom, now: number): void {
  room.automations.restore(now);
}

/** The alarm's share: what waits is run when it is due. Never throws (runItemAutomations). */
export async function runSpaceAutomations(room: DocumentRoom, now: number): Promise<void> {
  if (room.automations.schedule.due(now)) await runItemAutomations(room.automations, now);
}

/** The Space is gone for good: nothing is heard and nothing wakes it. */
export function forgetAutomations(room: DocumentRoom): void {
  room.standing.forget();
  room.automations.clear();
  // The settlers and the straight kinds follow the rules, which are gone with the schema.
  room.automations.sync();
}
