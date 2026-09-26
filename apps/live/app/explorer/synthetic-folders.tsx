import type { ComponentType } from 'react';
import {
  DynamicFolderIcon,
  OfflineFolderIcon,
  SparkleIcon,
  UnsortedIcon,
} from '@/components/primitives/explorer-icons';
import type { ExplorerViewProps } from './explorer-view-props';

// The synthetic ("dynamic") folders (spec/15, spec/76): live views over
// your diagrams rather than rows in the folders table. Unsorted holds
// what has no folder, Generated what an AI tool made, Offline what exists
// only in this browser, and Dynamic is the parent the three sit under.
//
// One table of glyph + name, read by every surface that lists them: the
// page's list rows, its cards, its sidebar, and the floating panel's
// tree. Each used to spell the pairs out itself.
export type SyntheticFolderKind = 'unsorted' | 'generated' | 'offline' | 'dynamic';

export const SYNTHETIC_FOLDERS: Record<
  SyntheticFolderKind,
  { Icon: ComponentType<{ size?: number }>; label: string }
> = {
  unsorted: { Icon: UnsortedIcon, label: 'Unsorted' },
  generated: { Icon: SparkleIcon, label: 'Generated' },
  offline: { Icon: OfflineFolderIcon, label: 'Offline' },
  dynamic: { Icon: DynamicFolderIcon, label: 'Dynamic' },
};

export type SyntheticFolderEntry = {
  kind: SyntheticFolderKind;
  count: number;
  onOpen: () => void;
};

// The synthetic folders a pane view shows at its top, in order, from the
// view's show / count / open props. ListView and CardView both render
// this list, as rows and as cards.
export function visibleSyntheticFolders(p: ExplorerViewProps): SyntheticFolderEntry[] {
  const out: SyntheticFolderEntry[] = [];
  if (p.showUnsortedRow)
    out.push({ kind: 'unsorted', count: p.unsortedCount, onOpen: p.onOpenUnsorted });
  if (p.showGeneratedRow && p.onOpenGenerated)
    out.push({ kind: 'generated', count: p.generatedCount ?? 0, onOpen: p.onOpenGenerated });
  if (p.showOfflineRow && p.onOpenOffline)
    out.push({ kind: 'offline', count: p.offlineCount ?? 0, onOpen: p.onOpenOffline });
  if (p.showDynamicRow && p.onOpenDynamic)
    out.push({ kind: 'dynamic', count: p.dynamicCount ?? 0, onOpen: p.onOpenDynamic });
  return out;
}
