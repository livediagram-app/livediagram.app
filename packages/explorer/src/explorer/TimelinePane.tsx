'use client';

// The Timeline view (livediagram's /explorer/timeline over GET /timeline): what happened to the items the person
// can reach, and their teams' items, newest first, a page at a time. The pane header's This app / All filter
// chooses whose events: this app's alone, or every app's, each card then wearing its app's mark and opening in its
// own app. The cards, stacks and calendar are the timeline module's; this file says what each event means here,
// and what a card's ⋯ menu does: the item's own menu plus Remove from Timeline, which takes the card off this
// reader's feed alone (a stack's menu removes its whole run). A link to `#event=<id>` rings that card.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
} from 'react';
import {
  TIMELINE_DISMISS_MAX,
  isApp,
  type Item,
  type TimelineEvent,
} from '@liveworkspace/index-client';
import { RENAME_INPUT } from '../ui/classes';
import { DismissIcon } from '../ui/icons';
import { InlineRenameInput } from '../ui/InlineRenameInput';
import { MenuActionRow, MenuHeader, PortalMenu } from '../ui/Menu';
import { EllipsisTriggerButton } from '../ui/RowMenu';
import { eventIcon } from '../timeline/icons';
import {
  eventLabel,
  stackLabel,
  type TimelineCardRender,
  type TimelineCardSlots,
  type TimelineRenderer,
  type TimelineStack,
} from '../timeline/model';
import { Timeline } from '../timeline/Timeline';
import { TimelineControls } from '../timeline/TimelineControls';
import { useTimelineControls } from '../timeline/useTimelineControls';
import { useTimelineFeed } from '../timeline/useTimelineFeed';
import { VIEW_TITLES } from '../views';
import { AppMark } from './badges';
import { useExplorer, type ExplorerContextValue } from './context';
import { EmptyPane } from './EmptyPane';
import { ItemMenu } from './menus';
import { PaneHeader } from './PaneHeader';
import { useNamedEvents } from '../data/names';

// A link to one event looks this many pages back for it before giving up: a bounded walk, never the whole history.
export const FOCUS_PAGES_MAX = 5;

/** The event a link named: `#event=<id>` on the Timeline's address. */
export function focusEventFromHash(hash: string): string | null {
  const match = /^#event=(.+)$/.exec(hash);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]!);
  } catch {
    return null;
  }
}

/** Remove from Timeline in calls the index takes: a long stack goes in bounded batches. */
export function dismissBatches(ids: readonly string[]): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += TIMELINE_DISMISS_MAX) {
    batches.push(ids.slice(i, i + TIMELINE_DISMISS_MAX));
  }
  return batches;
}

type OpenMenu = {
  // The card's event id, or the stack's key.
  key: string;
  anchor: HTMLElement;
  eventIds: string[];
  // The card's item; null for a stack, whose menu only removes its run, and for an event about no item.
  item: Item | null;
  stack: boolean;
  title: string;
};

const LEVEL_WORDS: Record<string, string> = {
  view: 'Anyone with the link can view',
  participate: 'Anyone with the link can take part',
  edit: 'Anyone with the link can edit',
};

/** Who did it, as the reader should hear it. The index keeps no names: an app's report may carry one. */
export function actorWords(event: TimelineEvent, viewerId: string | null): string {
  if (event.actorId && viewerId && event.actorId === viewerId) return 'you';
  if (event.actorName) return event.actorName;
  if (event.actorId === 'deleted') return 'a closed account';
  return 'a teammate';
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** An account page beside Manage Teams' (`/account/teams` → `/account/tokens`), for a token's card. */
export function accountPageUrl(manageTeamsUrl: string | undefined, page: 'teams' | 'tokens') {
  if (!manageTeamsUrl) return undefined;
  return page === 'teams' ? manageTeamsUrl : manageTeamsUrl.replace(/\/teams\/?$/, `/${page}`);
}

const leave = (url: string | undefined) => (url ? () => window.location.assign(url) : undefined);

/** What an event about no item says: a team's, an API token's, images uploaded, an item taken offline. */
function renderLooseEvent(
  event: TimelineEvent,
  ctx: Pick<ExplorerContextValue, 'viewerId' | 'filter' | 'navigate' | 'manageTeamsUrl'> & {
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
      // To the person invited: answered where invitations are, on liveworkspace.app.
      if (mine(detail.personId)) {
        return {
          ...base,
          label: 'Invited to a Team',
          meta: `From ${who}`,
          onClick: opened(leave(ctx.manageTeamsUrl)),
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
      return { ...base, onClick: opened(leave(accountPageUrl(ctx.manageTeamsUrl, 'tokens'))) };
    case 'token_expiring':
      return {
        ...base,
        meta: 'Rotate it before it lapses to keep connected tools working',
        onClick: opened(leave(accountPageUrl(ctx.manageTeamsUrl, 'tokens'))),
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
    manageTeamsUrl?: string;
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
      meta = detail.from ? `Was “${detail.from}” · ${by}` : by;
      break;
    case 'moved': {
      const place = detail.folderName ?? (detail.teamId ? ctx.teamName(detail.teamId) : 'My Work');
      meta = `To ${place} · ${by}`;
      break;
    }
    case 'shared':
      meta = `${LEVEL_WORDS[detail.level ?? ''] ?? 'Shared by link'} · ${by}`;
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

export function TimelinePane({ onOpenNav }: { onOpenNav?: () => void }) {
  const explorer = useExplorer();
  const {
    client,
    app,
    filter,
    epoch,
    viewerId,
    words,
    onCreate,
    onTimeline,
    overlay,
    inbox,
    toast,
    actions,
    renamingId,
    setRenamingId,
  } = explorer;
  const feed = useTimelineFeed(client, app, filter, epoch, inbox.clearTimelineNew);
  // Renames, favourites and deletes made anywhere show on the cards at once.
  const overlayVersion = useSyncExternalStore(overlay.subscribe, overlay.version, overlay.version);
  // An item purged or dismissed since the page loaded takes its events with it.
  // Who did it, by name: the index keeps ids only.
  const named = useNamedEvents(feed.events);
  const events = useMemo(
    () => named.filter((e) => !e.item || !overlay.apply(e.item).gone),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- overlayVersion is what changes overlay.apply
    [named, overlay, overlayVersion],
  );
  const controls = useTimelineControls(events, {
    viewerId,
    onModeChange: useCallback(
      (mode: string) => onTimeline?.('Changed', mode === 'calendar' ? 'Calendar' : 'List'),
      [onTimeline],
    ),
    // A fixed token from a closed set, never anything a person wrote.
    onCategoryToggle: useCallback(
      (category: string, on: boolean) => {
        if (!on) onTimeline?.('Selected', category);
      },
      [onTimeline],
    ),
    onActorFilterChange: useCallback(
      (who: string) => onTimeline?.('Selected', who === 'others' ? 'Others' : 'Everyone'),
      [onTimeline],
    ),
  });
  const { renderThumbnail, openItem, navigate, teamName, manageTeamsUrl } = explorer;
  const render: TimelineRenderer = useMemo(() => {
    const ctx = {
      viewerId,
      filter,
      renderThumbnail,
      openItem,
      navigate,
      teamName,
      manageTeamsUrl,
      onOpen: () => onTimeline?.('Opened', 'Card'),
    };
    return (event) =>
      renderTimelineEvent({ ...event, item: event.item ? overlay.apply(event.item) : null }, ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- overlayVersion is what changes overlay.apply
  }, [
    viewerId,
    filter,
    renderThumbnail,
    openItem,
    navigate,
    teamName,
    manageTeamsUrl,
    onTimeline,
    overlay,
    overlayVersion,
  ]);

  // ---- The ⋯ menus: one at a time, drawn once here rather than one per card.
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  // The card whose menu started a rename: the same item may have several cards, and only that one edits.
  const [renameFrom, setRenameFrom] = useState<string | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const openMenu = useCallback(
    (next: Omit<OpenMenu, 'anchor'>, anchor: HTMLElement | null) => {
      if (!anchor) return;
      setMenu((open) => {
        if (open?.key === next.key) return null;
        onTimeline?.('Opened', 'Menu');
        return { ...next, anchor };
      });
      if (next.item) setRenameFrom(next.key);
    },
    [onTimeline],
  );
  const trigger = (e: MouseEvent) =>
    (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[aria-haspopup="menu"]');

  const remove = useCallback(
    (ids: string[], what: 'Entry' | 'Stack') => {
      onTimeline?.('Removed', what);
      const undo = feed.hide(ids);
      Promise.all(dismissBatches(ids).map((batch) => client.dismissTimelineEvents(batch))).catch(
        () => {
          undo();
          toast.error('Couldn\u2019t remove that from your Timeline. Try again.');
        },
      );
    },
    [client, feed, onTimeline, toast],
  );

  const cardSlots = useCallback(
    (event: TimelineEvent): TimelineCardSlots => {
      const item = event.item ? overlay.apply(event.item) : null;
      const title = item?.title || event.title || 'Untitled';
      // An event about no item has only Remove from Timeline.
      const target = { key: event.id, eventIds: [event.id], item: event.item, title, stack: false };
      if (item && renamingId === item.id && renameFrom === event.id) {
        return {
          title: (
            <InlineRenameInput
              initial={item.title}
              ariaLabel={`Rename ${title}`}
              onCommit={(next) => {
                setRenamingId(null);
                void actions.rename(item, next);
              }}
              onCancel={() => setRenamingId(null)}
              className={`w-full min-w-0 ${RENAME_INPUT}`}
            />
          ),
        };
      }
      return {
        menu: (
          <EllipsisTriggerButton
            label={`Menu for ${title}`}
            size="md"
            reveal
            expanded={menu?.key === event.id}
            onClick={(e) => openMenu(target, e.currentTarget)}
          />
        ),
        onContextMenu: (e) => {
          e.preventDefault();
          openMenu(target, trigger(e));
        },
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- overlayVersion is what changes overlay.apply
    [overlay, overlayVersion, renamingId, renameFrom, menu?.key, openMenu, setRenamingId, actions],
  );

  const stackSlots = useCallback(
    (stack: TimelineStack): TimelineCardSlots => {
      const target = {
        key: stack.key,
        eventIds: stack.events.map((e) => e.id),
        item: null,
        stack: true,
        title: stackLabel(stack),
      };
      return {
        menu: (
          <EllipsisTriggerButton
            label={`Menu for ${target.title}`}
            size="md"
            reveal
            expanded={menu?.key === stack.key}
            onClick={(e) => openMenu(target, e.currentTarget)}
          />
        ),
        onContextMenu: (e) => {
          e.preventDefault();
          openMenu(target, trigger(e));
        },
      };
    },
    [menu?.key, openMenu],
  );

  // ---- A link to one event: look a few pages back for it, then ring it.
  const [focusEventId] = useState(() =>
    typeof window === 'undefined' ? null : focusEventFromHash(window.location.hash),
  );
  const focusPages = useRef(0);
  const focusFound = focusEventId ? events.some((e) => e.id === focusEventId) : true;
  useEffect(() => {
    if (focusFound || feed.loading || feed.loadingMore || !feed.hasMore) return;
    if (focusPages.current >= FOCUS_PAGES_MAX) return;
    focusPages.current += 1;
    feed.loadMore();
  }, [focusFound, feed]);

  const removeRow = menu ? (
    <MenuActionRow
      label="Remove from Timeline"
      icon={<DismissIcon />}
      onClick={() => {
        const ids = menu.eventIds;
        closeMenu();
        remove(ids, menu.stack ? 'Stack' : 'Entry');
      }}
    />
  ) : null;

  return (
    <div data-explorer-view="timeline">
      <PaneHeader
        title={VIEW_TITLES.timeline}
        onOpenNav={onOpenNav}
        actions={<TimelineControls controls={controls} />}
      />
      <Timeline
        controls={controls}
        viewerId={viewerId}
        render={render}
        loading={feed.loading}
        isEmpty={!feed.loading && events.length === 0}
        emptyState={
          <EmptyPane
            view={{ kind: 'timeline' }}
            words={words}
            onCreate={() => onCreate({ folderId: null, teamId: null })}
            createLabel={`New ${explorer.kind.one}`}
          />
        }
        error={feed.error}
        onRetry={() => {
          onTimeline?.('Loaded', 'Retry');
          feed.retry();
        }}
        hasMore={feed.hasMore}
        loadingMore={feed.loadingMore}
        onLoadMore={() => {
          onTimeline?.('Loaded', 'More');
          feed.loadMore();
        }}
        onStackExpand={() => onTimeline?.('Opened', 'Stack')}
        lastSeenAt={feed.lastSeenAt}
        cardSlots={cardSlots}
        stackSlots={stackSlots}
        focusEventId={focusEventId}
      />
      {menu?.item ? (
        <ItemMenu
          item={overlay.apply(menu.item)}
          anchor={menu.anchor}
          onClose={closeMenu}
          extra={removeRow}
        />
      ) : menu ? (
        <PortalMenu anchor={menu.anchor} onClose={closeMenu} label={`Actions for ${menu.title}`}>
          <MenuHeader title={menu.title} />
          {removeRow}
        </PortalMenu>
      ) : null}
    </div>
  );
}
