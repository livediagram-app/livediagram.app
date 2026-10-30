// An item's cards in the Inbox (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item pushes"): the open cards
// assigned to someone, and each of a card's comment threads, pushed under COLLAB_CARDS_TAB
// (`PUT /app/items/:id/collab/~cards`) by the item's outbox drain, so the Inbox lists them however the card was
// changed (the editor, an agent, a form response).
//
// A card names the people it tells (its assignee, and any other field that notifies) and its last writer by a
// one-way hash of their person id, so anyone may hold a card without learning anyone's id. The index needs the id.
// The item matches each hash against the people it knows: whoever its app passes in (its owner, its team, the
// editors it has seen) and everyone who commented on or was mentioned in a card. A person who is none of them is
// left out of the push and counted in `unmatched`; the next push after that person comments, edits or joins the
// team lists the card for them.

import {
  COLLAB_MAX_ACTIONS,
  COLLAB_MAX_THREADS,
  type CollabActionInput,
  type CollabCard,
  type CollabPush,
  type CollabThreadInput,
} from '@liveworkspace/index-client';

export type InboxCardComment = {
  // The server-stamped author, when the comment has one.
  authorId?: string | null;
  authorName: string;
  authorColor: string;
  text: string;
  createdAt: number;
  // Person ids @-mentioned in it.
  mentionIds?: readonly string[];
};

export type InboxCardSource = {
  id: string;
  // What its rows show: number, type, title, and the board that shows it.
  card: CollabCard;
  teamId: string | null;
  createdAt: number;
  updatedAt: number;
  // The people it tells, as hashes, one action each: set only while it is open and listed (not done, not shown
  // elsewhere), empty otherwise.
  assignees: readonly InboxCardAssignee[];
  // Who last changed it, as a hash: the row's assigner.
  changedBy: { hash: string; name: string | null } | null;
  // Its comment threads, each its own Inbox row (elementId the thread's id, elementLabel its title). A thread on
  // several of the item's cards is listed once, on the first card that names it.
  threads: readonly InboxCardThread[];
};

// One person a card tells: their hash, their name, and the action's id (the card's id for its assignee, `{card
// id}~{field id}` for another field, so each person's row keeps its own id however the others change).
export type InboxCardAssignee = { hash: string; name: string | null; actionId: string };

export type InboxCardThread = {
  id: string;
  title: string;
  resolved: boolean;
  comments: readonly InboxCardComment[];
};

export type CardsPushOptions = {
  // Person ids the item knows (owner, team, editors seen). Commenters and those mentioned are added.
  people: Iterable<string>;
  // The app's one-way hash of a person id, as its cards carry it.
  hashOf: (personId: string) => Promise<string>;
  // Who a row names as assigner when the card's last writer is no one known (the item's owner).
  fallbackAssignerId: string;
};

export type CardsPush = { push: CollabPush; unmatched: number; people: number };

/** The cards push for the Inbox: one action per known person an open card tells, and one thread per comment
 *  thread (on the first card naming it), newest first and capped as the index caps one push. */
export async function cardsCollabPush(
  cards: readonly InboxCardSource[],
  opts: CardsPushOptions,
): Promise<CardsPush> {
  const people = new Set(opts.people);
  const threads: CollabThreadInput[] = [];
  const pushed = new Set<string>();
  for (const c of cards) {
    for (const thread of c.threads) {
      const comments = thread.comments;
      if (comments.length === 0 || pushed.has(thread.id)) continue;
      pushed.add(thread.id);
      let first = comments[0]!;
      let latest = comments[0]!;
      const participants: string[] = [];
      const mentioned: string[] = [];
      for (const m of comments) {
        if (m.createdAt < first.createdAt) first = m;
        if (m.createdAt >= latest.createdAt) latest = m;
        if (m.authorId && !participants.includes(m.authorId)) participants.push(m.authorId);
        for (const id of m.mentionIds ?? []) if (!mentioned.includes(id)) mentioned.push(id);
      }
      for (const id of [...participants, ...mentioned]) people.add(id);
      threads.push({
        elementId: thread.id,
        elementLabel: thread.title,
        resolved: thread.resolved,
        commentCount: comments.length,
        participantIds: participants,
        mentionedIds: mentioned,
        latestText: latest.text,
        latestAuthorName: latest.authorName,
        latestAuthorColor: latest.authorColor,
        firstAt: first.createdAt,
        latestAt: latest.createdAt,
        card: { ...c.card, id: c.id },
      });
    }
  }

  // Each known person's hash, once.
  const byHash = new Map<string, string>();
  await Promise.all(
    [...people].map(async (id) => {
      byHash.set(await opts.hashOf(id), id);
    }),
  );
  const actions: CollabActionInput[] = [];
  let unmatched = 0;
  for (const c of cards) {
    // A person two of the card's fields name is told once, by the first.
    const told = new Set<string>();
    for (const assignee of c.assignees) {
      const assigneeId = byHash.get(assignee.hash);
      if (!assigneeId) {
        unmatched++;
        continue;
      }
      if (told.has(assigneeId)) continue;
      told.add(assigneeId);
      actions.push({
        elementId: c.id,
        actionId: assignee.actionId,
        elementLabel: c.card.title,
        name: c.card.title,
        description: '',
        status: 'open',
        assigneeId,
        assigneeName: assignee.name,
        assignerId: (c.changedBy && byHash.get(c.changedBy.hash)) || opts.fallbackAssignerId,
        assignerName: c.changedBy?.name ?? null,
        teamId: c.teamId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        card: c.card,
      });
    }
  }
  return {
    push: {
      threads: threads.sort((a, b) => b.latestAt - a.latestAt).slice(0, COLLAB_MAX_THREADS),
      actions: actions.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, COLLAB_MAX_ACTIONS),
    },
    unmatched,
    people: people.size,
  };
}
