'use client';

import {
  ImageIcon,
  PaletteIcon,
  ShapesIcon,
  TrashIcon,
} from '@/components/primitives/explorer-icons';
import { useExplorer } from '../ExplorerContext';
import { SidebarRow, SidebarSectionLabel } from './SidebarRow';

// The Library section: Image Gallery, Themes, Shape libraries
// (docs/specs/013-workspace/shape-libraries.md) and Trash (docs/specs/013-workspace/trash.md),
// last, where people look for a document they deleted.
export function LibrarySection() {
  const { selected, go } = useExplorer();
  return (
    <>
      <SidebarSectionLabel>Library</SidebarSectionLabel>
      <SidebarRow
        icon={<ImageIcon />}
        label="Image Gallery"
        selected={selected.kind === 'gallery'}
        onClick={() => go({ kind: 'gallery' })}
        depth={0}
      />
      <SidebarRow
        icon={<PaletteIcon />}
        label="Themes"
        selected={selected.kind === 'themes'}
        onClick={() => go({ kind: 'themes' })}
        depth={0}
      />
      <SidebarRow
        icon={<ShapesIcon />}
        label="Shape libraries"
        selected={selected.kind === 'shape-libraries'}
        onClick={() => go({ kind: 'shape-libraries' })}
        depth={0}
      />
      <SidebarRow
        icon={<TrashIcon />}
        label="Trash"
        selected={selected.kind === 'trash'}
        onClick={() => go({ kind: 'trash' })}
        depth={0}
      />
    </>
  );
}
