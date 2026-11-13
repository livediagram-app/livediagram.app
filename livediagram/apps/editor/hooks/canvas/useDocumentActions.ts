// The editor's verbs on whole items (@liveworkspace/workbench/hooks/canvas/useDocumentActions), bound to this
// editor's telemetry, Trash step, share password and failure copy.
import { createDocumentActions } from '@liveworkspace/workbench/hooks/canvas/useDocumentActions';
import { track } from '@/lib/telemetry';
import { trashOpenDocument } from '@/lib/document-delete-undo';
import { getSessionSharePassword } from '@/lib/api-client';
import { DOCUMENT_FAILURE } from '@/lib/write-failure-copy';

export const useDocumentActions = createDocumentActions({
  track,
  trashOpenDocument,
  getSessionSharePassword,
  DOCUMENT_FAILURE,
});
