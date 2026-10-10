'use client';

import {
  HomeIcon,
  InboxIcon,
  ShareIcon,
  TimelineIcon,
} from '@/components/primitives/explorer-icons';
import { useExplorer } from '../ExplorerContext';
import { SIDEBAR_LABELS, type SidebarDivider } from './sidebar-structure';
import { trackSidebar } from './sidebar-telemetry';
import { SidebarGroup } from './SidebarGroup';
import { SidebarRow } from './SidebarRow';
import { inboxBadge } from './inbox-badge';

// Overview (docs/specs/013-workspace/explorer-structure.md): Home, Inbox, Timeline, Shared with me.
export function OverviewGroup({ divider, first }: { divider: SidebarDivider; first: boolean }) {
  const { selected, go, shared, timelineUnread, activity } = useExplorer();
  return (
    <SidebarGroup id="overview" divider={divider} first={first}>
      {/* Home (docs/specs/013-workspace/explorer-home.md). Its badge counts OTHER people's
          Timeline events since the reader last looked (timeline.md §8.2), cleared on navigation
          so the number doesn't linger while Home loads. */}
      <SidebarRow
        icon={<HomeIcon />}
        label={SIDEBAR_LABELS.home}
        textLabel={SIDEBAR_LABELS.home}
        selected={selected.kind === 'home'}
        onActivate={() => {
          trackSidebar('Home');
          timelineUnread.clear();
          go({ kind: 'home' });
        }}
        depth={0}
        badge={timelineUnread.count > 0 ? timelineUnread.count : undefined}
      />
      {/* Open actions and Plan cards ASSIGNED TO the reader (docs/specs/013-workspace/inbox.md), 0 included. */}
      <SidebarRow
        icon={<InboxIcon />}
        label={SIDEBAR_LABELS.inbox}
        textLabel={SIDEBAR_LABELS.inbox}
        selected={selected.kind === 'inbox'}
        onActivate={() => {
          trackSidebar('Inbox');
          go({ kind: 'inbox' });
        }}
        depth={0}
        badge={inboxBadge(activity)}
      />
      {/* The Timeline (docs/specs/013-workspace/timeline.md §8.2): no badge, its unread count sits on Home. */}
      <SidebarRow
        icon={<TimelineIcon />}
        label={SIDEBAR_LABELS.timeline}
        textLabel={SIDEBAR_LABELS.timeline}
        selected={selected.kind === 'timeline'}
        onActivate={() => {
          trackSidebar('Timeline');
          go({ kind: 'timeline' });
        }}
        depth={0}
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
