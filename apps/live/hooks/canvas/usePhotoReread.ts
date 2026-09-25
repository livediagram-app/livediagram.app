'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { DetectedSticky } from '@livediagram/sticky-vision';
import { cropBoxes } from '@/lib/photo-detect';
import type { CropReader, ReadOptions, ReadText } from '@/lib/reading/types';

// Reading a box again after the author moved, resized or drew it (spec/139
// Phase 9). The crop is cut afresh from the FULL-resolution photo for the
// box's new rectangle and sent to the same reader; the new words replace the
// old ones as they arrive. The debounce and the "never over typed words" rule
// are the review's (useRereadOnChange); this is the reading.
export function usePhotoReread(deps: {
  // What the re-read is cut from: the photo as picked, the size its boxes are
  // measured in, and the run it belongs to. Null when there is no review.
  source: () => {
    run: number;
    file: Blob;
    imageSize: { width: number; height: number };
  } | null;
  isCurrent: (run: number) => boolean;
  // One model, one queue: a re-read waits for whatever is reading.
  enqueue: (job: () => Promise<void>) => void;
  reader: () => CropReader;
  // The reader's own callbacks for the review (backend, fallback, download).
  readOptions: (run: number) => ReadOptions;
  onText: (run: number, id: number, read: ReadText) => void;
  onError: (token: string) => void;
}) {
  // The latest options, for timers and queued jobs that outlive this render.
  const live = useRef(deps);
  useLayoutEffect(() => {
    live.current = deps;
  });
  // Boxes queued or being read again, for the review's pill.
  const [rereading, setRereading] = useState(0);
  const controllers = useRef(new Set<AbortController>());

  const reread = useCallback((boxes: DetectedSticky[]) => {
    const source = live.current.source();
    if (!source || boxes.length === 0) return;
    const { run, file, imageSize } = source;
    setRereading((n) => n + boxes.length);
    live.current.enqueue(async () => {
      const controller = new AbortController();
      controllers.current.add(controller);
      try {
        if (!live.current.isCurrent(run)) return;
        const crops = await cropBoxes(file, boxes, imageSize);
        if (crops.length === 0 || !live.current.isCurrent(run)) return;
        console.info(`[photo] reading ${crops.length} changed notes again`);
        const answer = await live.current.reader()(crops, {
          ...live.current.readOptions(run),
          signal: controller.signal,
          onText: (id, read) => live.current.onText(run, id, read),
        });
        if (!live.current.isCurrent(run)) return;
        // A server reader answers all at once, not note by note.
        for (const [id, read] of answer.textById) live.current.onText(run, id, read);
        if (answer.failure) console.warn(`[photo] re-read incomplete: ${answer.failure}`);
      } catch (err) {
        if (controller.signal.aborted || !live.current.isCurrent(run)) return;
        const token = err instanceof Error ? err.message : 'ai_error';
        console.warn(`[photo] re-read failed: ${token}`);
        live.current.onError(token);
      } finally {
        controllers.current.delete(controller);
        setRereading((n) => Math.max(0, n - boxes.length));
      }
    });
  }, []);

  // Leaving the review stops any re-read in flight.
  const cancelRereads = useCallback(() => {
    for (const c of controllers.current) c.abort();
    controllers.current.clear();
    setRereading(0);
  }, []);

  return { rereading, reread, cancelRereads };
}
