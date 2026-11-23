// A document's Automations as its room holds them (docs/specs/013-workspace/automations.md; blueprint automations.md
// "The engine in the room"; liveworkspace/docs/specs/018-automations/blueprints/item-engine.md "Wiring an app"): the
// one ItemEngine over liveknowledge' kinds, the comment triggers' watch, where the document stands, the room as the
// public doors need it, what the alarm makes of them, and what a purge leaves. Each is the platform's
// (@liveworkspace/automations/room), bound here to this room. The kit the engine runs with is document-kit.ts.
import { collabIndexRowsFromElements, type Element } from '@liveknowledge/document';
import { KINDS, REVIEW_DUE_EVENT } from '@liveknowledge/document/automations';
import {
  CollabWatch,
  ItemEngine,
  ItemStandingKeeper,
  runItemAutomations,
  tabElements,
  watchRules,
  type ItemDoorRoom,
} from '@liveworkspace/automations/room';
import type { DocumentRoom } from '../document-room';
import { ensureSchema } from '../document-room-content';
import { documentKit } from './document-kit';

// The storage key the document's standing is kept under.
export const STANDING_KEY = 'documentStanding';

// The tab link table the engine's triggers and the collab baseline read.
export const TAB_LINKS = 'document_tabs';

/** The room's engine. Its schedule reads as empty, and its rules hear nothing, until the schema stands and while
 *  the document is put away. */
export function newDocumentAutomations(room: DocumentRoom): ItemEngine {
  return new ItemEngine({
    sql: () => room.state.storage.sql,
    ready: () => room.schemaReady,
    arm: () => room.armAlarm(),
    kinds: KINDS,
    kit: () => documentKit(room),
    putAway: () => room.standing.putAway,
    tier: () => room.tier,
  });
}

/** The comment and action triggers' watch over each tab's threads, following every rule write. */
export function newCollabWatch(room: DocumentRoom): CollabWatch {
  const watch = new CollabWatch({
    engine: () => room.automations,
    sql: () => room.state.storage.sql,
    ready: () => room.schemaReady,
    arm: () => room.armAlarm(),
    links: TAB_LINKS,
    rows: (data) => collabIndexRowsFromElements(tabElements(data) as Element[]),
  });
  watchRules(room.automations, watch);
  return watch;
}

/** Call `owe` (the review check, knowledge-work.ts) when a rule that is on comes to hear Review Due, so its first
 *  look marks the pages already due (review-events.ts) a minute after the rule is saved, not when the next review
 *  comes due. Once per change from heard nothing to heard: a sync that changes nothing owes nothing. */
export function watchReviewRules(engine: ItemEngine, owe: () => void): void {
  let heard = false;
  const synced = engine.store.onSchedule;
  engine.store.onSchedule = () => {
    synced();
    const hears = engine.kinds.has(REVIEW_DUE_EVENT);
    if (hears && !heard) owe();
    heard = hears;
  };
}

/** Where the document stands at the index: while it is archived or in the Trash its rules hear nothing and nothing
 *  of theirs wakes it. */
export function newStanding(room: DocumentRoom): ItemStandingKeeper {
  return new ItemStandingKeeper({
    key: STANDING_KEY,
    itemWord: KINDS.itemWord,
    put: (key, value) => room.state.storage.put(key, value),
    sql: () => room.state.storage.sql,
    ready: () => room.schemaReady,
    engine: () => room.automations,
    collab: () => room.collab,
    arm: () => room.armAlarm(),
  });
}

/** The room as the public doors need it (an Incoming Webhook call, a rule email's unsubscribe). */
export const automationDoors = (room: DocumentRoom): ItemDoorRoom => ({
  started: () => room.storedSchema(),
  ensure: () => ensureSchema(room),
  engine: room.automations,
  arm: () => room.armAlarm(),
});

/** After a wake, once the schema stands: the rules heard, the queue's and the times' next wake. */
export function restoreAutomations(room: DocumentRoom, now: number): void {
  room.automations.restore(now);
  room.collab.restore();
}

/** The alarm's share: what waits is run when it is due. Never throws (runItemAutomations). */
export async function runDocumentAutomations(room: DocumentRoom, now: number): Promise<void> {
  if (room.automations.schedule.due(now)) await runItemAutomations(room.automations, now);
}

/** The document is gone for good: nothing is heard and nothing wakes it. */
export function forgetAutomations(room: DocumentRoom): void {
  room.standing.forget();
  room.automations.clear();
  // The settlers and the straight kinds follow the rules, which are gone with the schema.
  room.automations.sync();
  room.collab.forget();
}
