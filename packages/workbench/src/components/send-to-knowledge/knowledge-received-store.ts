// A knowledgebase's received sends, for the Sent From chips on its pages (liveworkspace/docs/specs/004-index/
// send-to-knowledge.md "The chips"): read once when the knowledgebase opens, and again after the person sends here
// from another tab never (never polled; a renamed source shows its new name the next time the page opens). Only sends
// whose source the reader can open come back, so a source's name never reaches anyone who could not open it.
import type { KnowledgeReceived, ShareAccess } from '@liveworkspace/index-client';
import { indexClient } from '../../lib/index-client';

type Reader = Pick<typeof indexClient, 'knowledgeReceived'>;

let kb: string | null = null;
let byPlace = new Map<string, KnowledgeReceived>();
let reading: AbortController | null = null;
const listeners = new Set<() => void>();

function set(received: readonly KnowledgeReceived[]) {
  byPlace = new Map();
  for (const r of received) if (!byPlace.has(r.place)) byPlace.set(r.place, r);
  for (const l of [...listeners]) l();
}

/** The knowledgebase open here, whose received sends the chips show; null when it closes. */
export function setKnowledgeReceivedSource(
  id: string | null,
  share: ShareAccess | null = null,
  reader: Reader = indexClient,
): void {
  if (kb === id) return;
  reading?.abort();
  kb = id;
  set([]);
  if (!id) return;
  const abort = new AbortController();
  reading = abort;
  // Read on a later turn, so a reader that throws at once is refused like one that answers no.
  Promise.resolve()
    .then(() => reader.knowledgeReceived(id, { share, signal: abort.signal }))
    .then((read) => {
      if (kb === id && !abort.signal.aborted) set(read.received);
    })
    .catch(() => {
      // Offline, a link visitor or refused: the Sent From lines stay plain words and their links.
    })
    .finally(() => {
      if (reading === abort) reading = null;
    });
}

/** The received send a Sent From line's link names, or null (a source the reader cannot open, or none). */
export const receivedAt = (href: string): KnowledgeReceived | null => byPlace.get(href) ?? null;

/** Whether any send was received here: with none, the page has no chip to look for. */
export const anyReceived = (): boolean => byPlace.size > 0;

/** Listens for the received sends changing; answers the unsubscribe. */
export function onReceivedChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
