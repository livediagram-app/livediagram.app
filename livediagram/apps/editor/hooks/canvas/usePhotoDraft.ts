'use client';

import { useCallback, useRef, useState } from 'react';
import {
  acceptDraft,
  boardNotesOfElements,
  discardDraft,
  draftNotesOf,
  reconcilePhoto,
  unionRects,
} from '@livediagram/document';
import type { DetectedSticky } from '@livediagram/sticky-vision';
import { selectReader } from '@/lib/reading/select';
import type { ReadOptions } from '@/lib/reading/types';
import { usePhotoReread } from './usePhotoReread';
import { setPhotoDraftView } from '@/lib/photo-draft-preview';
import type { PhotoDetection } from '@/lib/photo-detect';
import { photoTypeError } from '@/lib/photo-accept';
import { detectorTelemetryType } from '@/lib/photo-model/telemetry';
import { track } from '@/lib/telemetry';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import {
  BUSY_TOASTS,
  EMPTY,
  ERROR_TOASTS,
  NO_NOTES_TOAST,
  REREAD_FAILED_TOAST,
  buildDraftNotes,
  toPhotoNotes,
  type PhotoDraftApi,
  type PhotoDraftDeps,
  type PhotoDraftState,
  type PhotoReview,
} from './photo-draft';

export type { PhotoDraftStage, PhotoDraftState, PhotoReview } from './photo-draft';

// A photo import, as ONE long gesture (docs/specs/021-event-storming/event-storming.md Phase 8, Phase 9).
//
//   idle → detecting → reading → review → draft → committing → idle
//                        ↘          ↘
//                    error (a toast; the entry points come back)
//
// The review is a THREE-STEP wizard (docs/specs/021-event-storming/event-storming.md Phase 9): the photo with every
// detected box (step 1), the words (step 2), then Add lands the ticked notes
// on the canvas as the draft (step 3). The review itself never touches the
// document — a checkpoint is armed only when Add lands, so the whole import is
// still one undoable step, and Discard restores the armed snapshot.

export function usePhotoDraft(deps: PhotoDraftDeps): PhotoDraftApi {
  const [state, setState] = useState<PhotoDraftState>(EMPTY);
  const [review, setReview] = useState<PhotoReview | null>(null);
  // Latest review, for guards inside callbacks whose deps do not re-run on it.
  const reviewRef = useLatest<PhotoReview | null>(review);
  const abortRef = useRef<AbortController | null>(null);
  // The object URL the overlay is showing. Held so it can be handed back to
  // the browser when the review closes: an unrevoked one pins the whole
  // photograph in memory for the life of the tab, and a wall photo is 3MB.
  const photoUrlRef = useRef<string | null>(null);
  // Which run is current. A run has two awaits before it is abortable, and
  // Cancel pressed in that window must not land a draft over a board the
  // author has moved on from.
  const runRef = useRef(0);
  // Whether this session armed the landing's checkpoint, so Discard knows it
  // has a step to cancel back to.
  const checkpointedRef = useRef(false);
  const live = useLatest(deps);
  // The photo as picked, kept for the review's life: a box the author moves
  // is cut again from it, at full resolution.
  const fileRef = useRef<File | null>(null);
  // One model, one queue: the first read and every re-read take turns.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((job: () => Promise<void>) => {
    queueRef.current = queueRef.current.then(job).catch((err) => {
      console.warn('[photo] a queued read failed', err);
    });
  }, []);

  const draftOpen = draftNotesOf(deps.activeTab.elements).length > 0;

  const fail = useCallback(
    (token: string) => {
      setState({ ...EMPTY, error: token });
      live.current.toastError(ERROR_TOASTS[token] ?? ERROR_TOASTS.ai_error!);
    },
    [live],
  );

  // Close the review and give the photograph back to the browser.
  const closeReview = useCallback(() => {
    if (photoUrlRef.current) {
      URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = null;
    }
    fileRef.current = null;
    setReview(null);
  }, []);

  // Hand the thread back long enough for the browser to paint what was just
  // set, before taking it again for work that will block. Two frames, because
  // one only guarantees the render has been COMMITTED, not that pixels reached
  // the screen. Falls back to a timeout where there are no frames (tests, and
  // a backgrounded tab, where rAF never fires at all).
  const nextPaint = useCallback(
    () =>
      new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame !== 'function') {
          setTimeout(resolve, 0);
          return;
        }
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
    [],
  );

  // Fit a rectangle around the given elements, with a little margin: an import
  // that lands off-screen reads as an import that did nothing. Never zoomed in
  // past life size.
  const frameElements = useCallback(
    (els: readonly { x: number; y: number; width: number; height: number }[]) => {
      const b = unionRects(els);
      if (!b) return;
      const margin = 120;
      live.current.fitToBounds(
        {
          x: b.x - margin,
          y: b.y - margin,
          w: b.width + margin * 2,
          h: b.height + margin * 2,
        },
        { maxZoom: 1 },
      );
    },
    [live],
  );

  // The words arrive AFTER the review is already on screen: the crops are read
  // in the background and the text fields fill in batch by batch. A failure
  // leaves the fields blank and says why; the photo and boxes stay.
  // What any read tells the review besides the words: where it runs, why,
  // the model download, and a budget failover (docs/specs/021-event-storming/event-storming.md Phase 9).
  const readerCallbacks = useCallback((run: number): ReadOptions => {
    const current = () => runRef.current === run;
    return {
      onModelDownload: (modelDownload) => {
        if (!current()) return;
        setState((s) => (s.stage === 'review' ? { ...s, modelDownload } : s));
      },
      onBackend: (readerBackend, readerWhy) => {
        if (!current()) return;
        setState((s) => (s.stage === 'review' ? { ...s, readerBackend, readerWhy } : s));
      },
      // The hosted budget is spent: say so on the review, and warn the
      // error telemetry once, with closed values only (docs/specs/017-telemetry/telemetry.md).
      onFallback: (readerFallback) => {
        if (!current()) return;
        track('Error', 'Warning', 'AiQuota.BrowserReader');
        setState((s) => (s.stage === 'review' ? { ...s, readerFallback } : s));
      },
    };
  }, []);

  const readWords = useCallback(
    async (detection: PhotoDetection, controller: AbortController, run: number) => {
      const current = () => runRef.current === run;
      try {
        const { read } = selectReader({
          aiEnabled: live.current.aiEnabled,
          ownerId: live.current.ownerId,
        });
        const answer = await read(detection.crops, {
          signal: controller.signal,
          onProgress: (readSoFar) => {
            if (!current()) return;
            setState((s) => (s.stage === 'review' ? { ...s, readSoFar } : s));
          },
          ...readerCallbacks(run),
          // Each note's words as they are read: the photo fills in note by
          // note, rather than a wall of blanks until the last one is done.
          onText: (cropId, read) => {
            if (!current()) return;
            setReview((prev) =>
              prev && prev.detection === detection
                ? { ...prev, textById: new Map(prev.textById).set(cropId, read) }
                : prev,
            );
          },
        });
        if (!current()) return;
        setReview((prev) =>
          prev && prev.detection === detection
            ? {
                ...prev,
                textById: answer.textById,
                // Part of the run is not all of it. The words that arrived are
                // shown; the note that says so names how many did not.
                // A reader that never started is its own failure, not part of a run.
                readError: !answer.failure
                  ? prev.readError
                  : answer.failure === 'reader_unavailable'
                    ? 'reader_unavailable'
                    : `partial:${answer.unread ?? 0}`,
              }
            : prev,
        );
        if (answer.failure === 'reader_unavailable') {
          live.current.toastError(
            `The reading model couldn't start in this browser (${answer.detail ?? 'unknown reason'}). Type the words in yourself, or try again later.`,
          );
        } else if (answer.failure) {
          live.current.toastError(
            `${answer.unread ?? 0} notes could not be read (${answer.failure}). Type those in yourself.`,
          );
        }
      } catch (err) {
        if (controller.signal.aborted || !current()) return;
        const token = err instanceof Error ? err.message : 'ai_error';
        setReview((prev) =>
          prev && prev.detection === detection ? { ...prev, readError: token } : prev,
        );
        live.current.toastError(ERROR_TOASTS[token] ?? ERROR_TOASTS.ai_error!);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [readerCallbacks, live],
  );

  // A box the author moved, resized or drew, read again (docs/specs/021-event-storming/event-storming.md Phase 9).
  const { rereading, reread, cancelRereads } = usePhotoReread({
    source: () => {
      const imageSize = reviewRef.current?.detection?.imageSize;
      const file = fileRef.current;
      return file && imageSize ? { run: runRef.current, file, imageSize } : null;
    },
    isCurrent: (run) => runRef.current === run,
    enqueue,
    reader: () =>
      selectReader({ aiEnabled: live.current.aiEnabled, ownerId: live.current.ownerId }).read,
    readOptions: readerCallbacks,
    onText: (run, id, read) => {
      if (runRef.current !== run) return;
      setReview((prev) =>
        prev ? { ...prev, textById: new Map(prev.textById).set(id, read) } : prev,
      );
    },
    onError: () => live.current.toastError(REREAD_FAILED_TOAST),
  });

  const startFromFile = useCallback(
    async (file: File) => {
      const d = live.current;
      // One draft at a time, and never where the drop would be refused — a
      // review in progress counts as one, even though nothing has landed yet.
      //
      // Every refusal SPEAKS. Returning quietly here is how picking a photo
      // came to look like a broken button: the author gets no overlay and no
      // message, so the only theory left is that the click did not register,
      // and the next move is to click again — which is refused just as quietly.
      if (reviewRef.current !== null) {
        d.toastError(BUSY_TOASTS.review);
        return;
      }
      if (draftNotesOf(d.activeTab.elements).length > 0) {
        d.toastError(BUSY_TOASTS.draft);
        return;
      }
      if (d.createBlocked) {
        d.toastError(BUSY_TOASTS.blocked);
        return;
      }
      // A file we cannot decode at all is refused before anything opens: an
      // overlay showing a broken image is worse than a straight answer.
      const typeError = photoTypeError(file.type);
      if (typeError) {
        fail(typeError);
        return;
      }

      const run = (runRef.current += 1);
      const current = () => runRef.current === run;

      const controller = new AbortController();
      abortRef.current = controller;

      // THE PHOTO GOES UP FIRST. An object URL costs nothing to make and the
      // browser decodes it for display on its own thread, so the author sees
      // the wall they just picked while the detector is still walking it.
      const photoUrl = URL.createObjectURL(file);
      photoUrlRef.current = photoUrl;
      fileRef.current = file;
      setReview({
        photoUrl,
        photoName: file.name,
        detection: null,
        textById: new Map(),
        readError: null,
      });
      setState({ stage: 'review', found: 0, readSoFar: 0, error: null });

      // Let the browser actually PAINT that before the detector takes the
      // thread. Detection is synchronous number-crunching over a few million
      // pixels; without this yield React's state change and the blocking work
      // land in the same frame and the overlay never appears until it is over.
      await nextPaint();
      if (!current()) return;

      // Finding the stickies happens HERE, in the browser: the photograph
      // never leaves the machine, only the crops do.
      let detection: PhotoDetection;
      // The detection pipeline (and the sticky detector in it) loads only now, once a photo is
      // picked: most documents never import one (docs/specs/016-platform/web-performance.md).
      let pipeline: typeof import('@/lib/photo-detect') | null = null;
      try {
        pipeline = await import('@/lib/photo-detect');
        detection = await pipeline.detectAndCrop(file, { signal: controller.signal });
      } catch (err) {
        abortRef.current = null;
        if (!current()) return;
        closeReview();
        fail(
          pipeline && err instanceof pipeline.PhotoDetectFailed ? err.reason : 'photo_unreadable',
        );
        return;
      }
      if (!current()) return;
      track('AI', 'Used', detectorTelemetryType(detection.detector));

      setReview((prev) => (prev ? { ...prev, detection } : prev));
      setState({
        stage: 'review',
        found: detection.stickies.length,
        readSoFar: 0,
        error: null,
      });

      if (detection.stickies.length === 0) {
        // No paper in the picture. The photo STAYS on screen with the advice:
        // "shoot straighter, fill the frame" is advice about this photograph,
        // and closing the dialog throws away the thing it is about. Never spend
        // a model call on it.
        abortRef.current = null;
        live.current.toastError(NO_NOTES_TOAST);
        return;
      }

      enqueue(() => readWords(detection, controller, run));
    },
    [closeReview, enqueue, fail, nextPaint, readWords, reviewRef, live],
  );

  // Add the ticked boxes as the on-canvas draft. The one write of the review:
  // arm the checkpoint, reconcile the ticked notes against the board as it is
  // NOW (a peer may have added the very note the photo shows), and land them.
  // `kept` is every box that lands, as the author left it: moved, resized,
  // re-kinded or drawn; `texts` the words on each, as edited.
  const confirm = useCallback(
    (kept: DetectedSticky[], texts: Map<number, { text: string; legible: boolean }>) => {
      const d = live.current;
      // Nothing to land before the detector has answered — the Add button is
      // disabled then, and a drawn box cannot exist without the image data
      // that classifies it.
      if (!review?.detection) return;
      const found = review.detection;
      const detection: PhotoDetection = {
        ...found,
        stickies: kept,
      };
      if (detection.stickies.length === 0) return;
      const existing = boardNotesOfElements(d.activeTab.elements);
      const result = reconcilePhoto(toPhotoNotes(detection, texts), existing);
      // Nothing usable in the photo at all: close the review and say so. A
      // photo whose notes are ALL already on the board is not this case — it
      // lands nothing but still publishes what it matched and how it differed.
      if (result.additions.length === 0 && result.matches.length === 0) {
        setReview(null);
        setState(EMPTY);
        d.toastError(NO_NOTES_TOAST);
        return;
      }
      const matchedIds = new Set(result.matches.map((m) => m.boardId));
      checkpointedRef.current = true;
      d.markCheckpoint();
      const finalNotes = buildDraftNotes(result.additions, d.activeTab);
      d.tick((els) => [...els, ...finalNotes]);
      d.setSelectedId(null);
      d.setMultiSelectedIds(new Set(finalNotes.map((el) => el.id)));
      frameElements([...finalNotes, ...existing.filter((e) => matchedIds.has(e.id))]);
      setPhotoDraftView({
        matchedIds,
        differences: new Map(
          result.differences
            .map((diff) => [diff.boardId, texts.get(diff.detectedId)?.text ?? ''] as const)
            .filter(([, text]) => text !== ''),
        ),
        read: found.stickies.length,
      });
      // The words on screen are what landed: a re-read still pending is moot.
      runRef.current += 1;
      cancelRereads();
      fileRef.current = null;
      setReview(null);
      setState({
        stage: 'draft',
        found: found.stickies.length,
        readSoFar: found.stickies.length,
        error: null,
      });
    },
    [review, frameElements, cancelRereads, live],
  );

  const cancelReview = useCallback(() => {
    // Leaving the review also cancels the in-flight read, if it is still going.
    runRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    cancelRereads();
    closeReview();
    setState(EMPTY);
  }, [closeReview, cancelRereads]);

  const accept = useCallback(() => {
    const d = live.current;
    const drafts = draftNotesOf(d.activeTab.elements);
    if (drafts.length === 0) return;
    setState((s) => ({ ...s, stage: 'committing' }));
    // The flag comes off; the notes stay exactly where the author left them.
    // The history step armed at landing is what Undo returns to, so the whole
    // import — the landing AND every correction — is one step.
    const after = acceptDraft(d.activeTab.elements);
    d.tick(() => after);
    track('AI', 'Used', 'PhotoNotes');
    for (const _ of drafts) track('Element', 'Added', 'Sticky');
    checkpointedRef.current = false;
    setPhotoDraftView(null);
    setState(EMPTY);
  }, [live]);

  const discard = useCallback(() => {
    const d = live.current;
    if (draftNotesOf(d.activeTab.elements).length === 0) return;
    if (checkpointedRef.current) {
      // The ordinary cancel path: restore the armed snapshot and throw the
      // step away, so a discarded import leaves no trace in the undo stack.
      d.cancelToCheckpoint();
    } else {
      // A draft that outlived its session (a reload) has no checkpoint to go
      // back to, so it is removed as an ordinary edit instead.
      d.tick((els) => discardDraft(els));
    }
    checkpointedRef.current = false;
    setPhotoDraftView(null);
    setState(EMPTY);
  }, [live]);

  const cancelReading = useCallback(() => {
    runRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    cancelRereads();
    setState(EMPTY);
  }, [cancelRereads]);

  return {
    state,
    review,
    reviewOpen: review !== null,
    draftOpen,
    startFromFile,
    confirm,
    cancelReview,
    accept,
    discard,
    cancelReading,
    rereading,
    reread,
  };
}
