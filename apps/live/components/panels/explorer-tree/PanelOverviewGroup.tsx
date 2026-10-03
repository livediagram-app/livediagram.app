'use client';

import type { SharedWithItem } from '@/lib/api-client';
import { ActivityIcon, HomeIcon, ShareIcon } from '@/components/primitives/explorer-icons';
import { SIDEBAR_LABELS, type SidebarDivider } from '@/app/explorer/sidebar/sidebar-structure';
import { trackSidebar } from '@/app/explorer/sidebar/sidebar-telemetry';
import { SidebarGroup } from '@/app/explorer/sidebar/SidebarGroup';
import { SidebarRow } from '@/app/explorer/sidebar/SidebarRow';
import { sharedToPaneDocument } from '@/app/explorer/views';
import { openExplorerPage } from './panel-tree-model';
import { PanelDocumentItem } from './PanelDocumentItem';
import { usePanelTree } from './PanelTreeContext';

const SHARED_KEY = 'overview:shared';

// The panel's Overview (docs/specs/013-workspace/explorer-structure.md#the-floating-explorer-panel):
// Home and Activity go to their Explorer pages; Shared with me opens in place to the documents
// shared with the reader.
export function PanelOverviewGroup({
  divider,
  first,
  shared,
}: {
  divider: SidebarDivider;
  first: boolean;
  shared: SharedWithItem[];
}) {
  const tree = usePanelTree();
  return (
    <SidebarGroup id="overview" divider={divider} first={first}>
      <SidebarRow
        icon={<HomeIcon />}
        label={SIDEBAR_LABELS.home}
        textLabel={SIDEBAR_LABELS.home}
        selected={false}
        onActivate={() => {
          trackSidebar('Home', 'panel');
          openExplorerPage({ kind: 'home' });
        }}
        depth={0}
      />
      <SidebarRow
        icon={<ActivityIcon />}
        label={SIDEBAR_LABELS.activity}
        textLabel={SIDEBAR_LABELS.activity}
        selected={false}
        onActivate={() => {
          trackSidebar('Activity', 'panel');
          openExplorerPage({ kind: 'activity' });
        }}
        depth={0}
      />
      <SidebarRow
        icon={<ShareIcon />}
        label={SIDEBAR_LABELS.shared}
        textLabel={SIDEBAR_LABELS.shared}
        selected={false}
        onActivate={() => {
          trackSidebar('SharedWithMe', 'panel');
          if (shared.length > 0) tree.onToggle(SHARED_KEY);
          else openExplorerPage({ kind: 'shared' });
        }}
        depth={0}
        badge={shared.length || undefined}
        expandable={shared.length > 0}
        expanded={tree.expanded[SHARED_KEY] ?? false}
        onToggleExpand={() => tree.onToggle(SHARED_KEY)}
      >
        {shared.map((s) => (
          <PanelDocumentItem key={s.id} document={sharedToPaneDocument(s)} depth={1} />
        ))}
      </SidebarRow>
    </SidebarGroup>
  );
}
