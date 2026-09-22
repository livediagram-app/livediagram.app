'use client';

// The Explorer's Timeline section (spec/138 §2, §8).
//
// Owns the fetch and the paging cursor; the shared <Timeline> owns the
// layout, the stacking, and the calendar. That split is why this file
// is short — everything about how a feed LOOKS lives in
// @livediagram/ui, and everything about where the events come from
// lives here.
//
// The controls (mode switch, filters) render in the Explorer's own page
// header, so their state comes in from above via `useTimelineFeed` and
// is shared with <TimelineControls> up there.
//
// The card menus (spec/138 §2.8) are built here too, because this pane
// sits inside the Explorer context that holds the diagram lists and the
// rename / move / delete handlers they need.

import { Timeline } from '@livediagram/ui';
import { track } from '@/lib/telemetry';
import { TIMELINE_RENDERERS } from '@/app/explorer/timeline/renderers';
import { useTimelineCardSlots } from '@/app/explorer/timeline/useTimelineCardSlots';
import { useTimelineStackSlots } from '@/app/explorer/timeline/useTimelineStackSlots';
import type { TimelineFeed } from '@/app/explorer/useTimelineFeed';
import { TimelineEmptyState } from './TimelineEmptyState';

export function TimelinePane({
  feed,
  ownerId,
  onShowHistory,
}: {
  feed: TimelineFeed;
  ownerId: string;
  /** Opens one diagram's History dialog, which the pane above owns. */
  onShowHistory: (id: string, name: string) => void;
}) {
  const cardSlots = useTimelineCardSlots({ onShowHistory, onDismiss: feed.dismiss });
  const stackSlots = useTimelineStackSlots({ onDismiss: feed.dismiss });
  return (
    <Timeline
      controls={feed.controls}
      viewerId={ownerId}
      renderers={TIMELINE_RENDERERS}
      cardSlots={cardSlots}
      stackSlots={stackSlots}
      loading={feed.loading}
      isEmpty={feed.events.length === 0}
      emptyState={<TimelineEmptyState />}
      error={feed.error}
      onRetry={feed.retry}
      hasMore={feed.hasMore}
      loadingMore={feed.loadingMore}
      onLoadMore={feed.loadMore}
      lastSeenAt={feed.lastSeenAt}
      focusEventId={feed.focusEventId}
      onStackExpand={() => track('Timeline', 'Opened', 'Stack')}
    />
  );
}
