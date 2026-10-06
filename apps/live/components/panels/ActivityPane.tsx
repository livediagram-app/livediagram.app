'use client';

// The Explorer's Activity section (docs/specs/013-workspace/activity-page.md): three card-lists of what
// is outstanding for the reader — actions and Plan cards assigned to them, actions
// they assigned, and the comment threads they are in — each hidden
// when empty, one empty state when all three are.
//
// The data comes in from Explorer state (useActivityFeed) because the
// sidebar badge reads the same list; this file only owns the section
// order and the row -> editor hand-off.

import { useEffect } from 'react';
import { track } from '@/lib/telemetry';
import type { ActivityFeed } from '@/app/explorer/useActivityFeed';
import { SkeletonRows } from '@/app/explorer/views';
import {
  ActivityActionRow,
  ActivityCardRow,
  ActivityEmptyState,
  ActivityFailedState,
  ActivitySection,
  ActivityCardThreadRow,
  ActivityThreadRow,
} from './activity-pane-parts';

export function ActivityPane({ feed }: { feed: ActivityFeed }) {
  // Once per visit to the section, not per fetch: the feed re-reads on
  // return-to-tab and a guest signing in, neither of which is a visit.
  useEffect(() => {
    track('Activity', 'Opened');
  }, []);

  if (feed.loading) return <SkeletonRows />;
  if (feed.error) return <ActivityFailedState onRetry={feed.retry} />;
  const total = feed.assignedToMe.length + feed.youAssigned.length + feed.threads.length;
  if (total === 0) return <ActivityEmptyState />;

  return (
    <div>
      {feed.assignedToMe.length > 0 ? (
        <ActivitySection title="Assigned to You" count={feed.assignedToMe.length}>
          {feed.assignedToMe.map((row) =>
            row.kind === 'card' ? (
              <ActivityCardRow
                key={`card:${row.documentId}:${row.id}`}
                card={row}
                onOpen={() => track('Activity', 'Selected', 'Card')}
              />
            ) : (
              <ActivityActionRow
                key={`${row.tabId}:${row.elementId}:${row.id}`}
                action={row}
                onOpen={() => track('Activity', 'Selected', 'Action')}
              />
            ),
          )}
        </ActivitySection>
      ) : null}
      {feed.youAssigned.length > 0 ? (
        <ActivitySection title="You Assigned" count={feed.youAssigned.length}>
          {feed.youAssigned.map((a) => (
            <ActivityActionRow
              key={`${a.tabId}:${a.elementId}`}
              action={a}
              onOpen={() => track('Activity', 'Selected', 'Action')}
            />
          ))}
        </ActivitySection>
      ) : null}
      {feed.threads.length > 0 ? (
        <ActivitySection title="Open Comment Threads" count={feed.threads.length}>
          {feed.threads.map((t) =>
            t.kind === 'card' ? (
              <ActivityCardThreadRow
                key={`card:${t.documentId}:${t.id}`}
                thread={t}
                onOpen={() => track('Activity', 'Selected', 'CardThread')}
              />
            ) : (
              <ActivityThreadRow
                key={`${t.tabId}:${t.elementId}`}
                thread={t}
                onOpen={() => track('Activity', 'Selected', 'Thread')}
              />
            ),
          )}
        </ActivitySection>
      ) : null}
    </div>
  );
}
