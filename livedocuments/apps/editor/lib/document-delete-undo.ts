// Deleting the document open in the editor (docs/specs/013-workspace/trash.md "Deleting"): the shared handoff
// (@liveworkspace/workbench/lib/open-item-delete-undo), bound to this editor's key, tombstones and telemetry.
import {
  markDocumentDeleted,
  unmarkDocumentDeleted,
} from '@liveworkspace/workbench/lib/document-tombstones';
import {
  openItemDeleteUndo,
  type TrashedItem,
} from '@liveworkspace/workbench/lib/open-item-delete-undo';
import { track } from '@/lib/telemetry';

export type TrashedDocument = TrashedItem;

const deleteUndo = openItemDeleteUndo({
  key: 'livedocuments:deleted-document',
  markDeleted: markDocumentDeleted,
  unmarkDeleted: unmarkDocumentDeleted,
  onDeleted: () => track('Document', 'Deleted'),
});

export const trashOpenDocument = deleteUndo.trashOpen;
export const handOffDeleteUndo = deleteUndo.handOff;
export const takeDeleteUndo = deleteUndo.take;
export const arrivedTrashed = deleteUndo.arrived;
