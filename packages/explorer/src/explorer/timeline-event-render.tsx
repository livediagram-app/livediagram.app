// What a Timeline event says on its card: the words, icon, badge and press of each event, for the Timeline view, a
// Team's activity and an item's history. Kept apart from TimelinePane.tsx so they read it without the whole Timeline
// view, which loads when it is shown (liveworkspace/docs/specs/004-index/one-explorer.md "Cost and performance").

import { isApp, type TimelineEvent } from '@liveworkspace/index-client';
import { DAY_MONTH } from '@liveworkspace/ui/date-format';
import { SHARE_LEVEL_WORDS } from '../timeline/share-levels';
import { eventIcon } from '../timeline/icons';
import { eventLabel, type TimelineCardRender } from '../timeline/model';
import { AppMark } from './badges';
import type { ExplorerContextValue } from './context';
import { quoted } from '../quoted';

/** Who did it, as the reader should hear it. The index keeps no names: an app's report may carry one. */
export function actorWords(event: TimelineEvent, viewerId: string | null): string {
  if (event.actorId && viewerId && event.actorId === viewerId) return 'you';
  if (event.actorName) return event.actorName;
  if (event.actorId === 'deleted') return 'a closed account';
  return 'a teammate';
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const leave = (url: string | undefined) => (url ? () => window.location.assign(url) : undefined);

/** What an event about no item says: a team's, an API token's, images uploaded, an item taken offline. */
function renderLooseEvent(
  event: TimelineEvent,
  ctx: Pick<ExplorerContextValue, 'viewerId' | 'filter' | 'navigate' | 'tokensUrl'> & {
    onOpen?: (event: TimelineEvent) => void;
  },
): TimelineCardRender {
  const detail = event.detail ?? {};
  const mine = (id: string | null | undefined) =>
    Boolean(id && ctx.viewerId && id === ctx.viewerId);
  const who = actorWords(event, ctx.viewerId);
  const by = `by ${who}`;
  const member = mine(detail.personId) ? 'you' : (detail.memberName ?? 'a member');
  const opened = (run: (() => void) | undefined) =>
    run
      ? () => {
          ctx.onOpen?.(event);
          run();
        }
      : undefined;
  const team = detail.teamId ? () => ctx.navigate({ kind: 'team', id: detail.teamId! }) : undefined;
  const base: TimelineCardRender = {
    icon: eventIcon(event.type),
    subject: event.title,
    label: eventLabel(event),
    meta: by,
    badge:
      ctx.filter === 'all' && isApp(event.app) ? <AppMark app={event.app} size={18} /> : undefined,
  };
  switch (event.type) {
    case 'image_uploaded': {
      const count = Number(detail.count ?? '1') || 1;
      return { ...base, subject: count === 1 ? '1 image' : `${count} images`, meta: undefined };
    }
    case 'taken_offline':
      return {
        ...base,
        subject: event.title || 'Untitled',
        meta: `Kept only in one browser · ${by}`,
      };
    case 'team_invite_sent':
      // To the person invited: answered in the Explorer's Invites.
      if (mine(detail.personId)) {
        return {
          ...base,
          label: 'Invited to a Team',
          meta: `From ${who}`,
          onClick: opened(() => ctx.navigate({ kind: 'invites' })),
        };
      }
      return {
        ...base,
        meta: `${cap(detail.memberName ?? 'someone')} · ${by}`,
        onClick: opened(team),
      };
    case 'team_joined':
      return mine(event.actorId)
        ? { ...base, label: 'Joined a Team', meta: undefined, onClick: opened(team) }
        : { ...base, meta: cap(who), onClick: opened(team) };
    case 'team_declined':
      return { ...base, meta: cap(who), onClick: opened(team) };
    case 'team_role_changed':
      return {
        ...base,
        meta: `${cap(member)} ${member === 'you' ? 'are' : 'is'} now ${detail.role === 'admin' ? 'an Admin' : 'a Member'} · ${by}`,
        onClick: opened(team),
      };
    case 'team_member_removed':
      if (detail.left) return { ...base, meta: cap(who) };
      return mine(detail.personId)
        ? { ...base, label: 'Removed from a Team', meta: cap(by) }
        : { ...base, meta: `${cap(member)} · ${by}`, onClick: opened(team) };
    case 'team_renamed':
      return {
        ...base,
        meta: detail.from ? `Was \u201c${detail.from}\u201d · ${by}` : by,
        onClick: opened(team),
      };
    case 'team_deleted':
      return base;
    case 'token_created':
    case 'token_revoked':
      return { ...base, onClick: opened(leave(ctx.tokensUrl)) };
    case 'token_expiring':
      return {
        ...base,
        meta: 'Rotate it before it lapses to keep connected tools working',
        onClick: opened(leave(ctx.tokensUrl)),
      };
    default:
      return base;
  }
}

/** What an event says on its card: the item as it is now, why it is here, and its detail. */
export function renderTimelineEvent(
  event: TimelineEvent,
  ctx: Pick<
    ExplorerContextValue,
    'viewerId' | 'filter' | 'renderThumbnail' | 'openItem' | 'navigate' | 'teamName'
  > & {
    tokensUrl?: string;
    onOpen?: (event: TimelineEvent) => void;
  },
): TimelineCardRender {
  const item = event.item;
  if (!item) return renderLooseEvent(event, ctx);
  const by = `by ${actorWords(event, ctx.viewerId)}`;
  const detail = event.detail ?? {};
  let meta: string | undefined = by;
  // Free text under the reason line: a comment's words, an action's name.
  let description: string | undefined;
  switch (event.type) {
    case 'renamed':
      meta = detail.from ? `Was ${quoted(detail.from)} · ${by}` : by;
      break;
    case 'moved': {
      const place = detail.folderName ?? (detail.teamId ? ctx.teamName(detail.teamId) : 'My Work');
      meta = `To ${place} · ${by}`;
      break;
    }
    case 'shared':
      meta = `${SHARE_LEVEL_WORDS[detail.level ?? ''] ?? 'Shared by link'} · ${by}`;
      break;
    case 'favourited':
      meta = undefined;
      break;
    case 'commented': {
      const count = Number(detail.count ?? '1') || 1;
      description = detail.text ?? undefined;
      meta = count > 1 ? `${count} comments · ${by}` : by;
      break;
    }
    case 'comment_resolved':
      description = detail.text ?? undefined;
      break;
    case 'action_assigned': {
      description = detail.action ?? undefined;
      const to =
        detail.assigneeId && detail.assigneeId === ctx.viewerId
          ? 'you'
          : (detail.assigneeName ?? 'a teammate');
      meta = `To ${to} · ${by}`;
      break;
    }
    case 'action_done':
      description = detail.action ?? undefined;
      break;
    // Someone who came in by a share link: named when they have an account, else a visitor.
    case 'opened_by_visitor':
    case 'copied_by_visitor':
      meta = `by ${event.actorName ?? 'a visitor'}`;
      break;
    case 'share_link_expiring': {
      const links = Number(detail.links ?? '1') || 1;
      const when = Number(detail.expiresAt ?? event.occurredAt) || event.occurredAt;
      const date = DAY_MONTH.format(when);
      meta = `${links > 1 ? `${links} share links stop` : 'A share link stops'} working on ${date} · Extend it in Share`;
      break;
    }
  }
  // An item in the Trash opens the Trash, where it can be restored; anything else opens in its own app.
  const open = item.trashedAt
    ? () => {
        ctx.onOpen?.(event);
        ctx.navigate({ kind: 'trash' });
      }
    : () => {
        ctx.onOpen?.(event);
        ctx.openItem(item);
      };
  return {
    icon: eventIcon(event.type, detail.source),
    subject: item.title || event.title || 'Untitled',
    label: eventLabel(event),
    description,
    meta,
    preview: item.trashedAt ? undefined : (ctx.renderThumbnail?.(item, 'card') ?? undefined),
    badge: ctx.filter === 'all' ? <AppMark app={item.app} size={18} /> : undefined,
    onClick: open,
  };
}
