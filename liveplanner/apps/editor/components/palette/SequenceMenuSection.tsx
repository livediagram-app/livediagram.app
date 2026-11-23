'use client';

import type { ShapeElement } from '@liveplanner/project';
import { MenuDialogSection } from '@liveworkspace/workbench/components/primitives/MenuDialogSection';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';

// A sequence diagram's row (docs/specs/009-elements/sequence-diagram.md "The menu"): it opens the Sequence dialog,
// where its participants, its messages and Numbered are. The menu holds the row alone: a setting never sits loose
// in the menu's list. Play is a category of the menu's Animation row (ElementAnimationTiles).
export function SequenceMenuSection({
  target,
  onEdit,
}: {
  target: ShapeElement;
  // Opens the Sequence dialog; absent when this session may not edit the diagram, which then has no row.
  onEdit?: (elementId: string) => void;
}) {
  if (!onEdit) return null;
  return (
    <MenuDialogSection
      title="Sequence"
      icon={<DataMenuGlyph />}
      onOpen={() => onEdit(target.id)}
      flush
    />
  );
}
