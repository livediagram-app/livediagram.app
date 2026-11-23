// The open item's diagram sends, for its chips and the picker's Update (liveworkspace/docs/specs/004-index/
// send-to-diagram.md "The chip", "Sending again"): read once when the editor opens the item, then again after a send
// from here. Never polled. A module-level store, as Send to Plan's: one editor runs per page, and the chips sit in the
// writing, far from the picker. Named only by an editor whose app drafts diagrams, so no other app makes the read.
import { useSyncExternalStore } from 'react';
import {
  diagramSendElement,
  type DiagramSend,
  type ShareAccess,
} from '@liveworkspace/index-client';
import { indexClient } from '../../lib/index-client';

type Reader = Pick<typeof indexClient, 'diagramSends'>;

type Source = { id: string; share: ShareAccess | null; reader: Reader };

let source: Source | null = null;
let sends: readonly DiagramSend[] = [];
let byElement: Map<string, DiagramSend[]> | null = null;
let reading: AbortController | null = null;
const listeners = new Set<() => void>();
const EMPTY: DiagramSend[] = [];

const tell = () => {
  byElement = null;
  for (const l of [...listeners]) l();
};

/** Reads the open item's diagram sends again; a read still running is dropped for this one. */
export async function refreshDiagramSends(): Promise<void> {
  const from = source;
  if (!from) return;
  reading?.abort();
  const abort = new AbortController();
  reading = abort;
  try {
    const read = await from.reader.diagramSends(from.id, {
      share: from.share,
      signal: abort.signal,
    });
    if (source !== from || abort.signal.aborted) return;
    sends = read.sends;
    tell();
  } catch {
    // Offline, signed out or refused: the chips stay as they were until the next read.
  } finally {
    if (reading === abort) reading = null;
  }
}

/** The editor's item, whose diagram sends the chips show; null when it closes or cannot send. */
export function setDiagramSendSource(
  id: string | null,
  share: ShareAccess | null = null,
  reader: Reader = indexClient,
): void {
  if (source?.id === id && source?.share?.code === share?.code) return;
  reading?.abort();
  source = id ? { id, share, reader } : null;
  sends = [];
  tell();
  if (id) void refreshDiagramSends();
}

/** A send just made here, shown at once; the same place, diagram and tab keep one entry. */
export function addDiagramSend(made: DiagramSend): void {
  sends = [
    made,
    ...sends.filter(
      (s) =>
        s.id !== made.id &&
        !(s.ref === made.ref && s.diagram.id === made.diagram.id && s.tabId === made.tabId),
    ),
  ];
  tell();
}

function indexed(): Map<string, DiagramSend[]> {
  if (byElement) return byElement;
  const map = new Map<string, DiagramSend[]>();
  for (const s of sends) {
    const el = diagramSendElement(s.ref);
    if (!el) continue;
    const list = map.get(el);
    if (list) list.push(s);
    else map.set(el, [s]);
  }
  byElement = map;
  return map;
}

/** The diagram sends of an element (a block), newest first; as of now. */
export function elementDiagramSends(elementId: string): readonly DiagramSend[] {
  return indexed().get(elementId) ?? EMPTY;
}

/** Listens for any change to the open item's diagram sends; answers the unsubscribe. */
export function onDiagramSendsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The diagram sends of an element, newest first; live. */
export function useElementDiagramSends(elementId: string | null): readonly DiagramSend[] {
  return useSyncExternalStore(
    onDiagramSendsChanged,
    () => (elementId ? elementDiagramSends(elementId) : EMPTY),
    () => EMPTY,
  );
}
