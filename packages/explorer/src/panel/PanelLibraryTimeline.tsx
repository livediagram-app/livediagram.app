'use client';

// The editor panel's Timeline and Library sections (livediagram's explorer-panel PanelViews "TimelineSection" and
// "LibrarySection"): the Timeline as a list under its days, newest first, and the Library's pages as tabs over one
// view. The Timeline's card menus, filters and calendar are the Explorer page's (Open Page).

import { useMemo, useSyncExternalStore } from 'react';
import { useExplorer } from '../explorer/context';
import { renderTimelineEvent } from '../explorer/TimelinePane';
import { useLibraryHost } from '../library/context';
import { GalleryPane } from '../library/GalleryPane';
import { ShapeLibrariesPane } from '../library/ShapeLibrariesPane';
import { eventTone, groupByDay, timeLabel, type TimelineTone } from '../timeline/model';
import { useTimelineFeed } from '../timeline/useTimelineFeed';
import { TimelineIcon } from '../ui/icons';
import { ImageIcon, ShapesIcon } from '../ui/library-icons';
import { SIDEBAR_LABELS } from '../views';
import {
  PANE_LINK,
  PaneEmpty,
  PaneFailed,
  PaneList,
  PaneRow,
  PaneSection,
  PaneSkeleton,
  PaneTile,
  type PaneTone,
} from './pane-parts';
import type { LibraryTab } from './sections';

const TILE_TONES: Record<TimelineTone, PaneTone> = {
  danger: 'rose',
  structural: 'amber',
  create: 'emerald',
  neutral: 'brand',
};

export function PanelTimeline() {
  const explorer = useExplorer();
  const {
    client,
    app,
    filter,
    epoch,
    inbox,
    overlay,
    viewerId,
    renderThumbnail,
    openItem,
    navigate,
    teamName,
    manageTeamsUrl,
  } = explorer;
  const feed = useTimelineFeed(client, app, filter, epoch, inbox.clearTimelineNew);
  // Renames and deletes made anywhere show on the rows at once: a new overlay version draws them again.
  useSyncExternalStore(overlay.subscribe, overlay.version, overlay.version);
  const days = useMemo(() => groupByDay(feed.events), [feed.events]);
  const ctx = useMemo(
    () => ({ viewerId, filter, renderThumbnail, openItem, navigate, teamName, manageTeamsUrl }),
    [viewerId, filter, renderThumbnail, openItem, navigate, teamName, manageTeamsUrl],
  );
  if (feed.error) return <PaneFailed message="The Timeline could not load." onRetry={feed.retry} />;
  if (feed.loading) return <PaneSkeleton rows={6} />;
  if (!feed.events.length)
    return (
      <PaneEmpty
        icon={<TimelineIcon size={20} />}
        title="No activity yet"
        description="What you and your teams make, change and share shows up here."
      />
    );
  return (
    <div className="flex flex-col gap-5">
      {days.map((day) => {
        const heading = day.isToday ? 'Today' : day.label;
        return (
          <PaneSection key={day.key} title={heading}>
            <PaneList label={heading}>
              {day.events.map((event) => {
                const card = renderTimelineEvent(
                  { ...event, item: event.item ? overlay.apply(event.item) : null },
                  ctx,
                );
                return (
                  <PaneRow
                    key={event.id}
                    leading={
                      <PaneTile tone={TILE_TONES[eventTone(event.type)]}>{card.icon}</PaneTile>
                    }
                    title={card.subject ?? card.label}
                    meta={
                      <>
                        {card.label} · {timeLabel(event.occurredAt)}
                      </>
                    }
                    {...(card.onClick ? { onActivate: card.onClick } : {})}
                  />
                );
              })}
            </PaneList>
          </PaneSection>
        );
      })}
      {feed.hasMore ? (
        <button
          type="button"
          onClick={feed.loadMore}
          disabled={feed.loadingMore}
          className={`${PANE_LINK} self-center py-1`}
        >
          {feed.loadingMore ? 'Loading…' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}

/** The Library's tabs the host keeps, Image Gallery first. */
export function libraryTabs(host: { gallery?: unknown; shapeLibraries?: unknown }): LibraryTab[] {
  return [
    ...(host.gallery ? (['gallery'] as const) : []),
    ...(host.shapeLibraries ? (['shape-libraries'] as const) : []),
  ];
}

export function PanelLibrary({
  tab,
  setTab,
}: {
  tab: LibraryTab;
  setTab: (tab: LibraryTab) => void;
}) {
  const host = useLibraryHost();
  const { kind } = useExplorer();
  const tabs = libraryTabs(host);
  const shown = tabs.includes(tab) ? tab : tabs[0];
  return (
    <div className="flex flex-col gap-4">
      {tabs.length > 1 ? (
        <div
          role="tablist"
          aria-label={SIDEBAR_LABELS.library}
          className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
        >
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={shown === t}
              onClick={() => setTab(t)}
              className={`flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium transition pointer-coarse:h-11 ${
                shown === t
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {t === 'gallery' ? <ImageIcon /> : <ShapesIcon />}
              {t === 'gallery' ? SIDEBAR_LABELS.gallery : SIDEBAR_LABELS.shapeLibraries}
            </button>
          ))}
        </div>
      ) : null}
      <div role={tabs.length > 1 ? 'tabpanel' : undefined}>
        {shown === 'gallery' && host.gallery ? (
          <GalleryPane
            compact
            host={host.gallery}
            kindMany={{ one: kind.lowerOne, many: kind.lowerMany }}
          />
        ) : shown === 'shape-libraries' && host.shapeLibraries ? (
          <ShapeLibrariesPane compact host={host.shapeLibraries} />
        ) : null}
      </div>
    </div>
  );
}
