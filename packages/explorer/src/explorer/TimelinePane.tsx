'use client';

// The Timeline view (livediagram's /explorer/timeline over GET /timeline): what happened to the items the person
// can reach, and their teams' items, newest first, a page at a time. The pane header's This app / All filter
// chooses whose events: this app's alone, or every app's, each card then wearing its app's mark and opening in its
// own app. The cards, stacks and calendar are the timeline module's; this file says what each event means here.

import { useCallback, useMemo } from 'react';
import type { TimelineEvent } from '@liveworkspace/index-client';
import { eventIcon } from '../timeline/icons';
import { eventLabel, type TimelineCardRender, type TimelineRenderer } from '../timeline/model';
import { Timeline } from '../timeline/Timeline';
import { TimelineControls } from '../timeline/TimelineControls';
import { useTimelineControls } from '../timeline/useTimelineControls';
import { useTimelineFeed } from '../timeline/useTimelineFeed';
import { VIEW_TITLES } from '../views';
import { AppMark } from './badges';
import { useExplorer, type ExplorerContextValue } from './context';
import { EmptyPane } from './EmptyPane';
import { PaneHeader } from './PaneHeader';

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

/** What an event says on its card: the item as it is now, why it is here, and its detail. */
export function renderTimelineEvent(
  event: TimelineEvent,
  ctx: Pick<
    ExplorerContextValue,
    'viewerId' | 'filter' | 'renderThumbnail' | 'openItem' | 'navigate' | 'teamName'
  > & { onOpen?: (event: TimelineEvent) => void },
): TimelineCardRender {
  const by = `by ${actorWords(event, ctx.viewerId)}`;
  const detail = event.detail ?? {};
  let meta: string | undefined = by;
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
  }
  const item = event.item;
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
    meta,
    preview: item.trashedAt ? undefined : (ctx.renderThumbnail?.(item, 'card') ?? undefined),
    badge: ctx.filter === 'all' ? <AppMark app={event.app} size={18} /> : undefined,
    onClick: open,
  };
}

export function TimelinePane({ onOpenNav }: { onOpenNav?: () => void }) {
  const explorer = useExplorer();
  const { client, app, filter, epoch, viewerId, words, onCreate, onTimeline } = explorer;
  const feed = useTimelineFeed(client, app, filter, epoch);
  const controls = useTimelineControls(feed.events, {
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
  const { renderThumbnail, openItem, navigate, teamName } = explorer;
  const render: TimelineRenderer = useMemo(() => {
    const ctx = {
      viewerId,
      filter,
      renderThumbnail,
      openItem,
      navigate,
      teamName,
      onOpen: () => onTimeline?.('Opened', 'Card'),
    };
    return (event) => renderTimelineEvent(event, ctx);
  }, [viewerId, filter, renderThumbnail, openItem, navigate, teamName, onTimeline]);

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
        isEmpty={!feed.loading && feed.events.length === 0}
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
      />
    </div>
  );
}
