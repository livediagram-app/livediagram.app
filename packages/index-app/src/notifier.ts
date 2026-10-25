// The notification emails every app sends about its items, written once (docs/specs/014-identity/
// profile-and-email-notifications.md in each app): the two milestones (the tenth item, the first share link), someone
// joining a shared item, an action assigned and a mention. Each is best-effort and opt-out: the recipient's address is
// their verified one at liveworkspace accounts and their switch is read there (`recipients`), never the caller's
// headers. The numbers every app shares (milestone counts, windows, the hourly cap) are @liveworkspace/auth-client's
// notify.ts; the once-only state is accounts' (the milestones) or the item's own (notify-claims.ts).
//
// An app hands `createNotifier` how to reach its accounts, its item's claims table and its sender allowance, plus its
// own email templates (the wording names its item: a canvas, a document, a design, a plan). Nothing here throws on a
// send: the app's `send` swallows failures, so a notification problem never breaks the request that triggered it.

import {
  JOIN_NOTIFY_THROTTLE_MS,
  MILESTONE_ITEM_COUNTS,
  NOTIFY_EMAIL_DEDUPE_MS,
  NOTIFY_EMAILS_PER_SENDER_PER_HOUR,
  NOTIFY_RATE_WINDOW_MS,
  notifyClaimKey,
  reachedMilestone,
  teamTargets,
  type NotifyTarget,
  type TeamPerson,
} from '@liveworkspace/auth-client';
import { claimNotice, claimNotices, type SenderAllowance } from './notify-claims';

type ClaimsDb = Parameters<typeof claimNotices>[0];

/** An email as an app's template builds it; the notifier adds `to`. */
export type NotifierEmail = {
  subject: string;
  html: string;
  text?: string;
  unsubscribeUrl?: string;
};

/** The switches the notifier reads, by the name each app's settings use. `join` is the app's own (`notifyDocumentJoin`,
 *  `notifyPlanJoin`, ...). */
export type NotifierSettings = { join: string };

export type NotifierItem = { id: string; name: string };

export type NotifierDeps<E, M extends NotifierEmail = NotifierEmail> = {
  /** Whether this environment sends email at all. */
  enabled(env: E): boolean;
  /** Sends one email; never throws. */
  send(env: E, email: M & { to: string }): Promise<unknown>;
  /** Whether an id is an account's (`user_…`): the only kind with an address. */
  isAccount(id: string): boolean;
  /** The verified address of each of these accounts whose `setting` is on, by id (auth-client notificationRecipients). */
  recipients(env: E, ids: readonly string[], setting: string): Promise<Map<string, string>>;
  /** How many items the person has made, counted up to `upTo` (the index's count). */
  itemsMadeBy(env: E, ownerId: string, upTo: number): Promise<number | null>;
  /** Claims a once-per-account milestone at accounts; false when it was claimed before. */
  claimMilestone(env: E, ownerId: string, kind: 'milestone' | 'firstShare'): Promise<boolean>;
  /** The item's own claims table (its Durable Object's D1-shaped facade). */
  claims(env: E): ClaimsDb;
  /** The sender's hourly allowance (accountsAllowance(accountCredentials(env))). */
  allowance(env: E): SenderAllowance;
  /** A person's display name, or null. */
  nameOf(env: E, personId: string): Promise<string | null>;
  /** A team's people (joined and invited), or null when it can't be read. */
  teamPeople(env: E, teamId: string): Promise<readonly TeamPerson[] | null>;
  settings: NotifierSettings;
  emails: {
    milestone(env: E, count: number): M;
    firstShare(env: E): M;
    joined(env: E, itemName: string, joinerName: string | null): M;
    actionAssigned(
      env: E,
      assignerName: string | null,
      item: NotifierItem | null,
      actionName: string,
      description: string | null,
    ): M;
    /** `partId` is the part the comment sits on (a plan's card), for the email's button. */
    mentioned(
      env: E,
      authorName: string | null,
      item: NotifierItem,
      commentText: string,
      partId: string | null,
    ): M;
  };
};

/** A comment as the mention email reads it. */
export type NotifierComment = { id: string; text: string; mentions?: readonly NotifyTarget[] };

export type ActionAssignedInput = {
  assignee: TeamPerson;
  /** The assigner's verified account id: the claim's sender and whose hourly cap the email counts against. */
  assignerUserId: string;
  assignerName: string | null;
  item: NotifierItem;
  /** False when the assignee cannot open the item: the email then names no item and does not link into it. */
  assigneeCanOpen: boolean;
  actionName: string;
  description: string | null;
};

export type MentionsInput = {
  item: NotifierItem & { teamId: string | null };
  authorId: string;
  /** Who signs the email when the author has no profile name (their verified address). */
  authorFallbackName?: string | null;
  comments: readonly NotifierComment[];
  /** The most mentions one comment may reach (the item's MENTIONS_MAX). */
  mentionsMax: number;
  /** A part of the item the comments sit on (a plan's card), when it is not the item itself. */
  partId?: string | null;
};

export type MentionedInput = {
  /** Already checked by the caller: the item's team's people other than the author. */
  recipients: readonly TeamPerson[];
  /** The author's verified account id: the claim's sender and whose hourly cap the emails count against. */
  authorUserId: string;
  authorName: string | null;
  item: NotifierItem;
  commentText: string;
};

export type Notifier<E> = {
  notifyMilestone(env: E, ownerId: string): Promise<void>;
  notifyFirstShare(env: E, actorId: string): Promise<void>;
  notifyJoin(env: E, item: NotifierItem & { ownerId: string }, joinerId: string): Promise<void>;
  notifyActionAssigned(env: E, input: ActionAssignedInput): Promise<void>;
  notifyMentions(env: E, input: MentionsInput): Promise<void>;
  notifyMentioned(env: E, input: MentionedInput): Promise<void>;
};

export function createNotifier<E, M extends NotifierEmail = NotifierEmail>(
  deps: NotifierDeps<E, M>,
): Notifier<E> {
  const recipient = async (env: E, id: string, setting: string) =>
    (await deps.recipients(env, [id], setting)).get(id) ?? null;

  // The action-assigned and mentioned emails carry the sender's words, so each is claimed in the item before it goes:
  // the same email (sender, item, recipient, wording) once a day, and NOTIFY_EMAILS_PER_SENDER_PER_HOUR per sender at
  // most, counted across every item in the sender's own store.
  async function claimTeamNotices(
    env: E,
    senderId: string,
    emails: (string | null)[][],
  ): Promise<boolean[]> {
    const now = Date.now();
    const keys = await Promise.all(emails.map((parts) => notifyClaimKey([senderId, ...parts])));
    const allowed = await claimNotices(
      deps.claims(env),
      keys.map((key) => ({
        key,
        sender: senderId,
        now,
        dedupeSince: now - NOTIFY_EMAIL_DEDUPE_MS,
        rate: { max: NOTIFY_EMAILS_PER_SENDER_PER_HOUR, windowMs: NOTIFY_RATE_WINDOW_MS },
      })),
      deps.allowance(env),
    );
    const skipped = allowed.filter((ok) => !ok).length;
    if (skipped > 0)
      console.warn(
        `[notify-email] skipped ${skipped} ${String(emails[0]?.[0])} email(s): duplicate or sender over the hourly cap`,
      );
    return allowed;
  }

  // Where each of these team people's email goes: an account's verified address unless they turned `setting` off, an
  // invited person's invite address (no account, so no switch: on).
  async function teamAddresses(
    env: E,
    people: readonly TeamPerson[],
    setting: string,
  ): Promise<Map<string, string>> {
    const accounts = people.flatMap((p) => (p.userId ? [p.userId] : []));
    const verified =
      accounts.length > 0
        ? await deps.recipients(env, accounts, setting)
        : new Map<string, string>();
    const out = new Map<string, string>();
    for (const p of people) {
      const to = p.userId ? verified.get(p.userId) : p.email;
      if (to) out.set(p.id, to);
    }
    return out;
  }

  return {
    // The owner just made an item: when it brings them to a milestone (the tenth), celebrate it once. The count is
    // the index's, asked only up to the milestone; the claim at accounts means a burst of creates sends one email.
    async notifyMilestone(env, ownerId) {
      if (!deps.enabled(env) || !deps.isAccount(ownerId)) return;
      const reached = reachedMilestone(
        await deps.itemsMadeBy(env, ownerId, Math.max(...MILESTONE_ITEM_COUNTS)),
      );
      if (reached === null) return;
      const to = await recipient(env, ownerId, 'notifyMilestones');
      if (!to) return;
      if (!(await deps.claimMilestone(env, ownerId, 'milestone'))) return;
      await deps.send(env, { ...deps.emails.milestone(env, reached), to });
    },

    // Someone made a share link for the first time (the index's `shared` notice). The milestones' switch; claimed
    // once per account at accounts.
    async notifyFirstShare(env, actorId) {
      if (!deps.enabled(env) || !deps.isAccount(actorId)) return;
      const to = await recipient(env, actorId, 'notifyMilestones');
      if (!to) return;
      if (!(await deps.claimMilestone(env, actorId, 'firstShare'))) return;
      await deps.send(env, { ...deps.emails.firstShare(env), to });
    },

    // A signed-in person opened one of an owner's items through a share link for the first time (the index's `joined`
    // notice, run inside the item's Durable Object). Never for a guest, never for the owner; throttled per item so a
    // run of joins is one email.
    async notifyJoin(env, item, joinerId) {
      if (!deps.enabled(env) || !deps.isAccount(joinerId) || joinerId === item.ownerId) return;
      if (!deps.isAccount(item.ownerId)) return;
      const to = await recipient(env, item.ownerId, deps.settings.join);
      if (!to) return;
      const now = Date.now();
      const claimed = await claimNotice(deps.claims(env), {
        key: 'join',
        sender: item.ownerId,
        now,
        dedupeSince: now - JOIN_NOTIFY_THROTTLE_MS,
      });
      if (!claimed) return;
      const joinerName = await deps.nameOf(env, joinerId);
      await deps.send(env, { ...deps.emails.joined(env, item.name, joinerName), to });
    },

    // A teammate assigned the recipient an action on an item (after the app checked both people and the item).
    async notifyActionAssigned(env, input) {
      if (!deps.enabled(env)) return;
      const to = (await teamAddresses(env, [input.assignee], 'notifyActionAssigned')).get(
        input.assignee.id,
      );
      if (!to) return;
      const [claimed] = await claimTeamNotices(env, input.assignerUserId, [
        [
          'action',
          input.item.id,
          input.assignee.userId ?? `mail:${to}`,
          input.actionName,
          input.description,
        ],
      ]);
      if (!claimed) return;
      const email = deps.emails.actionAssigned(
        env,
        input.assignerName,
        input.assigneeCanOpen ? input.item : null,
        input.actionName,
        input.description,
      );
      await deps.send(env, { ...email, to });
    },

    // The author's new comments on a team item @-mentioned teammates: each person mentioned gets one email per
    // comment. A mention only ever reaches the item's own team, and only from one of its joined members; anyone else a
    // comment names is skipped. One team read, one recipients read and one claim batch, whatever the number of
    // comments and mentions.
    async notifyMentions(env, input) {
      const { item, authorId } = input;
      if (!deps.enabled(env) || !item.teamId || !deps.isAccount(authorId)) return;
      const mentioning = input.comments.filter((c) => (c.mentions?.length ?? 0) > 0);
      if (mentioning.length === 0) return;
      const people = await deps.teamPeople(env, item.teamId);
      if (!people?.some((p) => p.userId === authorId && p.status === 'joined')) return;
      const sends = mentioning.map((c) => ({
        comment: c,
        to: teamTargets(people, c.mentions!.slice(0, input.mentionsMax), authorId),
      }));
      const everyone = new Map(sends.flatMap((s) => s.to).map((p) => [p.id, p]));
      if (everyone.size === 0) return;
      const [addresses, name] = await Promise.all([
        teamAddresses(env, [...everyone.values()], 'notifyMentions'),
        deps.nameOf(env, authorId),
      ]);
      const authorName = name ?? input.authorFallbackName ?? null;
      const pending: { to: string; comment: NotifierComment; parts: (string | null)[] }[] = [];
      for (const { comment, to: recipients } of sends) {
        for (const person of recipients) {
          const to = addresses.get(person.id);
          if (!to) continue;
          pending.push({
            to,
            comment,
            parts: [
              'mention',
              item.id,
              input.partId ?? null,
              person.userId ?? `mail:${to}`,
              `comment:${comment.id}`,
            ],
          });
        }
      }
      if (pending.length === 0) return;
      const allowed = await claimTeamNotices(
        env,
        authorId,
        pending.map((p) => p.parts),
      );
      await Promise.all(
        pending
          .filter((_, i) => allowed[i])
          .map(({ to, comment }) =>
            deps.send(env, {
              ...deps.emails.mentioned(env, authorName, item, comment.text, input.partId ?? null),
              to,
            }),
          ),
      );
    },

    // A comment @-mentioned these people, already checked by the caller (the item is the team's, the author one of
    // its joined people, each recipient one of its people other than the author): each gets one email for it.
    async notifyMentioned(env, input) {
      if (!deps.enabled(env) || input.recipients.length === 0) return;
      const addresses = await teamAddresses(env, input.recipients, 'notifyMentions');
      const pending = input.recipients.flatMap((person) => {
        const to = addresses.get(person.id);
        return to
          ? [
              {
                to,
                parts: [
                  'mention',
                  input.item.id,
                  null,
                  person.userId ?? `mail:${to}`,
                  input.commentText,
                ],
              },
            ]
          : [];
      });
      if (pending.length === 0) return;
      const allowed = await claimTeamNotices(
        env,
        input.authorUserId,
        pending.map((p) => p.parts),
      );
      const email = deps.emails.mentioned(
        env,
        input.authorName,
        input.item,
        input.commentText,
        null,
      );
      await Promise.all(
        pending.filter((_, i) => allowed[i]).map(({ to }) => deps.send(env, { ...email, to })),
      );
    },
  };
}
