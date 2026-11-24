// The room's side of its knowledgebase's sources (docs/specs/030-knowledgebase/search-and-ask.md "Sources"; the
// work itself is knowledge/source-work.ts): owing the look at its set, and taking the index's change signal.
import type { KnowledgeSourceChange } from '@liveworkspace/index-client';
import {
  SOURCE_SYNC_KEY,
  SOURCE_SYNC_SOON_MS,
  oweSourceWork,
  takeSourceChange,
} from '../knowledge/source-work';
import type { DocumentRoom } from './document-room';
import { ensureSchema } from './document-room-content';

/** Owe a source's read, or the set's look (`~sync`), at `dueAt`, and wake the alarm for it. */
export function oweSources(room: DocumentRoom, key: string, dueAt: number): void {
  oweSourceWork(room.state.storage.sql, key, dueAt);
  room.knowledge.wake(dueAt);
}

/** A connected tab came or went, or a page was removed: the set is looked at soon, one look for a burst of writes. */
export function oweSourceSync(room: DocumentRoom): void {
  oweSources(room, SOURCE_SYNC_KEY, Date.now() + SOURCE_SYNC_SOON_MS);
}

/** A source changed or went (the index's knowledge-source-changed door, liveworkspace/docs/specs/004-index/
 *  knowledge-sources.md "Keeping in step"): a source gone is dropped now, a changed one read again after a minute, an
 *  item not yet read sends the room to look at its set. A room never started takes nothing. */
export function takeKnowledgeSourceChange(
  room: DocumentRoom,
  documentId: string,
  change: KnowledgeSourceChange,
): void {
  room.bindDocument(documentId);
  if (!room.storedSchema()) return;
  ensureSchema(room);
  const dueAt = takeSourceChange(room.state.storage.sql, change, Date.now());
  if (dueAt !== null) room.knowledge.wake(dueAt);
}
