'use client';

import {
  ActivityIcon,
  ClockIcon,
  ShareIcon,
  StarIcon,
  TimelineIcon,
} from '@/components/primitives/explorer-icons';
import { useExplorer } from '../ExplorerContext';
import { SidebarRow, SidebarSectionLabel } from './SidebarRow';

// The "Quick find" section: Timeline, Activity, Recent, Favourites and
// Shared with You.
export function QuickFindSection() {
  const {
    selected,
    go,
    favouriteIds,
    documents: liveDocs,
    teamDocuments,
    shared,
    recentCount,
    timelineUnread,
    activity,
  } = useExplorer();
  // Only count stars pointing at documents still in view: the FK cascade
  // drops rows for deleted documents, but a star on a team document you've
  // since left would linger server-side until touched.
  const favouriteCount = [...liveDocs, ...teamDocuments].filter((d) =>
    favouriteIds.has(d.id),
  ).length;
  return (
    <>
      <SidebarSectionLabel>Quick find</SidebarSectionLabel>
      {/* The landing view (docs/specs/013-workspace/timeline.md §8.1), so it leads the tree. The
          badge counts OTHER people's events since the reader last
          opened it. Cleared on navigation rather than after the fetch, so
          the number doesn't linger while the feed loads. */}
      <SidebarRow
        icon={<TimelineIcon />}
        label="Timeline"
        selected={selected.kind === 'timeline'}
        onClick={() => {
          timelineUnread.clear();
          go({ kind: 'timeline' });
        }}
        depth={0}
        badge={timelineUnread.count > 0 ? timelineUnread.count : undefined}
      />
      {/* What's outstanding for the reader (docs/specs/013-workspace/activity-page.md). The badge counts
          only the open actions ASSIGNED TO them, and hides at zero. */}
      <SidebarRow
        icon={<ActivityIcon />}
        label="Activity"
        selected={selected.kind === 'activity'}
        onClick={() => go({ kind: 'activity' })}
        depth={0}
        badge={activity.assignedToMe.length > 0 ? activity.assignedToMe.length : undefined}
      />
      <SidebarRow
        icon={<ClockIcon />}
        label="Recent"
        selected={selected.kind === 'recent'}
        onClick={() => go({ kind: 'recent' })}
        depth={0}
        badge={recentCount > 0 ? recentCount : undefined}
      />
      <SidebarRow
        icon={<StarIcon />}
        label="Favourites"
        selected={selected.kind === 'favourites'}
        onClick={() => go({ kind: 'favourites' })}
        depth={0}
        badge={favouriteCount || undefined}
      />
      <SidebarRow
        icon={<ShareIcon />}
        label="Shared with You"
        selected={selected.kind === 'shared'}
        onClick={() => go({ kind: 'shared' })}
        depth={0}
        badge={shared.length > 0 ? shared.length : undefined}
      />
    </>
  );
}
