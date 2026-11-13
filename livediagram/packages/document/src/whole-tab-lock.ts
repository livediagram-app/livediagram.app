// Whole-tab writes keep other people's entries (docs/specs/013-workspace/share-roles.md "The collab key"; blueprint
// docs/specs/013-workspace/blueprints/share-roles.md "Whole-tab lock"). A tab save, a changeset or a re-commit writes
// the tab whole, so it could add, change or take away anyone's comment reaction, response or dot. This walks a
// livediagram tab and hands each comment's reactions, each card's responses and the vote's dots to the shared rule
// (@liveworkspace/model-core/person-entry-lock): the writer's own as written, anyone else's as the room ledger has
// them, else as the stored tab did.
//
// Two steps, so a write reads the ledger only when it has to: `wholeTabLockNeeds` names the elements (and the vote)
// where the write differs from the stored tab on someone else's entry, the api reads just those ledger entries, and
// `lockWholeTab` applies the rule to what was named. An element left unnamed already matches the stored tab on
// everyone else's entries, so there is nothing there to lock. Pure.

import {
  commentWithReactions,
  type CommentReaction,
} from '@liveworkspace/model-core/comment-reactions';
import {
  collapseLegacyReactions,
  foreignDotsDiffer,
  foreignEntriesDiffer,
  lockDots,
  lockEntries,
  REACTION_KEYS,
  reactionWords,
  RESPONSE_KEYS,
  responseWords,
  type LedgerWord,
  type PersonResponse,
} from '@liveworkspace/model-core/person-entry-lock';
import type { Element, Tab } from './index';
import type { Comment, CommentThread } from './comments';
import type { ElementLedger, TabLedger } from './collab-ledger';

export type WholeTabWriter = {
  // The writer's collab key; null for a writer that may change nobody's entry (an agent's token).
  key: string | null;
  // Whether a key is a derived collab key (the api's `isCollabKey`), for collapsing old editors' duplicates.
  isDerivedKey: (key: string) => boolean;
};

/** The ledger entries a write's lock needs: these elements', and the tab's vote. */
export type WholeTabLockNeeds = { elementIds: string[]; vote: boolean };

const NO_WORDS = new Map<string, LedgerWord<PersonResponse>>();

const threadOf = (el: Element | undefined): CommentThread | undefined =>
  (el as { commentThread?: CommentThread } | undefined)?.commentThread;

const commentsById = (el: Element | undefined): Map<string, Comment> =>
  new Map((threadOf(el)?.comments ?? []).map((c) => [c.id, c]));

const sameRound = (a: string | undefined, b: string | undefined) => (a ?? '') === (b ?? '');

// The stored card's responses a written one is judged against: only in the same round, since a clear (a new round)
// empties them for everyone.
function storedResponses(el: Element, was: Element | undefined): PersonResponse[] | undefined {
  if (el.type !== 'shape' || was?.type !== 'shape') return undefined;
  return sameRound(el.collabRound, was.collabRound) ? was.responses : undefined;
}

// The stored round's dots, when the write is on the same round.
function storedDots(written: Tab, stored: Tab | null): Record<string, string[]> | undefined {
  const was = stored?.vote;
  if (!written.vote || !was || was.round !== written.vote.round) return undefined;
  return was.votes;
}

function elementNeedsLedger(el: Element, was: Element | undefined, key: string | null): boolean {
  if (
    el.type === 'shape' &&
    foreignEntriesDiffer(el.responses, storedResponses(el, was), RESPONSE_KEYS, key)
  ) {
    return true;
  }
  const comments = threadOf(el)?.comments;
  if (!comments?.length) return false;
  const before = commentsById(was);
  return comments.some((c) =>
    foreignEntriesDiffer(c.reactions, before.get(c.id)?.reactions, REACTION_KEYS, key),
  );
}

/** Which ledger entries `lockWholeTab` needs for this write: none when it changes nobody else's entry. */
export function wholeTabLockNeeds(
  written: Tab,
  stored: Tab | null,
  key: string | null,
): WholeTabLockNeeds {
  const before = new Map((stored?.elements ?? []).map((e) => [e.id, e]));
  const elementIds = written.elements
    .filter((el) => elementNeedsLedger(el, before.get(el.id), key))
    .map((el) => el.id);
  const vote =
    !!written.vote && foreignDotsDiffer(written.vote.votes, storedDots(written, stored), key);
  return { elementIds, vote };
}

// Each comment's reactions: locked when `lock` (the element was named), and always with old editors' duplicates
// collapsed.
function lockReactions(
  el: Element,
  was: Element | undefined,
  entry: ElementLedger | undefined,
  writer: WholeTabWriter,
  lock: boolean,
): Element {
  const thread = threadOf(el);
  if (!thread?.comments?.length) return el;
  const before = lock ? commentsById(was) : null;
  let changed = false;
  const comments = thread.comments.map((c) => {
    const locked = before
      ? lockEntries<CommentReaction>(
          c.reactions,
          before.get(c.id)?.reactions,
          reactionWords(entry?.comments?.reacts, c.id),
          REACTION_KEYS,
          writer.key,
        )
      : c.reactions;
    const reactions = collapseLegacyReactions(locked, writer.isDerivedKey);
    if (reactions === c.reactions) return c;
    changed = true;
    return commentWithReactions(c, reactions);
  });
  return changed ? ({ ...el, commentThread: { ...thread, comments } } as Element) : el;
}

function lockResponses(
  el: Element,
  was: Element | undefined,
  entry: ElementLedger | undefined,
  key: string | null,
): Element {
  if (el.type !== 'shape') return el;
  const words =
    entry && sameRound(entry.round, el.collabRound) ? responseWords(entry.responses) : NO_WORDS;
  const responses = lockEntries(el.responses, storedResponses(el, was), words, RESPONSE_KEYS, key);
  if (responses === el.responses) return el;
  const { responses: _was, ...rest } = el;
  return responses ? { ...rest, responses } : rest;
}

/**
 * The tab a whole-tab write stores: everyone's reactions, responses and dots but the writer's as `ledger` (the
 * entries `needs` named), else the stored tab, has them; old editors' duplicate reactions collapsed. Only what `needs`
 * names is locked: anywhere else the write already matches the stored tab on everyone else's entries. The SAME tab
 * when nothing changes. A room that could not answer is an empty ledger: the stored entries stand.
 */
export function lockWholeTab(
  written: Tab,
  stored: Tab | null,
  ledger: TabLedger,
  writer: WholeTabWriter,
  needs: WholeTabLockNeeds,
): Tab {
  const named = new Set(needs.elementIds);
  const before = named.size ? new Map((stored?.elements ?? []).map((e) => [e.id, e])) : null;
  let changed = false;
  const elements = written.elements.map((el) => {
    const lock = before !== null && named.has(el.id);
    const was = lock ? before.get(el.id) : undefined;
    const entry = lock ? ledger.elements[el.id] : undefined;
    const answered = lock ? lockResponses(el, was, entry, writer.key) : el;
    const next = lockReactions(answered, was, entry, writer, lock);
    if (next !== el) changed = true;
    return next;
  });
  let vote = written.vote;
  if (vote && needs.vote) {
    const ledgerDots =
      vote.round !== undefined && ledger.vote?.round === vote.round ? ledger.vote.votes : undefined;
    const votes = lockDots(vote.votes, storedDots(written, stored), ledgerDots, writer.key);
    if (votes !== vote.votes) {
      vote = { ...vote, votes };
      changed = true;
    }
  }
  return changed ? { ...written, elements, ...(vote ? { vote } : {}) } : written;
}
