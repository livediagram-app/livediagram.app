'use client';

import { ActivityIcon, HomeIcon, ShareIcon } from '@/components/primitives/explorer-icons';
import { useExplorer } from '../ExplorerContext';
import { SIDEBAR_LABELS, type SidebarDivider } from './sidebar-structure';
import { trackSidebar } from './sidebar-telemetry';
import { SidebarGroup } from './SidebarGroup';
import { SidebarRow } from './SidebarRow';

// Overview (docs/specs/013-workspace/explorer-structure.md): Home, Activity, Shared with me.
export function OverviewGroup({ divider, first }: { divider: SidebarDivider; first: boolean }) {
  const { selected, go, shared, timelineUnread, activity } = useExplorer();
  const assigned = activity.assignedToMe.length;
  return (
    <SidebarGroup id="overview" divider={divider} first={first}>
      {/* Home is the Timeline (docs/specs/013-workspace/timeline.md §8.2). Its badge counts
          OTHER people's events since the reader last looked, cleared on
          navigation so the number doesn't linger while the feed loads. */}
      <SidebarRow
        icon={<HomeIcon />}
        label={SIDEBAR_LABELS.home}
        textLabel={SIDEBAR_LABELS.home}
        selected={selected.kind === 'timeline'}
        onActivate={() => {
          trackSidebar('Home');
          timelineUnread.clear();
          go({ kind: 'timeline' });
        }}
        depth={0}
        badge={timelineUnread.count > 0 ? timelineUnread.count : undefined}
      />
      {/* Open actions ASSIGNED TO the reader (docs/specs/013-workspace/activity-page.md); hidden at zero. */}
      <SidebarRow
        icon={<ActivityIcon />}
        label={SIDEBAR_LABELS.activity}
        textLabel={SIDEBAR_LABELS.activity}
        selected={selected.kind === 'activity'}
        onActivate={() => {
          trackSidebar('Activity');
          go({ kind: 'activity' });
        }}
        depth={0}
        badge={assigned > 0 ? assigned : undefined}
      />
      <SidebarRow
        icon={<ShareIcon />}
        label={SIDEBAR_LABELS.shared}
        textLabel={SIDEBAR_LABELS.shared}
        selected={selected.kind === 'shared'}
        onActivate={() => {
          trackSidebar('SharedWithMe');
          go({ kind: 'shared' });
        }}
        depth={0}
        badge={shared.length > 0 ? shared.length : undefined}
      />
    </SidebarGroup>
  );
}
