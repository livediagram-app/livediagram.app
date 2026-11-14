'use client';

// Adding pictures to a Several Images field (docs/specs/026-plan/item-types.md "Image fields"): from the card panel's
// picker or a drop. Every file is checked before anything is sent (PNG, JPEG, WebP or GIF, up to 10 MB, not empty)
// and gets its own place in the queue, shown as its own tile; files upload one after another, and each joins the end
// of the field's list as it lands, in one write of the list read from the card as it is then, so a picture someone
// else added meanwhile is kept. A file refused, past the field's 20, or a picture the field already holds is skipped
// and said; the rest still land. A file's tile can be cancelled (Work Tracker 794): a waiting one leaves the queue, an
// uploading one stops, and one that had already finished is not added; nothing is said either way.
import { useCallback, useRef, useState } from 'react';
import {
  IMAGE_FIELD_PICTURES_MAX,
  imageFieldValue,
  storedImageIds,
  withImagesAdded,
  type CustomFieldDef,
} from '@liveplanner/items';
import { ImageUploadError, apiUploadImage, checkImageFile } from '@/lib/api/images';
import { track } from '@/lib/telemetry';
import { useIsOfflineProject } from '@/hooks/persistence/useIsOfflineProject';
import { isOfflineId } from '@/lib/offline/offline-store';
import { usePlanCard, usePlanLatest } from './PlanCardContext';
import { ATTACHMENTS_OFFLINE } from './use-attachment-upload';
import { uploadPercent } from './UploadRing';

const IMAGE_UNAVAILABLE = "Image uploads aren't available here.";
const IMAGE_NOT_SAVED = "The image couldn't be added to the card. Try again.";

/** What a full field says: "Designs holds up to 20." */
export const imagesFullMessage = (label: string) =>
  `${label} holds up to ${IMAGE_FIELD_PICTURES_MAX}.`;

/** What a picture the field already holds says (the same bytes are the same media id): "photo.png is already in
 *  Designs." */
export const imagesDuplicateMessage = (name: string, label: string) =>
  `${name} is already in ${label}.`;

/** A file on its way: waiting its turn, or uploading, with the share of its bytes sent (0 to 1, in whole percents)
 *  once the browser says. */
export type PendingImage = {
  key: number;
  name: string;
  state: 'waiting' | 'uploading';
  progress?: number;
};

export type ImageFieldUpload = {
  // Whether this person may add pictures here (a writer, a plan the server holds, a media service).
  canAdd: boolean;
  // Why not, when it is the plan or the server (null otherwise: a reader simply sees no Add tile).
  blocked: string | null;
  // The files still to land, in order, each drawn as its own tile.
  pending: readonly PendingImage[];
  // What was skipped or failed, a line each, from the last files added.
  problems: readonly string[];
  add: (files: readonly File[]) => Promise<void>;
  // Stops pending file `key` and takes its tile away, saying nothing.
  cancel: (key: number) => void;
};

/** Uploads into card `itemId`'s Several Images field `field`. `canEdit`: whether this person may change its fields. */
export function useImageFieldUpload(
  itemId: string,
  field: CustomFieldDef,
  canEdit: boolean,
): ImageFieldUpload {
  const scope = usePlanCard()?.itemsScope ?? null;
  const offline = useIsOfflineProject(scope?.projectId ?? null);
  const planRef = usePlanLatest();
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  // One queue: files added while others upload wait behind them, so the order is the order they were given.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const nextKey = useRef(0);
  const blocked = offline ? ATTACHMENTS_OFFLINE : unavailable ? IMAGE_UNAVAILABLE : null;
  const canAdd = canEdit && !!scope && !blocked;
  const { id: fieldId, label } = field;
  const pendingCount = useRef(0);
  // The keys still pending (each settled once, by its end or its cancel), those cancelled, and each upload's stop.
  const live = useRef(new Set<number>());
  const cancelled = useRef(new Set<number>());
  const stops = useRef(new Map<number, AbortController>());

  const settle = useCallback((key: number) => {
    if (!live.current.delete(key)) return;
    pendingCount.current -= 1;
    setPending((p) => p.filter((j) => j.key !== key));
  }, []);

  const cancel = useCallback(
    (key: number) => {
      if (!live.current.has(key)) return;
      cancelled.current.add(key);
      stops.current.get(key)?.abort();
      settle(key);
    },
    [settle],
  );

  const add = useCallback(
    async (files: readonly File[]) => {
      const now = planRef.current;
      const item = now?.items.get(itemId);
      if (!canAdd || !scope || !now || !item || files.length === 0) return;
      // A This Browser plan takes none (its pictures would never be reported, and the sweep would take them).
      if (await isOfflineId(scope.projectId)) {
        setProblems([ATTACHMENTS_OFFLINE]);
        return;
      }
      const said: string[] = [];
      let room =
        IMAGE_FIELD_PICTURES_MAX -
        storedImageIds(item.fields[fieldId]).length -
        pendingCount.current;
      const taken: PendingImage[] = [];
      const fileOf = new Map<number, File>();
      for (const file of files) {
        try {
          checkImageFile(file);
        } catch (err) {
          const refused =
            err instanceof ImageUploadError ? err : new ImageUploadError('upload_failed');
          said.push(`${file.name || 'That file'}: ${refused.message}`);
          continue;
        }
        if (room <= 0) {
          if (!said.includes(imagesFullMessage(label))) said.push(imagesFullMessage(label));
          continue;
        }
        room -= 1;
        const key = nextKey.current++;
        taken.push({ key, name: file.name || 'image', state: 'waiting' });
        fileOf.set(key, file);
      }
      setProblems(said);
      if (taken.length === 0) return;
      pendingCount.current += taken.length;
      for (const job of taken) live.current.add(job.key);
      setPending((p) => [...p, ...taken]);

      const run = async () => {
        let landed = 0;
        for (const job of taken) {
          if (cancelled.current.delete(job.key)) continue;
          setPending((p) => p.map((j) => (j.key === job.key ? { ...j, state: 'uploading' } : j)));
          const stop = new AbortController();
          stops.current.set(job.key, stop);
          try {
            let shown = -1;
            const { image } = await apiUploadImage(scope, fileOf.get(job.key)!, {
              signal: stop.signal,
              // Whole percents only, so a fast line draws the tile at most 100 times.
              onProgress: (sent) => {
                const percent = uploadPercent(sent);
                if (percent === shown) return;
                shown = percent;
                setPending((p) =>
                  p.map((j) => (j.key === job.key ? { ...j, progress: percent / 100 } : j)),
                );
              },
            });
            // Cancelled as it finished: the field never takes it (it stays in the uploader's gallery).
            if (stop.signal.aborted) continue;
            const latest = planRef.current;
            const card = latest?.items.get(itemId);
            const def = latest?.types
              .find((t) => t.id === card?.type)
              ?.custom?.find((c) => c.id === fieldId);
            if (latest && card) {
              const had = storedImageIds(card.fields[fieldId]);
              const { ids, skipped } = withImagesAdded(had, [image.id]);
              if (skipped > 0) said.push(imagesFullMessage(label));
              else if (ids.length === had.length)
                said.push(imagesDuplicateMessage(job.name, label));
              else {
                // Never empty here: it holds the picture that just landed.
                const saved = await latest.patchItem(itemId, {
                  set: { [fieldId]: imageFieldValue(def ?? field, ids)! },
                });
                if (saved) landed += 1;
                else said.push(`${job.name}: ${IMAGE_NOT_SAVED}`);
              }
            }
          } catch (err) {
            if (stop.signal.aborted) continue;
            const refused =
              err instanceof ImageUploadError ? err : new ImageUploadError('upload_failed');
            if (refused.code === 'images_unavailable') setUnavailable(true);
            said.push(`${job.name}: ${refused.message}`);
          } finally {
            stops.current.delete(job.key);
            cancelled.current.delete(job.key);
            settle(job.key);
          }
        }
        setProblems([...said]);
        if (landed > 0) {
          track('Plan', 'Added', 'CardImage');
          planRef.current?.announce(landed === 1 ? 'Image added' : `${landed} images added`);
        }
      };
      const turn = queue.current.then(run);
      queue.current = turn.catch(() => {});
      await turn;
    },
    [canAdd, scope, itemId, fieldId, label, field, planRef, settle],
  );

  return { canAdd, blocked, pending, problems, add, cancel };
}
