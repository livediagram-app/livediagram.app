'use client';

// A Timeline for something other than the reader's own feed (spec/138
// §3.4) — a team's activity, or one diagram's history.
//
// Self-contained, unlike the Explorer's landing pane: it owns its
// controls as well as its data, because it drops into a card on a
// detail page rather than into a page whose header it can borrow.
//
// The team case is the one that fixes a real gap. Per-member scopes are
// written when an event happens, so somebody who joins in March has
// nothing from February; the team's own scope carries the whole history
// and is readable by any joined member.

import { Timeline, TimelineControls } from '@livediagram/ui';
import type { TimelineScopeRef } from '@livediagram/api-schema';
import { track } from '@/lib/telemetry';
import { TIMELINE_RENDERERS } from '@/app/explorer/timeline/renderers';
import { useTimelineFeed } from '@/app/explorer/useTimelineFeed';

export function ScopedTimeline({
  ownerId,
  scope,
  title,
  emptyMessage,
}: {
  ownerId: string;
  scope: TimelineScopeRef;
  title: string;
  emptyMessage: string;
}) {
  const feed = useTimelineFeed(ownerId, true, scope);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
        <div className="flex items-center gap-2">
          <TimelineControls controls={feed.controls} />
        </div>
      </header>
      <Timeline
        controls={feed.controls}
        viewerId={ownerId}
        renderers={TIMELINE_RENDERERS}
        loading={feed.loading}
        isEmpty={feed.events.length === 0}
        emptyState={
          <p className="rounded-lg border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {emptyMessage}
          </p>
        }
        hasMore={feed.hasMore}
        loadingMore={feed.loadingMore}
        onLoadMore={feed.loadMore}
        // No unread markers here. "Since I was last here" is a question
        // about one reader and one feed; a shared team history has no
        // single "here" to have been last at.
        onStackExpand={() => track('Timeline', 'Opened', 'Stack')}
      />
    </section>
  );
}

// Convenience wrappers so call sites don't re-type the scope shape or
// the empty copy.
export function TeamTimeline({ ownerId, teamId }: { ownerId: string; teamId: string }) {
  return (
    <ScopedTimeline
      ownerId={ownerId}
      scope={{ scopeType: 'team', scopeId: teamId }}
      title="Team activity"
      emptyMessage="Nothing has happened in this team yet."
    />
  );
}

export function DiagramTimeline({ ownerId, diagramId }: { ownerId: string; diagramId: string }) {
  return (
    <ScopedTimeline
      ownerId={ownerId}
      scope={{ scopeType: 'diagram', scopeId: diagramId }}
      title="History"
      emptyMessage="Nothing has happened to this diagram yet."
    />
  );
}
