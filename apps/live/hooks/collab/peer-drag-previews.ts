// Collaborators' live drags (docs/specs/008-canvas/drag-preview.md "Live movement for collaborators"):
// a peer's `drag-preview` op becomes their preview in the store, drawn without writing anything. It
// ends on their end message, when their real change arrives, when they leave, or after
// PEER_PREVIEW_EXPIRY_MS without a message. Only an editor's preview is drawn.

import type { RoomOp } from '@livediagram/api-schema';
import { parseDragPreviewPatches } from '@livediagram/api-schema';
import { debugLog } from '@/lib/debug-log';
import { clearPeerPreview, peerPreviewIds, setPeerPreview } from '@/lib/drag-preview';

export const PEER_PREVIEW_EXPIRY_MS = 2000;

type DragPreviewOp = Extract<RoomOp, { kind: 'drag-preview' }>;

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const warned = new Set<string>();

function stop(presenceId: string): void {
  const timer = timers.get(presenceId);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(presenceId);
  clearPeerPreview(presenceId);
}

function warnOnce(presenceId: string, message: string): void {
  const key = `${message}:${presenceId}`;
  if (warned.has(key)) return;
  warned.add(key);
  debugLog(message, { presenceId });
}

export function receivePeerDragPreview(
  presenceId: string,
  op: DragPreviewOp,
  roleOf: (presenceId: string) => string | undefined,
): void {
  if (roleOf(presenceId) !== 'edit') {
    warnOnce(presenceId, '[drag-preview] peer ignored');
    return;
  }
  if (op.end) {
    stop(presenceId);
    return;
  }
  const patches = typeof op.tabId === 'string' ? parseDragPreviewPatches(op.patches) : null;
  if (!patches) {
    warnOnce(presenceId, '[drag-preview] bad op');
    return;
  }
  setPeerPreview(presenceId, op.tabId, patches);
  const timer = timers.get(presenceId);
  if (timer !== undefined) clearTimeout(timer);
  timers.set(
    presenceId,
    setTimeout(() => {
      debugLog('[drag-preview] peer expired', { presenceId });
      stop(presenceId);
    }, PEER_PREVIEW_EXPIRY_MS),
  );
}

// The dragger's real change has arrived: their preview has done its job.
export function endPeerDragPreview(presenceId: string): void {
  if (timers.has(presenceId)) stop(presenceId);
}

// Peers who left take their previews with them.
export function prunePeerDragPreviews(present: ReadonlySet<string>): void {
  for (const id of peerPreviewIds()) if (!present.has(id)) stop(id);
}

export function resetPeerDragPreviewsForTests(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  warned.clear();
}
