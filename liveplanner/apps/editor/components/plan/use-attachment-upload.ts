'use client';

// Adding pictures to a card's Attachments (docs/specs/026-plan/items.md "Attachments"): from the card panel's picker,
// a drop on it or on a board's card, and a paste. Each file uploads through the plan's images route, one after
// another, then every one that landed joins the end of the card's list in one write (one undo step), read from the
// card as it is then, so a change made meanwhile is kept. A file past the card's cap, or one refused, is skipped and
// said; the rest still land.
import { useCallback, useRef, useState } from 'react';
import {
  ITEM_ATTACHMENTS_MAX,
  attachmentName,
  isAcceptedAttachmentType,
  itemAttachments,
  withAttachmentsAdded,
  type ItemAttachment,
} from '@liveplanner/items';
import { ImageUploadError, apiUploadImage } from '@/lib/api/images';
import { track } from '@/lib/telemetry';
import { useIsOfflineProject } from '@/hooks/persistence/useIsOfflineProject';
import { isOfflineId } from '@/lib/offline/offline-store';
import { usePlan } from './PlanContext';

export const ATTACHMENTS_FULL = `A card holds up to ${ITEM_ATTACHMENTS_MAX} images.`;
export const ATTACHMENTS_OFFLINE = 'Save this plan to your account to add images.';
const IMAGE_UNAVAILABLE = "Image uploads aren't available here.";
const IMAGE_NOT_SAVED = "The images couldn't be added to the card. Try again.";


export type AttachmentUpload = {
  // Whether this person may add pictures to the card here (a writer, a plan the server holds, a media service).
  canAdd: boolean;
  // Why not, when it is the plan or the server (null otherwise: a reader simply sees no zone).
  blocked: string | null;
  // How many files are still uploading (0: none).
  uploading: number;
  error: string | null;
  // Answers what went wrong, in words to show (null: every file landed).
  add: (files: readonly File[]) => Promise<string | null>;
  clearError: () => void;
};

/** The image files among `list` (a drop, a paste, a picker), in order. */
export function imageFilesOf(list: FileList | readonly File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
}

/** Uploads for card `itemId`. `canEdit`: whether this person may change the card's fields. `watchOffline`: whether
 *  to know up front that the plan is in This Browser (the panel says so); a board's cards, of which there may be
 *  thousands, leave it off and check when a file is dropped. */
export function useAttachmentUpload(
  itemId: string,
  canEdit: boolean,
  { watchOffline = true }: { watchOffline?: boolean } = {},
): AttachmentUpload {
  const plan = usePlan();
  const scope = plan?.itemsScope ?? null;
  const offline = useIsOfflineProject(watchOffline ? (scope?.projectId ?? null) : null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  // The plan as it is now, read when the uploads end (the closure's would be stale by then).
  const planRef = useRef(plan);
  planRef.current = plan;
  const blocked = offline ? ATTACHMENTS_OFFLINE : unavailable ? IMAGE_UNAVAILABLE : null;
  const canAdd = canEdit && !!scope && !blocked;

  const add = useCallback(
    async (files: readonly File[]) => {
      const now = planRef.current;
      const item = now?.items.get(itemId);
      if (!canAdd || !scope || !now || !item || files.length === 0) return null;
      setError(null);
      // A This Browser plan takes none (its pictures would never be reported, and the sweep would take them).
      if (await isOfflineId(scope.projectId)) {
        setError(ATTACHMENTS_OFFLINE);
        return ATTACHMENTS_OFFLINE;
      }
      const room = ITEM_ATTACHMENTS_MAX - itemAttachments(item).length;
      const taken = files.slice(0, Math.max(0, room));
      let failure: string | null = taken.length < files.length ? ATTACHMENTS_FULL : null;
      const added: ItemAttachment[] = [];
      setUploading(taken.length);
      for (const file of taken) {
        try {
          const { image } = await apiUploadImage(scope, file);
          added.push({
            id: image.id,
            name: attachmentName(file.name || image.originalName || ''),
            size: image.byteSize,
            type: isAcceptedAttachmentType(image.contentType) ? image.contentType : 'image/png',
          });
        } catch (err) {
          const refused = err instanceof ImageUploadError ? err : new ImageUploadError('upload_failed');
          if (refused.code === 'images_unavailable') setUnavailable(true);
          failure ??= refused.message;
        } finally {
          setUploading((n) => Math.max(0, n - 1));
        }
      }
      if (added.length > 0) {
        const latest = planRef.current;
        const card = latest?.items.get(itemId);
        if (latest && card) {
          const { list, skipped } = withAttachmentsAdded(itemAttachments(card), added);
          if (skipped > 0) failure ??= ATTACHMENTS_FULL;
          const saved = await latest.patchItem(itemId, { set: { attachments: list } });
          if (saved) {
            track('Plan', 'Added', 'CardAttachment');
            latest.announce(
              added.length === 1 ? 'Image attached' : `${added.length} images attached`,
            );
          } else failure ??= IMAGE_NOT_SAVED;
        }
      }
      setError(failure);
      return failure;
    },
    [canAdd, scope, itemId],
  );

  return {
    canAdd,
    blocked,
    uploading,
    error,
    add,
    clearError: useCallback(() => setError(null), []),
  };
}
