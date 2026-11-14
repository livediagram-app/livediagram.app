'use client';

// Adding pictures to a card's Attachments (docs/specs/026-plan/items.md "Attachments"): from the card panel's picker,
// a drop on it or on a board's card, and a paste. Each file uploads through the plan's images route, one after
// another, then every one that landed joins the end of the card's list in one write (one undo step), read from the
// card as it is then, so a change made meanwhile is kept. A file past the card's cap, or one refused, is skipped and
// said; the rest still land. Cancel (Work Tracker 794) stops the file going now and drops the rest, saying nothing;
// those already sent still land.
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
import { usePlanCard, usePlanLatest } from './PlanCardContext';
import { uploadPercent } from './UploadRing';

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
  // The share of the bytes sent of the file going now (0 to 1), or undefined until the browser says.
  progress: number | undefined;
  error: string | null;
  // Answers what went wrong, in words to show (null: every file landed).
  add: (files: readonly File[]) => Promise<string | null>;
  // Stops every upload going now and drops the files still to go.
  cancel: () => void;
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
  const scope = usePlanCard()?.itemsScope ?? null;
  const offline = useIsOfflineProject(watchOffline ? (scope?.projectId ?? null) : null);
  const [uploading, setUploading] = useState(0);
  // The share of the bytes sent of the file going now (0 to 1), once the browser says.
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  // The plan as it is now, read when the uploads end (the closure's would be stale by then).
  const planRef = usePlanLatest();
  // Each add's stop, while it uploads.
  const stops = useRef(new Set<AbortController>());
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
      const stop = new AbortController();
      stops.current.add(stop);
      let left = taken.length;
      setUploading((n) => n + left);
      for (const file of taken) {
        if (stop.signal.aborted) break;
        try {
          setProgress(undefined);
          let shown = -1;
          const { image } = await apiUploadImage(scope, file, {
            signal: stop.signal,
            // Whole percents only, so a fast line draws the zone at most 100 times.
            onProgress: (sent) => {
              const percent = uploadPercent(sent);
              if (percent === shown) return;
              shown = percent;
              setProgress(percent / 100);
            },
          });
          // Cancelled as it finished: not added (it stays in the uploader's gallery).
          if (stop.signal.aborted) break;
          added.push({
            id: image.id,
            name: attachmentName(file.name || image.originalName || ''),
            size: image.byteSize,
            type: isAcceptedAttachmentType(image.contentType) ? image.contentType : 'image/png',
          });
        } catch (err) {
          if (stop.signal.aborted) break;
          const refused =
            err instanceof ImageUploadError ? err : new ImageUploadError('upload_failed');
          if (refused.code === 'images_unavailable') setUnavailable(true);
          failure ??= refused.message;
        } finally {
          left -= 1;
          setUploading((n) => Math.max(0, n - 1));
        }
      }
      // The files a cancel dropped before their turn.
      if (left > 0) setUploading((n) => Math.max(0, n - left));
      stops.current.delete(stop);
      if (added.length > 0) {
        const latest = planRef.current;
        const card = latest?.items.get(itemId);
        if (latest && card) {
          const had = itemAttachments(card);
          const { list, skipped } = withAttachmentsAdded(had, added);
          if (skipped > 0) failure ??= ATTACHMENTS_FULL;
          // What lands is what the card had room for when the uploads ended (it may have filled meanwhile), and
          // only that is announced; nothing landing writes nothing.
          const landed = list.length - had.length;
          const saved =
            landed > 0 ? await latest.patchItem(itemId, { set: { attachments: list } }) : true;
          if (!saved) failure ??= IMAGE_NOT_SAVED;
          else if (landed > 0) {
            track('Plan', 'Added', 'CardAttachment');
            latest.announce(landed === 1 ? 'Image attached' : `${landed} images attached`);
          }
        }
      }
      setError(failure);
      return failure;
    },
    [canAdd, scope, itemId, planRef],
  );

  const cancel = useCallback(() => {
    for (const stop of stops.current) stop.abort();
  }, []);

  return {
    canAdd,
    blocked,
    uploading,
    progress,
    error,
    add,
    cancel,
  };
}
