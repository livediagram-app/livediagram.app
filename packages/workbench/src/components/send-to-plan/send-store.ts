// The open item's sends, for its chips (liveworkspace/docs/specs/004-index/send-to-plan.md "The chip"): read once when
// the editor opens the item, then again only when the item's room says a plan's sent cards changed (the
// `source-changed` frame with `cards`), or after a send from here. Never polled. A module-level store, as the
// source-changed relay is: one editor runs per page, and the chips sit far apart in the tree (an element's indicators,
// a thread's header).
import { useSyncExternalStore } from 'react';
import type { PlanSend, PlanSendKind, ShareAccess } from '@liveworkspace/index-client';
import { indexClient } from '../../lib/index-client';
import { onSourceChanged } from '../sheet-links/sheet-link-signal';

type Reader = Pick<typeof indexClient, 'planSends'>;

type Source = { id: string; share: ShareAccess | null; reader: Reader };

let source: Source | null = null;
let sends: readonly PlanSend[] = [];
let version = 0;
let reading: AbortController | null = null;
let stopListening: (() => void) | null = null;
const listeners = new Set<() => void>();

const tell = () => {
  version += 1;
  for (const l of [...listeners]) l();
};

/** Reads the open item's sends again; a read still running is dropped for this one. */
export async function refreshSends(): Promise<void> {
  const from = source;
  if (!from) return;
  reading?.abort();
  const abort = new AbortController();
  reading = abort;
  try {
    const read = await from.reader.planSends(from.id, { share: from.share, signal: abort.signal });
    if (source !== from || abort.signal.aborted) return;
    sends = read.sends;
    tell();
  } catch {
    // Offline, signed out or refused: the chips the item had stay until the next read.
  } finally {
    if (reading === abort) reading = null;
  }
}

/** The editor's item, whose sends the chips show; null when it closes (or cannot send: Offline, embed, Community). */
export function setSendSource(
  id: string | null,
  share: ShareAccess | null = null,
  reader: Reader = indexClient,
): void {
  if (source?.id === id && source?.share?.code === share?.code) return;
  reading?.abort();
  stopListening?.();
  stopListening = null;
  source = id ? { id, share, reader } : null;
  sends = [];
  tell();
  if (!id) return;
  stopListening = onSourceChanged((signal) => {
    if (signal.cards && signal.cards.length > 0) void refreshSends();
  });
  void refreshSends();
}

/** The sends just made here, shown at once (the read after them confirms). */
export function addSends(made: readonly PlanSend[]): void {
  if (made.length === 0) return;
  const ids = new Set(made.map((s) => s.id));
  sends = [...made, ...sends.filter((s) => !ids.has(s.id))];
  tell();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** The open item's id while this session may send from it, else null. */
export function sendSourceId(): string | null {
  return source?.id ?? null;
}

/** Every send of the open item, newest first. */
export function currentSends(): readonly PlanSend[] {
  return sends;
}

// The element a send names, from its ref (`kind:tab:element:part`).
export const refElement = (ref: string): string => ref.split(':')[2] ?? '';

// Which of the element's threads a send names (a plan card's), or its picked words' key.
export const refPart = (ref: string): string => ref.split(':')[3] ?? '';

/** The sends of one element, of the kinds asked, newest first. */
export function sendsOf(
  all: readonly PlanSend[],
  elementId: string,
  kinds: readonly PlanSendKind[],
): PlanSend[] {
  return all.filter((s) => kinds.includes(s.kind) && refElement(s.ref) === elementId);
}

// Each element's sends, worked out once a version so a canvas of chips reads a map, not the list each.
let indexed: {
  version: number;
  element: Map<string, PlanSend[]>;
  thread: Map<string, PlanSend[]>;
} | null = null;
function byElement(): NonNullable<typeof indexed> {
  if (indexed?.version === version) return indexed;
  const element = new Map<string, PlanSend[]>();
  const thread = new Map<string, PlanSend[]>();
  for (const s of sends) {
    // A thread's chip sits on its thread; every other kind's (an element, its words, its action) on the element.
    const into = s.kind === 'thread' ? thread : element;
    const el = refElement(s.ref);
    if (!el) continue;
    const list = into.get(el);
    if (list) list.push(s);
    else into.set(el, [s]);
  }
  indexed = { version, element, thread };
  return indexed;
}

const EMPTY: PlanSend[] = [];

/** The sends of an element (its sticky, shape or words), or of its thread, newest first; live. */
export function useSends(
  elementId: string | null | undefined,
  of: 'element' | 'thread',
): PlanSend[] {
  return useSyncExternalStore(
    subscribe,
    () => (elementId ? (byElement()[of].get(elementId) ?? EMPTY) : EMPTY),
    () => EMPTY,
  );
}

/** Every send of the open item; live. */
export function useAllSends(): readonly PlanSend[] {
  return useSyncExternalStore(subscribe, currentSends, () => EMPTY);
}
