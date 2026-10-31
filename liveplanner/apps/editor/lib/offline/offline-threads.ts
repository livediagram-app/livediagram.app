// A This Browser plan's comment threads (docs/specs/026-plan/items.md "Comments", "Offline projects"): stored in its
// own record as `threads`, beside its items, and written by the same pure writes the api applies
// (@liveplanner/project applyThreadChange), serialised with the record's other writes. The person holds the plan, so
// they are its Editor; another plan never reaches these threads, so a thread here is on this plan's cards alone.
//
// A record written before threads holds each card's old single thread in the card's `fields.comments`: it is read as
// the card's first thread (legacyThreadOf), and moved into `threads` by the next write to the record.

import {
  CARD_THREADS_MAX,
  applyThreadChange,
  createComment,
  legacyThreadOf,
  newThreadId,
  readThreadTitle,
  startThread,
  threadOnlyBy,
  threadTitle,
  threadsOnCard,
  withoutLegacyThread,
  type CardThread,
  type ThreadChange,
} from '@liveplanner/project';
import {
  commentsFieldsOf,
  legacyCatalogue,
  storedThreadField,
  typeIn,
  typesOf,
  type Item,
  type ItemCreate,
  type ItemWrite,
} from '@liveplanner/items';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { ApiError } from '../api/core';
import type { ThreadAction, ThreadAnswer, ThreadWriter } from '../api/card-threads';
import {
  offlineGetRecord,
  offlineUpdateRecord,
  serializeOfflineWrite,
  type OfflineProjectRecord,
} from './offline-store';

/** The record's threads: those it stores, and (a record from before threads) each card's old single thread. */
export function recordThreads(
  rec: Pick<OfflineProjectRecord, 'id' | 'items' | 'threads'>,
): CardThread[] {
  const stored = rec.threads ?? [];
  const held = new Set(stored.map((t) => t.id));
  const legacy = (rec.items ?? []).flatMap((item) => {
    const t = legacyThreadOf(item, rec.id);
    // Titled as the api titles a moved thread: its automatic title.
    return t && !held.has(t.id) ? [{ ...t, title: threadTitle(t) }] : [];
  });
  return legacy.length ? [...stored, ...legacy] : stored;
}

/** The record with every old single thread moved into `threads` (the same record when it holds none). */
export function migratedRecord(rec: OfflineProjectRecord): OfflineProjectRecord {
  if (!(rec.items ?? []).some((i) => 'comments' in i.fields)) return rec;
  return {
    ...rec,
    threads: recordThreads(rec),
    items: (rec.items ?? []).map(withoutLegacyThread),
  };
}

export async function offlineFetchThreads(projectId: string): Promise<CardThread[]> {
  const rec = await offlineGetRecord(projectId);
  return rec ? recordThreads(rec) : [];
}

const STATUS: Record<string, number> = {
  item_not_found: 404,
  thread_not_found: 404,
  comment_not_found: 404,
  thread_on_card: 409,
  threads_full: 413,
  comments_full: 413,
  thread_cards_full: 413,
  title_too_long: 400,
  forbidden: 403,
  thread_has_others: 409,
};

const refused = (code: string) => new ApiError('thread write', STATUS[code] ?? 400, code);

// The change an action makes to a thread that exists, or the refusal.
function changeOf(
  action: Exclude<ThreadAction, { kind: 'start' } | { kind: 'deleteThread' }>,
  who: ThreadWriter,
  thread: CardThread,
  rec: OfflineProjectRecord,
): ThreadChange {
  switch (action.kind) {
    case 'reply':
      return {
        kind: 'add',
        comment: createComment(
          action.text,
          { id: who.ownerId, name: who.by.name, color: who.by.color },
          action.mentions,
        ),
      };
    case 'edit': {
      const target = thread.comments.find((c) => c.id === action.commentId);
      // Only its author edits a comment, here as on the api.
      if (target && target.authorId !== who.ownerId) throw refused('forbidden');
      return {
        kind: 'edit',
        commentId: action.commentId,
        text: action.text,
        ...(action.mentions?.length ? { mentions: action.mentions } : {}),
      };
    }
    case 'delete':
      return { kind: 'remove', commentId: action.commentId };
    case 'react':
      return {
        kind: 'react',
        commentId: action.commentId,
        emoji: action.emoji,
        by: action.key,
        name: who.by.name,
        on: action.on,
      };
    case 'resolve':
      return { kind: 'resolve', resolved: action.resolved, by: who.by.name };
    case 'rename': {
      const title = readThreadTitle(action.title);
      if (title === null) throw refused('title_too_long');
      return { kind: 'rename', title };
    }
    case 'addToCard': {
      const item = (rec.items ?? []).find((i) => i.id === action.itemId);
      if (!item) throw refused('item_not_found');
      return { kind: 'addCard', card: { projectId: rec.id, itemId: item.id, key: item.key } };
    }
  }
}

/** One thread action on a This Browser plan, as the api would answer it. */
export async function offlineWriteThread(
  projectId: string,
  action: ThreadAction,
  who: ThreadWriter,
): Promise<ThreadAnswer> {
  return serializeOfflineWrite(async () => {
    let answer: ThreadAnswer = { unchanged: true };
    await offlineUpdateRecord(projectId, (stored) => {
      if (!stored || stored.trashedAt !== undefined)
        throw new ApiError('thread write', 404, 'not_found');
      const rec = migratedRecord(stored);
      const threads = rec.threads ?? [];
      const now = Date.now();
      if (action.kind === 'start') {
        const item = (rec.items ?? []).find((i) => i.id === action.itemId);
        if (!item) throw refused('item_not_found');
        if (threadsOnCard(threads, projectId, item.id).length >= CARD_THREADS_MAX)
          throw refused('threads_full');
        // In one of the card's type's Comments fields, as on the api (items.md "Comments").
        if (action.field !== undefined) {
          const types = typesOf(legacyCatalogue(rec.itemTypes ?? null, true));
          if (!commentsFieldsOf(typeIn(types, item.type)).includes(action.field))
            throw refused('field_invalid');
        }
        const comment = createComment(
          action.text,
          { id: who.ownerId, name: who.by.name, color: who.by.color },
          action.mentions,
        );
        const thread = startThread({
          id: newThreadId(),
          home: projectId,
          card: { projectId, itemId: item.id, key: item.key },
          comment,
          ...storedThreadField(action.field),
          now,
        });
        answer = { thread, commentId: comment.id };
        return { ...rec, threads: [...threads, thread] };
      }
      const thread = threads.find((t) => t.id === action.threadId);
      if (!thread) throw refused('thread_not_found');
      if (action.kind === 'deleteThread') {
        // Only a thread made of this person's own comments, as on the api.
        if (!threadOnlyBy(thread, who.ownerId)) throw refused('thread_has_others');
        answer = { thread: null };
        return { ...rec, threads: threads.filter((t) => t.id !== thread.id) };
      }
      if (action.kind === 'addToCard') {
        const onCard = threadsOnCard(threads, projectId, action.itemId).length;
        if (onCard >= CARD_THREADS_MAX) throw refused('threads_full');
      }
      const result = applyThreadChange(thread, changeOf(action, who, thread, rec), now);
      if (!result.ok) {
        if (result.reason === 'unchanged') return undefined;
        throw refused(result.reason);
      }
      const next = result.thread;
      answer = {
        thread: next,
        ...(action.kind === 'reply' && next ? { commentId: next.comments.at(-1)!.id } : {}),
        ...(action.kind === 'edit' ? { commentId: action.commentId } : {}),
      };
      return {
        ...rec,
        threads: next
          ? threads.map((t) => (t.id === next.id ? next : t))
          : threads.filter((t) => t.id !== thread.id),
      };
    });
    debugLog('[threads] threads.offline.write', { kind: action.kind });
    return answer;
  });
}

/** The record's threads after an item write on it: a card deleted for good comes off its threads (a thread on it
 *  alone goes), and a card put back (an undo) goes back on the threads its create carried. */
export function threadsAfterItemWrite(
  threads: readonly CardThread[],
  write: ItemWrite,
  projectId: string,
  made: readonly Item[],
): CardThread[] {
  if (write.kind === 'delete') {
    return threads.flatMap((t) => {
      const result = applyThreadChange(
        t,
        { kind: 'removeCard', projectId, itemId: write.id },
        Date.now(),
      );
      if (!result.ok) return [t];
      return result.thread ? [result.thread] : [];
    });
  }
  if (write.kind !== 'create') return [...threads];
  let out = [...threads];
  for (const create of write.creates as readonly ItemCreate[]) {
    const item = made.find((m) => m.id === create.id);
    if (!item || !create.threads?.length) continue;
    const card = { projectId, itemId: item.id, key: item.key };
    for (const raw of create.threads as CardThread[]) {
      const held = out.find((t) => t.id === raw.id);
      if (!held) {
        out = [...out, { ...raw, home: projectId, cards: [card] }];
        continue;
      }
      const result = applyThreadChange(held, { kind: 'addCard', card }, Date.now());
      if (result.ok && result.thread) out = out.map((t) => (t.id === held.id ? result.thread! : t));
    }
  }
  return out;
}
