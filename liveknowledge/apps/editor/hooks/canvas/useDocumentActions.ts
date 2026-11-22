// The editor's verbs on whole items (@liveworkspace/workbench/hooks/canvas/useItemActions), bound to this
// editor's telemetry, Trash step, share password and failure copy.
import { createItemActions } from '@liveworkspace/workbench/hooks/canvas/useItemActions';
import { track } from '@/lib/telemetry';
import { trashOpenDocument } from '@/lib/document-delete-undo';
import { getSessionSharePassword } from '@/lib/api-client';
import { DOCUMENT_FAILURE } from '@/lib/write-failure-copy';

export const useDocumentActions = createItemActions({
  trackDuplicated: () => track('Document', 'Duplicated', 'Copy'),
  trackDeleted: () => track('Document', 'Deleted'),
  trashOpenDocument,
  getSessionSharePassword,
  DOCUMENT_FAILURE,
});
