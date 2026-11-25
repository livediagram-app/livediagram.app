// The open item's Send to Knowledge Base sends, for its chips (liveworkspace/docs/specs/004-index/send-to-knowledge.md
// "The chips"): read once when the editor opens the item and again after a send from here. Never polled. Only sends
// whose knowledgebase the reader can open come back. A module-level store, as Send to Plan's is.
import { useSyncExternalStore } from 'react';
import type { KnowledgeSend, ShareAccess } from '@liveworkspace/index-client';
import { indexClient } from '../../lib/index-client';

type Reader = Pick<typeof indexClient, 'knowledgeSends'>;
type Source = { id: string; share: ShareAccess | null; reader: Reader };

let source: Source | null = null;
let sends: readonly KnowledgeSend[] = [];
let byElement = new Map<string, KnowledgeSend[]>();
let reading: AbortController | null = null;
const listeners = new Set<() => void>();

const EMPTY: KnowledgeSend[] = [];

function set(next: readonly KnowledgeSend[]) {
  sends = next;
  // Each element's sends, worked out once a change so a canvas of chips reads a map, not the list each.
  byElement = new Map();
  for (const s of sends)
    for (const el of s.elementIds) {
      const list = byElement.get(el);
      if (list) list.push(s);
      else byElement.set(el, [s]);
    }
  for (const l of [...listeners]) l();
}

/** Reads the open item's sends again; a read still running is dropped for this one. */
export async function refreshKnowledgeSends(): Promise<void> {
  const from = source;
  if (!from) return;
  reading?.abort();
  const abort = new AbortController();
  reading = abort;
  try {
    const read = await from.reader.knowledgeSends(from.id, {
      share: from.share,
      signal: abort.signal,
    });
    if (source !== from || abort.signal.aborted) return;
    set(read.sends);
  } catch {
    // Offline, signed out or refused: the chips the item had stay until the next read.
  } finally {
    if (reading === abort) reading = null;
  }
}

/** The editor's item, whose sends the chips show; null when it closes or cannot send. */
export function setKnowledgeSendSource(
  id: string | null,
  share: ShareAccess | null = null,
  reader: Reader = indexClient,
): void {
  if (source?.id === id && source?.share?.code === share?.code) return;
  reading?.abort();
  source = id ? { id, share, reader } : null;
  set([]);
  if (id) void refreshKnowledgeSends();
}

/** A send just made here, shown at once (the read after it confirms). */
export function addKnowledgeSend(made: KnowledgeSend): void {
  set([made, ...sends.filter((s) => s.id !== made.id)]);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** The sends of one element, newest first; live. */
export function useKnowledgeSends(elementId: string | null | undefined): KnowledgeSend[] {
  return useSyncExternalStore(
    subscribe,
    () => (elementId ? (byElement.get(elementId) ?? EMPTY) : EMPTY),
    () => EMPTY,
  );
}

/** The sends of one element, newest first; as of now. */
export const elementKnowledgeSends = (elementId: string): readonly KnowledgeSend[] =>
  byElement.get(elementId) ?? EMPTY;

/** Opens a sent page in liveknowledge, in a new browser tab. */
export function openSentPage(send: Pick<KnowledgeSend, 'link'>): void {
  window.open(send.link, '_blank', 'noopener,noreferrer');
}

/** A send's place in words: "On Onboarding · Team Wiki". */
export const sentPageWords = (send: KnowledgeSend): string =>
  `On ${send.page.title || 'Untitled page'} · ${send.knowledgebase.title || 'Untitled knowledgebase'}`;
