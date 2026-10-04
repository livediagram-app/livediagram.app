'use client';

// Carets in the writing, both ways (docs/specs/007-editor/article-pages.md "Collaboration"). Ours:
// where this person's writing has its caret, published by the writing (ArticleEditor) and sent to
// the room (useArticleCaretBroadcast). Collaborators': each one's caret from their `article-caret`
// ops, named and coloured from the room's presence list (useRoomConnection), read per article by
// the writing that draws them, so the canvas never re-renders for a caret moving.
import { useSyncExternalStore } from 'react';
import type { ArticleCaret } from '@livediagram/api-schema';
import type { ArticleCaretPlace } from './article-caret';

// How long a collaborator's caret shows their name after it moves.
export const ARTICLE_PEER_FRESH_MS = 1500;

// --- Ours ----------------------------------------------------------------------------------------

export type LocalArticleCaret = ({ flow: string } & ArticleCaretPlace) | null;

let local: LocalArticleCaret = null;
const localListeners = new Set<() => void>();

/** This person's caret: in `flow`'s writing at `place`, or (null) gone from `flow`'s writing. */
export function setLocalArticleCaret(flow: string, place: ArticleCaretPlace | null): void {
  if (!place) {
    if (local?.flow !== flow) return;
    local = null;
  } else {
    if (local?.flow === flow && local.blockId === place.blockId && local.offset === place.offset)
      return;
    local = { flow, ...place };
  }
  for (const l of localListeners) l();
}

export function getLocalArticleCaret(): LocalArticleCaret {
  return local;
}

export function subscribeLocalArticleCaret(l: () => void): () => void {
  localListeners.add(l);
  return () => {
    localListeners.delete(l);
  };
}

// --- Collaborators' ------------------------------------------------------------------------------

export type ArticlePeerCaret = {
  // The collaborator's presence id.
  id: string;
  name: string;
  color: string;
  blockId: string;
  offset: number;
  // Moved within the last ARTICLE_PEER_FRESH_MS: their name shows.
  fresh: boolean;
};

type Held = { tabId: string; flow: string; blockId: string; offset: number; fresh: boolean };

const carets = new Map<string, Held>();
const people = new Map<string, { name: string; color: string }>();
const freshTimers = new Map<string, ReturnType<typeof setTimeout>>();
// The tab this person is on: a caret on another tab is not drawn (block ids repeat across tabs).
let activeTab: string | null = null;
const peerListeners = new Set<() => void>();
// Each article's carets, kept by identity until something changes.
let snapshots = new Map<string, readonly ArticlePeerCaret[]>();
const NONE: readonly ArticlePeerCaret[] = [];

function emitPeers(): void {
  snapshots = new Map();
  for (const l of peerListeners) l();
}

function forget(id: string): boolean {
  const timer = freshTimers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  freshTimers.delete(id);
  return carets.delete(id);
}

/** A collaborator's `article-caret` op: their caret moved, or (flow null) left the writing. */
export function receiveArticleCaret(from: string, caret: ArticleCaret): void {
  if (caret.flow === null) {
    if (forget(from)) emitPeers();
    return;
  }
  const was = carets.get(from);
  if (
    was &&
    was.tabId === caret.tabId &&
    was.flow === caret.flow &&
    was.blockId === caret.blockId &&
    was.offset === caret.offset
  )
    return;
  const timer = freshTimers.get(from);
  if (timer !== undefined) clearTimeout(timer);
  freshTimers.set(
    from,
    setTimeout(() => {
      freshTimers.delete(from);
      const held = carets.get(from);
      if (!held) return;
      carets.set(from, { ...held, fresh: false });
      emitPeers();
    }, ARTICLE_PEER_FRESH_MS),
  );
  carets.set(from, {
    tabId: caret.tabId,
    flow: caret.flow,
    blockId: caret.blockId,
    offset: caret.offset,
    fresh: true,
  });
  emitPeers();
}

/** The room's presence list: names and colours, and the carets of anyone who left go with them. */
export function syncArticlePeople(
  participants: readonly { id: string; name: string; color: string }[],
): void {
  let changed = false;
  const present = new Set<string>();
  for (const p of participants) {
    present.add(p.id);
    const was = people.get(p.id);
    if (was?.name === p.name && was.color === p.color) continue;
    people.set(p.id, { name: p.name, color: p.color });
    changed ||= carets.has(p.id);
  }
  for (const id of [...people.keys()]) if (!present.has(id)) people.delete(id);
  for (const id of [...carets.keys()]) if (!present.has(id)) changed = forget(id) || changed;
  if (changed) emitPeers();
}

/** The tab this person is on now. */
export function setArticleCaretsTab(tabId: string | null): void {
  if (activeTab === tabId) return;
  activeTab = tabId;
  emitPeers();
}

/** The room closed: nobody's caret stays. */
export function resetArticlePeers(): void {
  for (const id of [...carets.keys()]) forget(id);
  people.clear();
  emitPeers();
}

/** The collaborators' carets in `flow`'s writing on this person's tab, the one known by name. */
export function articlePeersOf(flow: string): readonly ArticlePeerCaret[] {
  const kept = snapshots.get(flow);
  if (kept) return kept;
  const out: ArticlePeerCaret[] = [];
  for (const [id, c] of carets) {
    const person = people.get(id);
    if (c.flow !== flow || c.tabId !== activeTab || !person) continue;
    out.push({ id, ...person, blockId: c.blockId, offset: c.offset, fresh: c.fresh });
  }
  const list = out.length ? out : NONE;
  snapshots.set(flow, list);
  return list;
}

function subscribePeers(l: () => void): () => void {
  peerListeners.add(l);
  return () => {
    peerListeners.delete(l);
  };
}

export function useArticlePeers(flow: string): readonly ArticlePeerCaret[] {
  return useSyncExternalStore(
    subscribePeers,
    () => articlePeersOf(flow),
    () => NONE,
  );
}

export function resetArticleCaretsForTests(): void {
  resetArticlePeers();
  local = null;
  activeTab = null;
}
