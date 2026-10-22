'use client';

import { LibraryIcon, ThisBrowserIcon } from '@/components/primitives/explorer-icons';
import { useExplorer } from '../ExplorerContext';
import {
  LIBRARY_EXPAND_KEY,
  SIDEBAR_LABELS,
  type SidebarDivider,
  type SidebarRowKind,
} from './sidebar-structure';
import { trackSidebar } from './sidebar-telemetry';
import { LIBRARY_PAGES } from './library-pages';
import { SidebarGroup } from './SidebarGroup';
import { SidebarRow } from './SidebarRow';
import { TagsSidebarRow } from './TagRows';
import { TrashSidebarRow } from './TrashSidebarRow';

// More (docs/specs/013-workspace/explorer-structure.md): This Browser (offline projects,
// docs/specs/006-project/offline-mode.md), Library (Tags, docs/specs/013-workspace/tags.md, then the Library
// pages), and Trash (docs/specs/013-workspace/trash.md). `rows` decides whether This Browser shows.
export function MoreGroup({
  rows,
  divider,
  first,
}: {
  rows: SidebarRowKind[];
  divider: SidebarDivider;
  first: boolean;
}) {
  const { selected, go, expanded, toggleExpand, offlineProjects } = useExplorer();
  const toggleLibrary = () => toggleExpand(LIBRARY_EXPAND_KEY);
  return (
    <SidebarGroup id="more" divider={divider} first={first}>
      {rows.includes('thisBrowser') ? (
        <SidebarRow
          icon={<ThisBrowserIcon />}
          label={SIDEBAR_LABELS.thisBrowser}
          textLabel={SIDEBAR_LABELS.thisBrowser}
          selected={selected.kind === 'offline'}
          onActivate={() => {
            trackSidebar('ThisBrowser');
            go({ kind: 'offline' });
          }}
          depth={0}
          badge={offlineProjects.length || undefined}
        />
      ) : null}
      {/* Library has no page of its own: activating it opens or closes it. */}
      <SidebarRow
        icon={<LibraryIcon />}
        label={SIDEBAR_LABELS.library}
        textLabel={SIDEBAR_LABELS.library}
        selected={false}
        onActivate={() => {
          trackSidebar('Library');
          toggleLibrary();
        }}
        depth={0}
        expandable
        expanded={expanded.has(LIBRARY_EXPAND_KEY)}
        onToggleExpand={toggleLibrary}
      >
        <TagsSidebarRow depth={1} />
        {LIBRARY_PAGES.map(({ kind, label, Icon, row }) => (
          <SidebarRow
            key={kind}
            icon={<Icon />}
            label={label}
            textLabel={label}
            selected={selected.kind === kind}
            onActivate={() => {
              trackSidebar(row);
              go({ kind });
            }}
            depth={1}
          />
        ))}
      </SidebarRow>
      {/* Also a drop target for a dragged project or folder (explorer-structure.md "Dragging to the Trash"). */}
      <TrashSidebarRow />
    </SidebarGroup>
  );
}
