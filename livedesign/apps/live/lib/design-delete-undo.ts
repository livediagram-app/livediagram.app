// Deleting the design open in the editor (docs/specs/013-workspace/trash.md "Deleting"): the shared handoff
// (@liveworkspace/workbench/lib/open-item-delete-undo), bound to this editor's key, design tombstones
// (lib/design-tombstones.ts) and telemetry.
import {
  openItemDeleteUndo,
  type TrashedItem,
} from '@liveworkspace/workbench/lib/open-item-delete-undo';
import { markDesignDeleted, unmarkDesignDeleted } from '@/lib/design-tombstones';
import { track } from '@/lib/telemetry';

export type TrashedDesign = TrashedItem;

const deleteUndo = openItemDeleteUndo({
  key: 'livedesign:deleted-design',
  markDeleted: markDesignDeleted,
  unmarkDeleted: unmarkDesignDeleted,
  onDeleted: () => track('Document', 'Deleted'),
});

export const trashOpenDesign = deleteUndo.trashOpen;
export const handOffDeleteUndo = deleteUndo.handOff;
export const takeDeleteUndo = deleteUndo.take;
export const arrivedTrashed = deleteUndo.arrived;
