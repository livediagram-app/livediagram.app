// Deleting the document open in the editor (docs/specs/013-workspace/trash.md "Deleting"): the shared handoff
// (@liveworkspace/workbench/lib/open-item-delete-undo), bound to this editor's tombstones and telemetry. The shared
// Explorer takes the document from its address alone: livehuddle hosts no workbench frame Explorer.
import {
  markDocumentDeleted,
  unmarkDocumentDeleted,
} from '@liveworkspace/workbench/lib/document-tombstones';
import { openItemDeleteUndo } from '@liveworkspace/workbench/lib/open-item-delete-undo';
import { track } from '@/lib/telemetry';

export const trashOpenDocument = openItemDeleteUndo({
  key: 'livehuddle:deleted-document',
  markDeleted: markDocumentDeleted,
  unmarkDeleted: unmarkDocumentDeleted,
  onDeleted: () => track('Document', 'Deleted'),
  handOff: false,
}).trashOpen;
