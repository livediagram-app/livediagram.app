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
import type { PhotoNotesResponse } from '@livediagram/api-schema';
import { apiAiPhotoNotes } from '@/lib/api/ai';
import { buildEventStormingNote } from '@/lib/draw-commit';
import { setPhotoDraftView } from '@/lib/photo-draft-preview';
import { preparePhoto, PhotoPrepareFailed, type PreparedPhoto } from '@/lib/photo-prepare';
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

export type PhotoDraftStage = 'idle' | 'preparing' | 'reading' | 'draft' | 'committing';

export type PhotoDraftState = {
  stage: PhotoDraftStage;
  photo: PreparedPhoto | null;
  // The last failure's token, for the toast. Cleared by the next attempt.
  error: string | null;
};

const EMPTY: PhotoDraftState = { stage: 'idle', photo: null, error: null };

function toPhotoNotes(response: PhotoNotesResponse): PhotoNote[] {
  return response.notes.map((n) => ({
    id: n.id,
    text: n.text,
    kind: n.kind,
    size: n.size,
    cx: n.cx,
    cy: n.cy,
    w: n.w,
    h: n.h,
    row: n.row,
    order: n.order,
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

  const startFromFile = useCallback(
    async (file: File) => {
      const d = live.current;
      // One draft at a time, and never where the drop would be refused.
      if (d.createBlocked || draftNotesOf(d.activeTab.elements).length > 0) return;
      const run = (runRef.current += 1);
      const current = () => runRef.current === run;
      setState({ stage: 'preparing', photo: null, error: null });

      let prepared: PreparedPhoto;
      try {
        prepared = await preparePhoto(file);
      } catch (err) {
        if (!current()) return;
        fail(err instanceof PhotoPrepareFailed ? err.reason : 'photo_unreadable');
        return;
      }
      if (!current()) return;
      setState({ stage: 'reading', photo: prepared, error: null });

      const controller = new AbortController();
      abortRef.current = controller;
      let response: PhotoNotesResponse;
      try {
        response = await apiAiPhotoNotes(d.ownerId, prepared.dataUrl, d.activeTab.name, {
          signal: controller.signal,
        });
      } catch (err) {
        // An abort is the author changing their mind, not a failure.
        if (controller.signal.aborted || !current()) {
          setState(EMPTY);
          return;
        }
        fail(err instanceof Error ? err.message : 'ai_error');
        return;
      } finally {
        abortRef.current = null;
      }
      if (!current()) return;

      // Reconcile against the board as it is NOW, not as it was when the
      // photo was picked: reading takes seconds, and a peer edits in seconds.
      const now = live.current;
      const existing = boardNotesOfElements(now.activeTab.elements);
      const result = reconcilePhoto(toPhotoNotes(response), existing, { tab: now.activeTab });

      if (result.additions.length === 0 && result.matches.length === 0) {
        setState(EMPTY);
        now.toastError(NO_NOTES_TOAST);
        return;
      }

      // Land it. One checkpoint, then the notes go in as a tick — from here
      // the author is inside the gesture until Add or Discard.
      beforeRef.current = now.activeTab.elements;
      now.markCheckpoint();
      const built = buildDraftNotes(result.additions, now.activeTab);
      now.tick((els) => [...els, ...built]);
      now.setSelectedId(null);
      now.setMultiSelectedIds(new Set(built.map((el) => el.id)));
      setPhotoDraftView({
        matchedIds: new Set(result.matches.map((m) => m.boardId)),
        differences: new Map(
          result.differences
            .map((diff) => {
              const photoNote = response.notes.find((n) => n.id === diff.detectedId);
              return [diff.boardId, photoNote?.text ?? ''] as const;
            })
            .filter(([, text]) => text !== ''),
        ),
        read: response.notes.length,
      });
      setState({ stage: 'draft', photo: prepared, error: null });
    },
    [fail],
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
