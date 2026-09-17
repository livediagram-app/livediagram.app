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
import { apiAiReadNotes } from '@/lib/api/ai';
import { buildEventStormingNote } from '@/lib/draw-commit';
import { setPhotoDraftView } from '@/lib/photo-draft-preview';
import { detectAndCrop, PhotoDetectFailed, type PhotoDetection } from '@/lib/photo-detect';
import { track } from '@/lib/telemetry';

// A photo import, as ONE long gesture (spec/139 Phase 8).
//
//   idle → preparing → reading → draft → committing → idle
//                 ↘        ↘
//                    error (a toast; the entry points come back)
//
// The review happens ON the canvas, not in a dialog: the notes land where they
// will finally sit, carrying `esDraft`, and the author corrects them by typing,
// dragging and deleting — the machinery they already know. That means the draft
// is IN the document, which is the drag gesture's precedent rather than an
// exception to the preview rule: a checkpoint is armed when the draft lands,
// every edit after that is a non-undoable `tick`, and the gesture ends either
// with Add (the step stands, covering the whole import) or Discard (the
// checkpoint is restored and the step thrown away).

export type PhotoDraftStage =
  | 'idle'
  // Decoding the photo and finding the stickies in it, here in the browser.
  | 'detecting'
  // Asking the model what the crops say.
  | 'reading'
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
  // True while notes from a photo are awaiting Add or Discard. Derived from
  // the ELEMENTS, so a reload mid-draft still knows.
  draftOpen: boolean;
  startFromFile: (file: File) => Promise<void>;
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

  // Land what the detector found, whatever the reader made of it. The paper
  // was there and the author can type its words either way; `readFailed` just
  // changes what the bar and the toast tell them.
  const landDraft = useCallback(
    (
      detection: PhotoDetection,
      textById: Map<number, { text: string; legible: boolean }>,
      readError: string | null,
    ) => {
      const now = live.current;
      const existing = boardNotesOfElements(now.activeTab.elements);
      const result = reconcilePhoto(toPhotoNotes(detection, textById), existing, {
        tab: now.activeTab,
      });

      if (result.additions.length === 0 && result.matches.length === 0) {
        setState(EMPTY);
        now.toastError(NO_NOTES_TOAST);
        return;
      }

      // One checkpoint, then the notes go in as a tick — from here the author
      // is inside the gesture until Add or Discard.
      const matchedIds = new Set(result.matches.map((m) => m.boardId));
      beforeRef.current = now.activeTab.elements;
      now.markCheckpoint();
      const built = buildDraftNotes(result.additions, now.activeTab);
      now.tick((els) => [...els, ...built]);
      now.setSelectedId(null);
      now.setMultiSelectedIds(new Set(built.map((el) => el.id)));
      // Bring the draft into view, together with the notes it was matched
      // against: an import that lands off-screen reads as an import that did
      // nothing. A little margin, and never zoomed in past life size.
      const framed = [...built, ...existing.filter((e) => matchedIds.has(e.id))];
      if (framed.length > 0) {
        const minX = Math.min(...framed.map((e) => e.x));
        const minY = Math.min(...framed.map((e) => e.y));
        const maxX = Math.max(...framed.map((e) => e.x + e.width));
        const maxY = Math.max(...framed.map((e) => e.y + e.height));
        const margin = 120;
        now.fitToBounds(
          {
            x: minX - margin,
            y: minY - margin,
            w: maxX - minX + margin * 2,
            h: maxY - minY + margin * 2,
          },
          { maxZoom: 1 },
        );
      }
      setPhotoDraftView({
        matchedIds,
        differences: new Map(
          result.differences
            .map((diff) => [diff.boardId, textById.get(diff.detectedId)?.text ?? ''] as const)
            .filter(([, text]) => text !== ''),
        ),
        read: detection.stickies.length,
        ...(readError ? { readError } : {}),
      });
      setState({
        stage: 'draft',
        found: detection.stickies.length,
        readSoFar: detection.stickies.length,
        error: null,
      });
    },
    [],
  );

  const startFromFile = useCallback(
    async (file: File) => {
      const d = live.current;
      // One draft at a time, and never where the drop would be refused.
      if (d.createBlocked || draftNotesOf(d.activeTab.elements).length > 0) return;
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
      setState({ stage: 'reading', found: detection.stickies.length, readSoFar: 0, error: null });

      // Assigned in the try before any read; the catch returns early.
      let textById: Map<number, { text: string; legible: boolean }>;
      try {
        const answer = await apiAiReadNotes(d.ownerId, detection.crops, {
          signal: controller.signal,
          onProgress: (readSoFar) => {
            if (!current()) return;
            setState((s) => (s.stage === 'reading' ? { ...s, readSoFar } : s));
          },
        });
        textById = new Map(answer.texts.map((t) => [t.id, { text: t.text, legible: t.legible }]));
      } catch (err) {
        // An abort is the author changing their mind, not a failure.
        if (controller.signal.aborted || !current()) {
          setState(EMPTY);
          return;
        }
        // The reader failed — quota, a spike, the model gone — but the
        // DETECTOR already succeeded, and that is the valuable half. Land the
        // notes blank and say why, so the layout is never thrown away just
        // because the model could not read the words.
        const token = err instanceof Error ? err.message : 'ai_error';
        landDraft(detection, new Map(), token);
        live.current.toastError(ERROR_TOASTS[token] ?? ERROR_TOASTS.ai_error!);
        return;
      } finally {
        abortRef.current = null;
      }
      if (!current()) return;

      // Reconcile against the board as it is NOW, not as it was when the photo
      // was picked: reading takes seconds, and a peer edits in seconds.
      landDraft(detection, textById, null);
    },
    [fail, landDraft],
  );

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

  return { state, draftOpen, startFromFile, accept, discard, cancelReading };
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
