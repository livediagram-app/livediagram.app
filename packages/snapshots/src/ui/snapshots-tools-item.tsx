'use client';

// The Snapshots row in the footer's Tools menu (liveworkspace/docs/specs/014-snapshots/snapshots.md "In the editor";
// blueprint SN23): there only inside a door, so only for someone who may use snapshots; the Explorer's bar has none.

import type { ChromeToolsItem } from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
import { useSnapshotsDoor } from './door';
import { SnapshotGlyph } from './glyphs';

export function useSnapshotsToolsItem(): ChromeToolsItem | null {
  const door = useSnapshotsDoor();
  if (!door) return null;
  return {
    id: 'snapshots',
    group: 'versions',
    label: 'Snapshots',
    description: `Save points for the whole ${door.door.noun}.`,
    icon: <SnapshotGlyph size={16} />,
    // Its dialog opens inside Tools (footer-tools-menu.md "Opening a tool inside Tools").
    inPlace: true,
    onSelect: door.open,
  };
}
