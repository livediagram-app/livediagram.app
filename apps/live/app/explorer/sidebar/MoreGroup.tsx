'use client';

import {
  ImageIcon,
  LibraryIcon,
  PaletteIcon,
  ShapesIcon,
  ThisBrowserIcon,
  TrashIcon,
} from '@/components/primitives/explorer-icons';
import { useExplorer } from '../ExplorerContext';
import type { SelectedNode } from '../views';
import {
  LIBRARY_EXPAND_KEY,
  SIDEBAR_LABELS,
  type SidebarDivider,
  type SidebarRowKind,
} from './sidebar-structure';
import { trackSidebar, type SidebarTelemetryRow } from './sidebar-telemetry';
import { SidebarGroup } from './SidebarGroup';
import { SidebarRow } from './SidebarRow';

// The Library's pages, in order.
const LIBRARY_PAGES = [
  { kind: 'gallery', label: SIDEBAR_LABELS.gallery, Icon: ImageIcon, row: 'ImageGallery' },
  { kind: 'themes', label: SIDEBAR_LABELS.themes, Icon: PaletteIcon, row: 'Themes' },
  {
    kind: 'shape-libraries',
    label: SIDEBAR_LABELS.shapeLibraries,
    Icon: ShapesIcon,
    row: 'ShapeLibraries',
  },
] as const satisfies readonly {
  kind: SelectedNode['kind'];
  label: string;
  Icon: unknown;
  row: SidebarTelemetryRow;
}[];

// More (docs/specs/013-workspace/explorer-structure.md): This browser (offline documents,
// docs/specs/006-document/offline-mode.md), Library, and Trash
// (docs/specs/013-workspace/trash.md). `rows` decides whether This browser shows.
export function MoreGroup({
  rows,
  divider,
  first,
}: {
  rows: SidebarRowKind[];
  divider: SidebarDivider;
  first: boolean;
}) {
  const { selected, go, expanded, toggleExpand, offlineDocuments } = useExplorer();
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
          badge={offlineDocuments.length || undefined}
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
      <SidebarRow
        icon={<TrashIcon />}
        label={SIDEBAR_LABELS.trash}
        textLabel={SIDEBAR_LABELS.trash}
        selected={selected.kind === 'trash'}
        onActivate={() => {
          trackSidebar('Trash');
          go({ kind: 'trash' });
        }}
        depth={0}
      />
    </SidebarGroup>
  );
}
