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

import { Timeline } from '@livediagram/ui';
import { track } from '@/lib/telemetry';
import { TIMELINE_RENDERERS } from '@/app/explorer/timeline/renderers';
import type { TimelineFeed } from '@/app/explorer/useTimelineFeed';
import { TimelineEmptyState } from './TimelineEmptyState';

export function TimelinePane({ feed, ownerId }: { feed: TimelineFeed; ownerId: string }) {
  return (
    <Timeline
      controls={feed.controls}
      viewerId={ownerId}
      renderers={TIMELINE_RENDERERS}
      loading={feed.loading}
      isEmpty={feed.events.length === 0}
      emptyState={<TimelineEmptyState />}
      hasMore={feed.hasMore}
      loadingMore={feed.loadingMore}
      onLoadMore={feed.loadMore}
      lastSeenAt={feed.lastSeenAt}
      onStackExpand={() => track('Timeline', 'Opened', 'Stack')}
    />
  );
}
