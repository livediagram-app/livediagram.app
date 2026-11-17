'use client';

// Paragraph holds, both ways (docs/specs/007-editor/article-pages.md "Holding a paragraph"). Ours: the block (or
// table cell) this person is typing in, claimed from the room (useArticleHoldBroadcast) and let go when the caret
// leaves it, after ARTICLE_HOLD_IDLE_MS without typing, or when the writing loses the caret. Collaborators': each
// one's hold from their `article-hold` ops, named and coloured from the room's presence list, dropped when they let
// go, leave, or say nothing for ARTICLE_HOLD_EXPIRE_MS. Read per article by the writing, which outlines what others
// hold and refuses typing in it, so the canvas never re-renders for a hold. Kept apart from the writing so a later
// feature that holds a paragraph (suggestions) takes the same holds.
import { useSyncExternalStore } from 'react';
import {
  ARTICLE_HOLD_EXPIRE_MS,
  ARTICLE_HOLD_IDLE_MS,
  ARTICLE_HOLD_REFRESH_MS,
  sameHoldPlace,
  type ArticleHold,
} from '@livedocuments/api-schema';

/** Where in an article a hold is: a block, and for a table cell its row's and column's ids. */
export type ArticleHoldSpot = { blockId: string; row?: string; col?: string };

// --- Ours ----------------------------------------------------------------------------------------

/** Our hold: claimed and waiting on the room (`pending`), or the room's answer is in (`granted`). `seq` tells one
 *  claim from the next. */
export type LocalArticleHold = {
  seq: number;
  flow: string;
  spot: ArticleHoldSpot;
  state: 'pending' | 'granted';
  typedAt: number;
  saidAt: number;
};

/** What the broadcaster is told: a new claim to send, the same claim to say again, or our hold let go. */
export type LocalHoldChange = 'claim' | 'refresh' | 'release';

/** An answer the writing acts on: our claim given, or refused because `holder` holds the spot. */
export type ArticleHoldAnswer =
  | { flow: string; spot: ArticleHoldSpot; granted: true }
  | { flow: string; spot: ArticleHoldSpot; granted: false; holder: string };

let local: LocalArticleHold | null = null;
let seq = 0;
// The room is open: a claim waits for its answer. Closed, every claim is ours at once (nobody else to ask).
let live = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const localListeners = new Set<(change: LocalHoldChange) => void>();
const answerListeners = new Set<(answer: ArticleHoldAnswer) => void>();

const placeOf = (flow: string, spot: ArticleHoldSpot) => ({ flow, ...spot });

function emitLocal(change: LocalHoldChange): void {
  for (const l of localListeners) l(change);
}

function emitAnswer(answer: ArticleHoldAnswer): void {
  for (const l of answerListeners) l(answer);
}

function clearIdle(): void {
  if (idleTimer !== null) clearTimeout(idleTimer);
  idleTimer = null;
}

/** Let go of our hold (of `flow`'s, when named): the caret left, the writing lost it, or it went idle. */
export function releaseArticleHold(flow?: string): void {
  if (!local || (flow !== undefined && local.flow !== flow)) return;
  local = null;
  clearIdle();
  emitLocal('release');
}

/** We typed in `spot` of `flow`'s writing: a new spot claims it, the same one keeps the hold (said again at most
 *  every ARTICLE_HOLD_REFRESH_MS once given). Either way the idle clock starts again. */
export function noteArticleTyping(
  flow: string,
  spot: ArticleHoldSpot | null,
  now = Date.now(),
): void {
  if (!spot) return;
  clearIdle();
  idleTimer = setTimeout(() => releaseArticleHold(), ARTICLE_HOLD_IDLE_MS);
  if (local && sameHoldPlace(placeOf(local.flow, local.spot), placeOf(flow, spot))) {
    local.typedAt = now;
    if (local.state === 'granted' && live && now - local.saidAt >= ARTICLE_HOLD_REFRESH_MS) {
      local.saidAt = now;
      emitLocal('refresh');
    }
    return;
  }
  seq += 1;
  local = { seq, flow, spot, state: live ? 'pending' : 'granted', typedAt: now, saidAt: now };
  emitLocal('claim');
}

/** Our caret is at `spot` in `flow`'s writing (null: nowhere a hold could be): a hold it left is let go. */
export function noteArticleCaret(flow: string, spot: ArticleHoldSpot | null): void {
  if (!local || local.flow !== flow) return;
  if (spot && sameHoldPlace(placeOf(local.flow, local.spot), placeOf(flow, spot))) return;
  releaseArticleHold();
}

/** The room answered claim `claimSeq` (`confirmed` false: it could not say, the socket down or the confirm
 *  timeout). Refused when a collaborator's hold on the same spot reached us first, which the room sends before its
 *  answer; else ours. A claim since replaced or let go is past answering. */
export function answerArticleClaim(claimSeq: number, confirmed: boolean): void {
  const claim = local;
  if (!claim || claim.seq !== claimSeq || claim.state !== 'pending') return;
  const holder = confirmed ? holderOf(claim.flow, claim.spot) : null;
  if (holder) {
    local = null;
    clearIdle();
    emitAnswer({ flow: claim.flow, spot: claim.spot, granted: false, holder: holder.name });
    return;
  }
  claim.state = 'granted';
  emitAnswer({ flow: claim.flow, spot: claim.spot, granted: true });
}

export function getLocalArticleHold(): LocalArticleHold | null {
  return local;
}

/** The block in `flow` whose claim the room has not answered: what a commit holds back until it does. */
export function pendingArticleHoldBlock(flow: string): string | null {
  return local?.flow === flow && local.state === 'pending' ? local.spot.blockId : null;
}

export function subscribeLocalArticleHold(l: (change: LocalHoldChange) => void): () => void {
  localListeners.add(l);
  return () => {
    localListeners.delete(l);
  };
}

export function subscribeArticleHoldAnswers(l: (answer: ArticleHoldAnswer) => void): () => void {
  answerListeners.add(l);
  return () => {
    answerListeners.delete(l);
  };
}

/** The room is open (true) or not: closed, a waiting claim is ours. */
export function setArticleHoldsLive(next: boolean): void {
  live = next;
  if (!next) answerArticleClaim(local?.seq ?? -1, false);
}

// --- Collaborators' ------------------------------------------------------------------------------

/** A collaborator's hold, as the writing draws it. */
export type ArticlePeerHold = { id: string; name: string; color: string } & ArticleHoldSpot;

type Held = { tabId: string; flow: string; spot: ArticleHoldSpot; at: number };

const holds = new Map<string, Held>();
const people = new Map<string, { name: string; color: string }>();
let activeTab: string | null = null;
let sweepTimer: ReturnType<typeof setTimeout> | null = null;
const peerListeners = new Set<() => void>();
let snapshots = new Map<string, readonly ArticlePeerHold[]>();
const NONE: readonly ArticlePeerHold[] = [];

function emitPeers(): void {
  snapshots = new Map();
  for (const l of peerListeners) l();
}

// Drops every hold not said again within ARTICLE_HOLD_EXPIRE_MS, then waits for the next to lapse.
function sweep(now = Date.now()): void {
  sweepTimer = null;
  let changed = false;
  let next = Infinity;
  for (const [id, h] of holds) {
    if (now - h.at >= ARTICLE_HOLD_EXPIRE_MS) changed = holds.delete(id) || changed;
    else next = Math.min(next, h.at + ARTICLE_HOLD_EXPIRE_MS);
  }
  if (next !== Infinity) sweepTimer = setTimeout(() => sweep(), next - now);
  if (changed) emitPeers();
}

function armSweep(): void {
  if (sweepTimer === null) sweep();
}

function holderOf(flow: string, spot: ArticleHoldSpot): { name: string } | null {
  for (const [id, h] of holds) {
    if (h.tabId !== activeTab || !sameHoldPlace(placeOf(h.flow, h.spot), placeOf(flow, spot)))
      continue;
    return { name: people.get(id)?.name ?? 'Someone' };
  }
  return null;
}

/** A collaborator's `article-hold` op: their hold, said again, or (flow null) let go. */
export function receiveArticleHold(from: string, hold: ArticleHold, now = Date.now()): void {
  if (hold.flow === null) {
    if (holds.delete(from)) emitPeers();
    return;
  }
  const spot: ArticleHoldSpot =
    hold.row !== undefined && hold.col !== undefined
      ? { blockId: hold.blockId, row: hold.row, col: hold.col }
      : { blockId: hold.blockId };
  const was = holds.get(from);
  holds.set(from, { tabId: hold.tabId, flow: hold.flow, spot, at: now });
  armSweep();
  const moved =
    !was ||
    was.tabId !== hold.tabId ||
    !sameHoldPlace(placeOf(was.flow, was.spot), placeOf(hold.flow, spot));
  if (moved) emitPeers();
}

/** The room's presence list: names and colours, and the holds of anyone who left go with them. */
export function syncArticleHolders(
  participants: readonly { id: string; name: string; color: string }[],
): void {
  let changed = false;
  const present = new Set<string>();
  for (const p of participants) {
    present.add(p.id);
    const was = people.get(p.id);
    if (was?.name === p.name && was.color === p.color) continue;
    people.set(p.id, { name: p.name, color: p.color });
    changed ||= holds.has(p.id);
  }
  for (const id of [...people.keys()]) if (!present.has(id)) people.delete(id);
  for (const id of [...holds.keys()]) if (!present.has(id)) changed = holds.delete(id) || changed;
  if (changed) emitPeers();
}

/** The tab this person is on now: only holds on it are drawn. */
export function setArticleHoldsTab(tabId: string | null): void {
  if (activeTab === tabId) return;
  activeTab = tabId;
  emitPeers();
}

/** The room closed: nobody's hold stays. */
export function resetArticleHolds(): void {
  holds.clear();
  people.clear();
  if (sweepTimer !== null) clearTimeout(sweepTimer);
  sweepTimer = null;
  emitPeers();
}

/** Collaborators' holds in `flow`'s writing on this person's tab, from people known by name. */
export function articleHoldsOf(flow: string): readonly ArticlePeerHold[] {
  const kept = snapshots.get(flow);
  if (kept) return kept;
  const out: ArticlePeerHold[] = [];
  for (const [id, h] of holds) {
    const person = people.get(id);
    if (h.flow !== flow || h.tabId !== activeTab || !person) continue;
    out.push({ id, ...person, ...h.spot });
  }
  const list = out.length ? out : NONE;
  snapshots.set(flow, list);
  return list;
}

const NO_BLOCKS: ReadonlySet<string> = new Set();

/** The blocks collaborators hold in `flow`'s writing on tab `tabId` (a held cell's table), on any tab and from anyone
 *  in the room: what an undo or redo leaves as their writers have it (article-hold-undo). */
export function peerHeldBlocks(tabId: string, flow: string): ReadonlySet<string> {
  let out: Set<string> | null = null;
  for (const h of holds.values()) {
    if (h.tabId !== tabId || h.flow !== flow) continue;
    (out ??= new Set()).add(h.spot.blockId);
  }
  return out ?? NO_BLOCKS;
}

function subscribePeers(l: () => void): () => void {
  peerListeners.add(l);
  return () => {
    peerListeners.delete(l);
  };
}

export function useArticleHolds(flow: string): readonly ArticlePeerHold[] {
  return useSyncExternalStore(
    subscribePeers,
    () => articleHoldsOf(flow),
    () => NONE,
  );
}

export function resetArticleHoldsForTests(): void {
  resetArticleHolds();
  local = null;
  live = false;
  activeTab = null;
  clearIdle();
  localListeners.clear();
  answerListeners.clear();
}
