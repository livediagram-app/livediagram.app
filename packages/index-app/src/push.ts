// When an app sends a phone notification, written once for every app (liveworkspace/docs/specs/003-accounts/push.md
// "When an app notifies"; each app's docs/specs/014-identity/phone-notifications.md). The app decides who hears of
// what; accounts keeps the devices and the switches and sends (@liveworkspace/auth-client sendPush). Every rule the
// apps share is here:
//
//   - Only accounts, never the person who did it, never an API token's or a link visitor's doing.
//   - Never someone who can't read the item: its owner, its team's joined people and anyone the index grants it.
//   - Never someone already looking at it: their session is in the item's room (`ROOM_PEOPLE` on the room's env).
//   - One notification a person per event, the strongest kind first: a mention, then a reply in a thread they
//     commented in, then a comment on what they own.
//   - A short title and the link only: never the comment's words.
//
// Each runs off the request's path (the caller's waitUntil) and never throws into it.

import {
  teamTargets,
  type NotifyTarget,
  type PushKind,
  type PushNotification,
  type TeamPerson,
} from '@liveworkspace/auth-client';

/** What a room's env carries when the request runs inside the item's room: the person tags of the sessions that
 *  have said hello, sha256(`<itemId>:<personId>`) as each app's personTagFor makes them. */
export type RoomPeople = { ROOM_PEOPLE?: () => ReadonlySet<string> };

export type PushItem = { id: string; name: string; ownerId: string; teamId: string | null };

export type PusherDeps<E> = {
  /** Hands the notifications to accounts; never throws (logs). */
  send(env: E, notifications: PushNotification[]): Promise<void>;
  /** Whether an id is an account's (`user_…`). */
  isAccount(id: string): boolean;
  /** A team's people (joined and invited), or null when it can't be read. */
  teamPeople(env: E, teamId: string): Promise<readonly TeamPerson[] | null>;
  /** Whether the index grants this person the item with no team in hand (a share link they opened before). */
  indexGrants(env: E, itemId: string, personId: string): Promise<boolean>;
};

export type CommentPush = {
  item: PushItem;
  authorId: string;
  authorName: string | null;
  /** Whoever wrote earlier in the comment's thread: their replies. Empty for a new thread. */
  threadAuthorIds: readonly string[];
  /** The comment's @-mentions, as the comment holds them. */
  mentions?: readonly NotifyTarget[];
  /** The most mentions one comment may reach (the app's MENTIONS_MAX). */
  mentionsMax: number;
  /** Where a tap opens: the item, at the comment's thread. */
  url: string;
  /** Replaces the thread's earlier notification on the device. */
  tag: string;
};

export type ActionPush = {
  item: PushItem;
  assignerId: string;
  assignerName: string | null;
  assigneeUserId: string | null;
  url: string;
  tag: string;
};

export type Pusher<E> = {
  pushComment(env: E, input: CommentPush): Promise<void>;
  pushActionAssigned(env: E, input: ActionPush): Promise<void>;
};

const SOMEONE = 'Someone';
// The most people one event reaches: a thread of fifty writers is past any real one, and it bounds the index asks.
export const PUSH_RECIPIENTS_MAX = 50;

const TITLES: Record<PushKind, (who: string, item: string) => string> = {
  mention: (who, item) => `${who} mentioned you in ${item}`,
  threadReply: (who, item) => `${who} replied in ${item}`,
  comment: (who, item) => `${who} commented on ${item}`,
  action: (who, item) => `${who} assigned you an action in ${item}`,
};

/** A notification's title: who and the item's name, nothing they wrote. */
export function pushTitle(kind: PushKind, who: string | null, itemName: string): string {
  return TITLES[kind](who?.trim() || SOMEONE, itemName.trim() || 'Untitled');
}

/** sha256(`<itemId>:<personId>`), lower-case hex: the room's person tag (each app's personTagFor). */
export async function roomPersonTag(itemId: string, personId: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${itemId}:${personId}`)),
  );
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createPusher<E>(deps: PusherDeps<E>): Pusher<E> {
  // Who of these may read the item: the owner, its team's joined people, and anyone the index grants it. One team read
  // and one index ask a person outside the team, whatever the count.
  async function readers(
    env: E,
    item: PushItem,
    ids: readonly string[],
    team: readonly TeamPerson[] | null,
  ) {
    const joined = new Set(
      team?.filter((p) => p.status === 'joined' && p.userId).map((p) => p.userId!),
    );
    const checks = await Promise.all(
      ids.map(async (id) =>
        id === item.ownerId || joined.has(id)
          ? true
          : deps.indexGrants(env, item.id, id).catch(() => false),
      ),
    );
    return ids.filter((_, i) => checks[i]);
  }

  // Of these, those not looking at the item right now.
  async function away(env: E, itemId: string, ids: readonly string[]): Promise<string[]> {
    const present = (env as RoomPeople).ROOM_PEOPLE?.();
    if (!present || present.size === 0) return [...ids];
    const tags = await Promise.all(ids.map((id) => roomPersonTag(itemId, id)));
    return ids.filter((_, i) => !present.has(tags[i]!));
  }

  async function deliver(
    env: E,
    item: PushItem,
    picked: Map<string, PushKind>,
    team: readonly TeamPerson[] | null,
    who: string | null,
    url: string,
    tag: string,
  ): Promise<void> {
    if (picked.size === 0) return;
    const allowed = await readers(
      env,
      item,
      [...picked.keys()].slice(0, PUSH_RECIPIENTS_MAX),
      team,
    );
    const reach = await away(env, item.id, allowed);
    if (reach.length === 0) return;
    await deps.send(
      env,
      reach.map((userId) => {
        const kind = picked.get(userId)!;
        return { userId, kind, title: pushTitle(kind, who, item.name), url, tag };
      }),
    );
  }

  return {
    // A person posted a comment (a new thread or a reply): who they mentioned on a team item (when they are one of its
    // joined people, as for the mention email), who wrote earlier in the thread, and the item's owner.
    async pushComment(env, input) {
      try {
        const { item, authorId } = input;
        if (!deps.isAccount(authorId)) return;
        const picked = new Map<string, PushKind>();
        const pick = (id: string | null | undefined, kind: PushKind) => {
          if (id && id !== authorId && deps.isAccount(id) && !picked.has(id)) picked.set(id, kind);
        };
        const team = item.teamId ? await deps.teamPeople(env, item.teamId) : null;
        if (
          team &&
          input.mentions?.length &&
          team.some((p) => p.userId === authorId && p.status === 'joined')
        )
          for (const person of teamTargets(
            team,
            input.mentions.slice(0, input.mentionsMax),
            authorId,
          ))
            pick(person.userId, 'mention');
        for (const id of input.threadAuthorIds) pick(id, 'threadReply');
        pick(item.ownerId, 'comment');
        await deliver(env, item, picked, team, input.authorName, input.url, input.tag);
      } catch (error) {
        console.warn('[push] comment_failed', { error: String(error) });
      }
    },

    // A teammate assigned someone an action (after the app checked both people and the item).
    async pushActionAssigned(env, input) {
      try {
        const { item } = input;
        if (!deps.isAccount(input.assignerId)) return;
        const picked = new Map<string, PushKind>();
        const id = input.assigneeUserId;
        if (id && id !== input.assignerId && deps.isAccount(id)) picked.set(id, 'action');
        if (picked.size === 0) return;
        const team = item.teamId ? await deps.teamPeople(env, item.teamId) : null;
        await deliver(env, item, picked, team, input.assignerName, input.url, input.tag);
      } catch (error) {
        console.warn('[push] action_failed', { error: String(error) });
      }
    },
  };
}
