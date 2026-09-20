'use client';

import { useCallback, useRef, useState } from 'react';
import {
  acceptDraft,
  boardNotesOfElements,
  discardDraft,
  draftNotesOf,
  eventStormingNoteSize,
  reconcilePhoto,
  type Element,
  type PhotoAddition,
  type PhotoNote,
  type StickyElement,
  type Tab,
} from '@livediagram/diagram';
import { toNormalised, type DetectedSticky } from '@livediagram/sticky-vision';
import { selectReader } from '@/lib/reading/select';
import { buildEventStormingNote } from '@/lib/draw-commit';
import { setPhotoDraftView } from '@/lib/photo-draft-preview';
import { detectAndCrop, PhotoDetectFailed, type PhotoDetection } from '@/lib/photo-detect';
import { track } from '@/lib/telemetry';

// A photo import, as ONE long gesture (spec/139 Phase 8, Phase 9).
//
//   idle → detecting → reading → review → draft → committing → idle
//                        ↘          ↘
//                    error (a toast; the entry points come back)
//
// The review is a THREE-STEP wizard (spec/139 Phase 9): the photo with every
// detected box (step 1), the words (step 2), then Add lands the ticked notes
// on the canvas as the draft (step 3). The review itself never touches the
// document — a checkpoint is armed only when Add lands, so the whole import is
// still one undoable step, and Discard restores the armed snapshot.

export type PhotoDraftStage =
  | 'idle'
  // Decoding the photo and finding the stickies in it, here in the browser.
  | 'detecting'
  // The wizard: photo + boxes immediately, then the words stream in behind
  // them (a SEPARATE stage, not a gate in front of the photo).
  | 'review'
  | 'draft'
  | 'committing';

export type PhotoDraftState = {
  stage: PhotoDraftStage;
  // How many stickies the detector found, for the progress line.
  found: number;
  // How many crops the reader has finished, for the progress bar.
  readSoFar: number;
  // The last failure's token, for the toast. Cleared by the next attempt.
  error: string | null;
};

const EMPTY: PhotoDraftState = { stage: 'idle', found: 0, readSoFar: 0, error: null };

// What the review overlay shows and, on Add, lands. `detection` carries the
// photo (photoUrl), every detected box and the crops that were read; `textById`
// is the reader's answer keyed by box id. `readError` is set when the reader
// failed but the boxes are still worth showing blank.
export type PhotoReview = {
  detection: PhotoDetection;
  textById: Map<number, { text: string; legible: boolean }>;
  readError: string | null;
};

// The detector measured the geometry and the kind; the model read the words.
// Putting the two together is the only place they meet.
function toPhotoNotes(
  detection: PhotoDetection,
  textById: Map<number, { text: string; legible: boolean }>,
): PhotoNote[] {
  return detection.stickies.map((sticky: DetectedSticky) => ({
    id: sticky.id,
    // An unreadable crop still becomes a note: the PAPER was there, and an
    // empty note the author can type into beats a note that never arrived.
    text: textById.get(sticky.id)?.text ?? '',
    kind: sticky.kind,
    size: sticky.size,
    ...toNormalised(sticky, detection.imageSize),
    row: sticky.row,
    order: sticky.order,
  }));
}

type PhotoDraftDeps = {
  activeTab: Tab;
  activeId: string;
  ownerId: string;
  // Whether the api has a model configured. Decides WHO reads the handwriting:
  // the server model when there is one, the in-browser model when there is not
  // (spec/139 Phase 9). Never a gate on the import itself — both read.
  aiEnabled: boolean;
  createBlocked: boolean;
  // The gesture's three history verbs, exactly as the eraser and the drag use
  // them: arm one checkpoint, write through `tick`, and either leave the step
  // standing or cancel back to it.
  tick: (mapElements: (els: Element[]) => Element[]) => void;
  markCheckpoint: () => number;
  cancelToCheckpoint: () => void;
  // One activity-log entry for the whole import, diffing before → after.
  emitChange: (tabId: string, before: Element[], after: Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  // Frame a rectangle of canvas (the viewport's own helper). The draft calls
  // it so what just arrived — and the notes it was matched against — are on
  // screen, rather than somewhere off to the right under a panel.
  fitToBounds: (
    bbox: { x: number; y: number; w: number; h: number },
    opts?: { maxZoom?: number },
  ) => void;
  toastError: (message: string) => void;
};

export type PhotoDraftApi = {
  state: PhotoDraftState;
  // The review wizard's payload, set while `state.stage === 'review'`.
  review: PhotoReview | null;
  // True while the review wizard is open (nothing landed yet).
  reviewOpen: boolean;
  // True while notes from a photo are awaiting Add or Discard. Derived from
  // the ELEMENTS, so a reload mid-draft still knows.
  draftOpen: boolean;
  startFromFile: (file: File) => Promise<void>;
  // Add the ticked boxes as the on-canvas draft; the review stays put otherwise.
  confirm: (
    tickedIds: Set<number>,
    texts: Map<number, { text: string; legible: boolean }>,
    manual: DetectedSticky[],
  ) => void;
  // Leave the review without adding anything.
  cancelReview: () => void;
  accept: () => void;
  discard: () => void;
  cancelReading: () => void;
};

const ERROR_TOASTS: Record<string, string> = {
  crops_too_large: 'Those stickies came out too large to send. Try a smaller photo.',
  photo_unsupported_heic:
    'That looks like an iPhone HEIC photo. Save or export it as JPEG and try again.',
  photo_unsupported_type: 'That file is not a photo. Use a JPEG, PNG or WebP.',
  photo_unreadable: 'That photo could not be opened. Try another one.',
  photo_too_large: 'That photo is too large, even after resizing. Try a smaller one.',
  photo_invalid: 'That photo could not be read. Try another one.',
  ai_not_configured: 'Reading photos is not enabled on this deployment.',
  sign_in_required: 'Sign in to read a photo of your wall.',
  origin_not_allowed: 'Reading photos is not available from here.',
  rate_limited: 'Too many photos just now. Wait a moment and try again.',
  ai_quota: 'The model key has used up its quota. Try again later, or raise the limit on the key.',
  ai_error: 'The reader could not finish. Try again in a moment.',
};

export const NO_NOTES_TOAST =
  'No stickies found in this photo. Fill the frame with the wall, shoot straight on, and give it good light.';

export function usePhotoDraft(deps: PhotoDraftDeps): PhotoDraftApi {
  const [state, setState] = useState<PhotoDraftState>(EMPTY);
  const [review, setReview] = useState<PhotoReview | null>(null);
  // Latest review, for guards inside callbacks whose deps do not re-run on it.
  const reviewRef = useRef<PhotoReview | null>(null);
  reviewRef.current = review;
  const abortRef = useRef<AbortController | null>(null);
  // Which run is current. A run has two awaits before it is abortable, and
  // Cancel pressed in that window must not land a draft over a board the
  // author has moved on from.
  const runRef = useRef(0);
  // The board as it stood before the draft landed, for the activity-log diff.
  const beforeRef = useRef<Element[] | null>(null);
  const live = useRef(deps);
  live.current = deps;

  const draftOpen = draftNotesOf(deps.activeTab.elements).length > 0;

  const fail = useCallback((token: string) => {
    setState({ ...EMPTY, error: token });
    live.current.toastError(ERROR_TOASTS[token] ?? ERROR_TOASTS.ai_error!);
  }, []);

  // Fit a rectangle around the given elements, with a little margin: an import
  // that lands off-screen reads as an import that did nothing. Never zoomed in
  // past life size.
  const frameElements = useCallback(
    (els: readonly { x: number; y: number; width: number; height: number }[]) => {
      if (els.length === 0) return;
      const minX = Math.min(...els.map((e) => e.x));
      const minY = Math.min(...els.map((e) => e.y));
      const maxX = Math.max(...els.map((e) => e.x + e.width));
      const maxY = Math.max(...els.map((e) => e.y + e.height));
      const margin = 120;
      live.current.fitToBounds(
        {
          x: minX - margin,
          y: minY - margin,
          w: maxX - minX + margin * 2,
          h: maxY - minY + margin * 2,
        },
        { maxZoom: 1 },
      );
    },
    [],
  );

  // The words arrive AFTER the review is already on screen: the crops are read
  // in the background and the text fields fill in batch by batch. A failure
  // leaves the fields blank and says why; the photo and boxes stay.
  const readWords = useCallback(
    async (detection: PhotoDetection, controller: AbortController, run: number) => {
      const current = () => runRef.current === run;
      try {
        const { read } = selectReader({
          aiEnabled: live.current.aiEnabled,
          ownerId: live.current.ownerId,
        });
        const textById = await read(detection.crops, {
          signal: controller.signal,
          onProgress: (readSoFar) => {
            if (!current()) return;
            setState((s) => (s.stage === 'review' ? { ...s, readSoFar } : s));
          },
        });
        if (!current()) return;
        setReview((prev) => (prev && prev.detection === detection ? { ...prev, textById } : prev));
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
    [],
  );

  const startFromFile = useCallback(
    async (file: File) => {
      const d = live.current;
      // One draft at a time, and never where the drop would be refused — a
      // review in progress counts as one, even though nothing has landed yet.
      if (
        d.createBlocked ||
        draftNotesOf(d.activeTab.elements).length > 0 ||
        reviewRef.current !== null
      )
        return;
      const run = (runRef.current += 1);
      const current = () => runRef.current === run;
      setState({ stage: 'detecting', found: 0, readSoFar: 0, error: null });

      const controller = new AbortController();
      abortRef.current = controller;

      // Finding the stickies happens HERE, in the browser: the photograph
      // never leaves the machine, only the crops do.
      let detection: PhotoDetection;
      try {
        detection = await detectAndCrop(file, { signal: controller.signal });
      } catch (err) {
        abortRef.current = null;
        if (!current()) return;
        fail(err instanceof PhotoDetectFailed ? err.reason : 'photo_unreadable');
        return;
      }
      if (!current()) return;

      if (detection.stickies.length === 0) {
        // No paper in the picture: say so, and never spend a model call on it.
        abortRef.current = null;
        setState(EMPTY);
        live.current.toastError(NO_NOTES_TOAST);
        return;
      }

      // Show the photo and its boxes IMMEDIATELY (detection is in-browser and
      // fast); the words stream in behind them as a separate stage. Nothing
      // here touches the document — the checkpoint is armed by `confirm` when
      // the ticked notes land.
      setReview({ detection, textById: new Map(), readError: null });
      setState({
        stage: 'review',
        found: detection.stickies.length,
        readSoFar: 0,
        error: null,
      });
      void readWords(detection, controller, run);
    },
    [fail, readWords],
  );

  // Add the ticked boxes as the on-canvas draft. The one write of the review:
  // arm the checkpoint, reconcile the ticked notes against the board as it is
  // NOW (a peer may have added the very note the photo shows), and land them.
  // `texts` is the author's edited words (step 2), seeded from the read;
  // `manual` are the boxes the author drew around missed stickies.
  const confirm = useCallback(
    (
      tickedIds: Set<number>,
      texts: Map<number, { text: string; legible: boolean }>,
      manual: DetectedSticky[],
    ) => {
      const d = live.current;
      if (!review) return;
      const detection = {
        ...review.detection,
        stickies: [...review.detection.stickies.filter((s) => tickedIds.has(s.id)), ...manual],
      };
      if (detection.stickies.length === 0) return;
      const existing = boardNotesOfElements(d.activeTab.elements);
      const result = reconcilePhoto(toPhotoNotes(detection, texts), existing, {
        tab: d.activeTab,
      });
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
      beforeRef.current = d.activeTab.elements;
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
        read: review.detection.stickies.length,
      });
      setReview(null);
      setState({
        stage: 'draft',
        found: review.detection.stickies.length,
        readSoFar: review.detection.stickies.length,
        error: null,
      });
    },
    [review, frameElements],
  );

  const cancelReview = useCallback(() => {
    // Leaving the review also cancels the in-flight read, if it is still going.
    runRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setReview(null);
    setState(EMPTY);
  }, []);

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
    if (beforeRef.current) d.emitChange(d.activeId, beforeRef.current, after);
    track('AI', 'Used', 'PhotoNotes');
    for (const _ of drafts) track('Element', 'Added', 'Sticky');
    beforeRef.current = null;
    setPhotoDraftView(null);
    setState(EMPTY);
  }, []);

  const discard = useCallback(() => {
    const d = live.current;
    if (draftNotesOf(d.activeTab.elements).length === 0) return;
    if (beforeRef.current) {
      // The ordinary cancel path: restore the armed snapshot and throw the
      // step away, so a discarded import leaves no trace in the undo stack.
      d.cancelToCheckpoint();
    } else {
      // A draft that outlived its session (a reload) has no checkpoint to go
      // back to, so it is removed as an ordinary edit instead.
      d.tick((els) => discardDraft(els));
    }
    beforeRef.current = null;
    setPhotoDraftView(null);
    setState(EMPTY);
  }, []);

  const cancelReading = useCallback(() => {
    runRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setState(EMPTY);
  }, []);

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
  };
}

// Every draft note is minted through the ONE builder, then takes the position
// the reconciliation worked out and the relation the photo showed. Ids are
// minted here so a pair the photo showed docked can point at each other.
function buildDraftNotes(additions: PhotoAddition[], activeTab: Tab): StickyElement[] {
  const idByDetected = new Map<number, string>();
  const built = additions.map((addition) => {
    const size = eventStormingNoteSize(addition.kind);
    const note = buildEventStormingNote(
      addition.kind,
      addition.x + addition.width / 2,
      addition.y + addition.height / 2,
      activeTab,
    );
    const el: StickyElement = {
      ...note,
      label: addition.text,
      width: size.width,
      height: size.height,
      esDraft: true,
    };
    idByDetected.set(addition.detectedId, el.id);
    return el;
  });

  return built.map((el, i) => {
    const dock = additions[i]!.dock;
    if (!dock) return el;
    const hostId =
      dock.hostBoardId ??
      (dock.hostDetectedId !== undefined ? idByDetected.get(dock.hostDetectedId) : undefined);
    return hostId ? { ...el, esDock: { hostId, side: dock.side } } : el;
  });
}
