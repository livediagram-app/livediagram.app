'use client';

// A team's own feed on its view, under the team's card and library (livediagram/docs/specs/013-workspace/timeline.md
// "Team Activity"): the events on the team's items and the team's own events, from the team's scope alone
// (`GET /timeline?team=`), so a member who joined later still sees the whole history. Closed until opened, so the
// library stays first and nothing is read until asked for. The same cards and stacks as the Timeline, every app's
// events (each card wears its app's mark), with no New marks (a shared feed has no one "last look") and no Remove
// from Timeline (that is the reader's own Timeline).

import { useId, useMemo, useState, useSyncExternalStore } from 'react';
import { EmptyState } from '@liveworkspace/ui';
import { useNamedEvents } from '../data/names';
import { Timeline } from '../timeline/Timeline';
import { TimelineControls } from '../timeline/TimelineControls';
import { useTimelineControls } from '../timeline/useTimelineControls';
import { useTimelineFeed } from '../timeline/useTimelineFeed';
import { LIST_CARD, MUTED } from '../ui/classes';
import { ChevronDownIcon, TimelineIcon } from '../ui/icons';
import { HistoryIcon } from '../ui/library-icons';
import { useExplorer } from './context';
import { renderTimelineEvent } from './TimelinePane';

export const TEAM_ACTIVITY_TITLE = 'Team Activity';

/** The section, closed by default: its header toggles the feed open. Keyed on the team by its caller. */
export function TeamActivity({ teamId }: { teamId: string }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <section className={LIST_CARD} data-team-activity={teamId}>
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((was) => !was)}
          className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-800 transition duration-micro hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 dark:text-slate-100 dark:hover:bg-slate-800/60"
        >
          <span className="text-amber-600 dark:text-amber-400" aria-hidden>
            <TimelineIcon size={14} />
          </span>
          <span className="flex-1">{TEAM_ACTIVITY_TITLE}</span>
          <span className={`text-xs font-normal ${MUTED}`}>What the team has done</span>
          <span
            aria-hidden
            className={`transition-transform duration-micro ${open ? 'rotate-180' : ''}`}
          >
            <ChevronDownIcon />
          </span>
        </button>
      </h2>
      {open ? (
        <div id={bodyId} className="border-t border-slate-100 px-4 py-4 dark:border-slate-700/60">
          <TeamFeed teamId={teamId} />
        </div>
      ) : null}
    </section>
  );
}

function TeamFeed({ teamId }: { teamId: string }) {
  const explorer = useExplorer();
  const { client, app, epoch, viewerId, overlay, onTimeline } = explorer;
  // Every app's events: a team's work is in every app.
  const feed = useTimelineFeed(client, app, 'all', epoch, undefined, teamId);
  const overlayVersion = useSyncExternalStore(overlay.subscribe, overlay.version, overlay.version);
  const named = useNamedEvents(feed.events);
  const events = useMemo(
    () => named.filter((e) => !e.item || !overlay.apply(e.item).gone),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- overlayVersion is what changes overlay.apply
    [named, overlay, overlayVersion],
  );
  const controls = useTimelineControls(events, { viewerId });
  const { renderThumbnail, openItem, navigate, teamName, tokensUrl } = explorer;
  const render = useMemo(() => {
    const ctx = {
      viewerId,
      filter: 'all' as const,
      renderThumbnail,
      openItem,
      navigate,
      teamName,
      tokensUrl,
      onOpen: () => onTimeline?.('Opened', 'Card'),
    };
    return (event: Parameters<typeof renderTimelineEvent>[0]) =>
      renderTimelineEvent({ ...event, item: event.item ? overlay.apply(event.item) : null }, ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- overlayVersion is what changes overlay.apply
  }, [
    viewerId,
    renderThumbnail,
    openItem,
    navigate,
    teamName,
    tokensUrl,
    onTimeline,
    overlay,
    overlayVersion,
  ]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <TimelineControls controls={controls} />
      </div>
      <Timeline
        controls={controls}
        viewerId={viewerId}
        render={render}
        loading={feed.loading}
        isEmpty={!feed.loading && events.length === 0}
        emptyState={
          <EmptyState
            compact
            icon={<HistoryIcon size={28} />}
            title="No Team Activity Yet"
            description="What the team does will show here."
          />
        }
        error={feed.error}
        errorTitle="Couldn’t load this team’s activity"
        onRetry={feed.retry}
        hasMore={feed.hasMore}
        loadingMore={feed.loadingMore}
        onLoadMore={feed.loadMore}
        onStackExpand={() => onTimeline?.('Opened', 'Stack')}
      />
    </div>
  );
}
