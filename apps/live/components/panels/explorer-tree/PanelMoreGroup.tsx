'use client';

import type { DocumentListItem } from '@/lib/api-client';
import { LibraryIcon, ThisBrowserIcon, TrashIcon } from '@/components/primitives/explorer-icons';
import {
  LIBRARY_EXPAND_KEY,
  SIDEBAR_LABELS,
  type SidebarDivider,
  type SidebarRowKind,
} from '@/app/explorer/sidebar/sidebar-structure';
import { trackSidebar } from '@/app/explorer/sidebar/sidebar-telemetry';
import { LIBRARY_PAGES } from '@/app/explorer/sidebar/library-pages';
import { SidebarGroup } from '@/app/explorer/sidebar/SidebarGroup';
import { SidebarRow } from '@/app/explorer/sidebar/SidebarRow';
import { openExplorerPage } from './panel-tree-model';
import { PanelDocumentItem } from './PanelDocumentItem';
import { usePanelTree } from './PanelTreeContext';

const THIS_BROWSER_KEY = 'more:this-browser';

// The panel's More (docs/specs/013-workspace/explorer-structure.md#the-floating-explorer-panel):
// This browser opens in place to the documents saved only here; Library opens to its pages,
// which, like Trash, go to the Explorer.
export function PanelMoreGroup({
  rows,
  divider,
  first,
  offlineDocuments,
}: {
  rows: SidebarRowKind[];
  divider: SidebarDivider;
  first: boolean;
  offlineDocuments: DocumentListItem[];
}) {
  const tree = usePanelTree();
  return (
    <SidebarGroup id="more" divider={divider} first={first}>
      {rows.includes('thisBrowser') ? (
        <SidebarRow
          icon={<ThisBrowserIcon />}
          label={SIDEBAR_LABELS.thisBrowser}
          textLabel={SIDEBAR_LABELS.thisBrowser}
          selected={false}
          onActivate={() => {
            trackSidebar('ThisBrowser', 'panel');
            tree.onToggle(THIS_BROWSER_KEY);
          }}
          depth={0}
          badge={offlineDocuments.length || undefined}
          expandable={offlineDocuments.length > 0}
          expanded={tree.expanded[THIS_BROWSER_KEY] ?? false}
          onToggleExpand={() => tree.onToggle(THIS_BROWSER_KEY)}
        >
          {offlineDocuments.map((d) => (
            <PanelDocumentItem key={d.id} document={d} depth={1} />
          ))}
        </SidebarRow>
      ) : null}
      <SidebarRow
        icon={<LibraryIcon />}
        label={SIDEBAR_LABELS.library}
        textLabel={SIDEBAR_LABELS.library}
        selected={false}
        onActivate={() => {
          trackSidebar('Library', 'panel');
          tree.onToggle(LIBRARY_EXPAND_KEY);
        }}
        depth={0}
        expandable
        expanded={tree.expanded[LIBRARY_EXPAND_KEY] ?? false}
        onToggleExpand={() => tree.onToggle(LIBRARY_EXPAND_KEY)}
      >
        {LIBRARY_PAGES.map(({ kind, label, Icon, row }) => (
          <SidebarRow
            key={kind}
            icon={<Icon />}
            label={label}
            textLabel={label}
            selected={false}
            onActivate={() => {
              trackSidebar(row, 'panel');
              openExplorerPage({ kind });
            }}
            depth={1}
          />
        ))}
      </SidebarRow>
      <SidebarRow
        icon={<TrashIcon />}
        label={SIDEBAR_LABELS.trash}
        textLabel={SIDEBAR_LABELS.trash}
        selected={false}
        onActivate={() => {
          trackSidebar('Trash', 'panel');
          openExplorerPage({ kind: 'trash' });
        }}
        depth={0}
      />
    </SidebarGroup>
  );
}
