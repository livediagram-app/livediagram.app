'use client';

import { useCallback, useRef, useState } from 'react';
import {
  reconcilePhoto,
  type BoardNote,
  type Element,
  type EventStormingNoteKind,
  type PhotoAddition,
  type PhotoNote,
  type PhotoReconciliation,
  type StickyElement,
  type Tab,
  eventStormingKindOf,
  eventStormingNoteSize,
} from '@livediagram/diagram';
import type { PhotoNotesResponse } from '@livediagram/api-schema';
import { apiAiPhotoNotes } from '@/lib/api/ai';
import { buildEventStormingNote } from '@/lib/draw-commit';
import { preparePhoto, PhotoPrepareFailed, type PreparedPhoto } from '@/lib/photo-prepare';
import { track } from '@/lib/telemetry';

// The photo-import run (spec/139 Phase 8), as a state machine.
//
//   idle → preparing → reading → review → committing → done
//                 ↘        ↘        ↘
//                    error (retryable at every step)
//
// A machine rather than a handful of booleans because the run has real
// transitions with real consequences — an in-flight model call that has to be
// abortable, a review the author edits before anything is committed — and
// "loading && !error && notes" is how those get contradicted.

export type PhotoImportStage =
  'idle' | 'preparing' | 'reading' | 'review' | 'committing' | 'done' | 'error';

// What the author changed in the review, per detected note. Everything is
// optional: an untouched note commits exactly as it was read.
export type PhotoEdit = { text?: string; kind?: EventStormingNoteKind; dock?: boolean };

export type PhotoImportState = {
  stage: PhotoImportStage;
  photo: PreparedPhoto | null;
  response: PhotoNotesResponse | null;
  reconciliation: PhotoReconciliation | null;
  // Detected ids the author has ticked. Seeded with every addition, because
  // the common case is "yes, all of them".
  included: Set<number>;
  edits: Map<number, PhotoEdit>;
  error: string | null;
  addedCount: number;
};

const EMPTY: PhotoImportState = {
  stage: 'idle',
  photo: null,
  response: null,
  reconciliation: null,
  included: new Set(),
  edits: new Map(),
  error: null,
  addedCount: 0,
};

// The board as the reconciliation sees it: the workshop notes, and nothing
// else. A shape or an arrow on the tab is not something a photo of paper can
// be matched against.
export function boardNotesOf(elements: Element[]): BoardNote[] {
  const out: BoardNote[] = [];
  for (const el of elements) {
    const kind = eventStormingKindOf(el);
    if (!kind || el.type !== 'sticky') continue;
    const note = el as StickyElement;
    out.push({
      id: note.id,
      text: note.label ?? '',
      kind,
      x: note.x,
      y: note.y,
      width: note.width,
      height: note.height,
    });
  }
  return out;
}

// The model's answer in the shape the reconciliation wants.
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

type PhotoImportDeps = {
  activeTab: Tab;
  ownerId: string;
  createBlocked: boolean;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => number;
  activeId: string;
  setMultiSelectedIds: (ids: Set<string>) => void;
};

export function usePhotoImport(deps: PhotoImportDeps) {
  const [state, setState] = useState<PhotoImportState>(EMPTY);
  const abortRef = useRef<AbortController | null>(null);
  // Which run is current. A run has two awaits before it is abortable (the
  // decode, then the encode), and "Cancel" pressed in that window used to be
  // ignored — the fetch had not started yet, so there was no controller to
  // abort, and the run carried on and landed a review over a closed dialog.
  // Every step checks the token it started with instead.
  const runRef = useRef(0);
  // The tab as it is NOW, read at commit time rather than captured when the
  // review was drawn: a peer may have edited the board while the author was
  // reading their photo, and the ripple / de-overlap has to answer to that.
  const liveRef = useRef(deps);
  liveRef.current = deps;

  const reset = useCallback(() => {
    runRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setState(EMPTY);
  }, []);

  const read = useCallback(async (file: File) => {
    const { activeTab, ownerId } = liveRef.current;
    const run = (runRef.current += 1);
    const current = () => runRef.current === run;
    setState({ ...EMPTY, stage: 'preparing' });
    let prepared: PreparedPhoto;
    try {
      prepared = await preparePhoto(file);
    } catch (err) {
      if (!current()) return;
      const reason = err instanceof PhotoPrepareFailed ? err.reason : 'photo_unreadable';
      setState({ ...EMPTY, stage: 'error', error: reason });
      return;
    }
    // Abandoned while the photo was being prepared: leave the state the
    // cancel put it in rather than reviving a run nobody is waiting for.
    if (!current()) return;
    setState((s) => ({ ...s, stage: 'reading', photo: prepared }));

    const controller = new AbortController();
    abortRef.current = controller;
    let response: PhotoNotesResponse;
    try {
      response = await apiAiPhotoNotes(ownerId, prepared.dataUrl, activeTab.name, {
        signal: controller.signal,
      });
    } catch (err) {
      // An abort is the author changing their mind, not a failure: it leaves
      // the dialog on the picker rather than showing them an error they caused.
      if (controller.signal.aborted || !current()) return;
      setState((s) => ({
        ...s,
        stage: 'error',
        error: err instanceof Error ? err.message : 'ai_error',
      }));
      return;
    } finally {
      abortRef.current = null;
    }

    if (!current()) return;
    const reconciliation = reconcilePhoto(
      toPhotoNotes(response),
      boardNotesOf(liveRef.current.activeTab.elements),
      { tab: liveRef.current.activeTab },
    );
    setState((s) => ({
      ...s,
      stage: 'review',
      response,
      reconciliation,
      included: new Set(reconciliation.additions.map((a) => a.detectedId)),
      edits: new Map(),
    }));
  }, []);

  const setIncluded = useCallback((detectedId: number, on: boolean) => {
    setState((s) => {
      const included = new Set(s.included);
      if (on) included.add(detectedId);
      else included.delete(detectedId);
      return { ...s, included };
    });
  }, []);

  const editNote = useCallback((detectedId: number, patch: PhotoEdit) => {
    setState((s) => {
      const edits = new Map(s.edits);
      edits.set(detectedId, { ...(edits.get(detectedId) ?? {}), ...patch });
      return { ...s, edits };
    });
  }, []);

  // Commit: re-reconcile against the LIVE tab (the insert-between precedent —
  // the drop runs against the board as it is, not the snapshot the gesture
  // started from), then add every included note in ONE step.
  const commit = useCallback(() => {
    const { activeTab, activeId, commitTabs, createBlocked, setMultiSelectedIds } = liveRef.current;
    if (createBlocked) return;
    setState((s) => ({ ...s, stage: 'committing' }));
    setState((s) => {
      if (!s.response) return { ...s, stage: 'error', error: 'ai_error' };
      const fresh = reconcilePhoto(toPhotoNotes(s.response), boardNotesOf(activeTab.elements), {
        tab: activeTab,
      });
      const additions = fresh.additions.filter((a) => s.included.has(a.detectedId));
      if (additions.length === 0) return { ...s, stage: 'review' };

      const built = buildAdditions(additions, s.edits, activeTab);
      track('AI', 'Used', 'PhotoNotes');
      for (const _ of built) track('Element', 'Added', 'Sticky');
      commitTabs((ts) =>
        ts.map((t) =>
          t.id === activeId
            ? { ...t, elements: [...t.elements, ...built], templateChosen: true }
            : t,
        ),
      );
      setMultiSelectedIds(new Set(built.map((el) => el.id)));
      return { ...s, stage: 'done', addedCount: built.length };
    });
  }, []);

  // Start the next run against the board as it NOW is, so anything the last
  // photo added is matched rather than added twice.
  const again = useCallback(() => {
    setState({ ...EMPTY, stage: 'idle' });
  }, []);

  return { state, read, setIncluded, editNote, commit, reset, again };
}

// Every note goes through the ONE builder, then takes the position the
// reconciliation worked out and the relation the photo showed. Ids are minted
// here so a docked pair added together can point at each other.
function buildAdditions(
  additions: PhotoAddition[],
  edits: Map<number, PhotoEdit>,
  activeTab: Tab,
): StickyElement[] {
  const idByDetected = new Map<number, string>();
  const built = additions.map((addition) => {
    const edit = edits.get(addition.detectedId) ?? {};
    const kind = edit.kind ?? addition.kind;
    const size = eventStormingNoteSize(kind);
    const note = buildEventStormingNote(
      kind,
      addition.x + addition.width / 2,
      addition.y + addition.height / 2,
      activeTab,
    );
    const el: StickyElement = {
      ...note,
      label: edit.text ?? addition.text,
      // The kind may have been corrected in review, so the silhouette follows
      // it rather than the placement's assumption.
      width: size.width,
      height: size.height,
    };
    idByDetected.set(addition.detectedId, el.id);
    return el;
  });

  return built.map((el, i) => {
    const addition = additions[i]!;
    const edit = edits.get(addition.detectedId) ?? {};
    // A dock the review unticked is simply not applied.
    if (!addition.dock || edit.dock === false) return el;
    const hostId =
      addition.dock.hostBoardId ??
      (addition.dock.hostDetectedId !== undefined
        ? idByDetected.get(addition.dock.hostDetectedId)
        : undefined);
    if (!hostId) return el;
    return { ...el, esDock: { hostId, side: addition.dock.side } };
  });
}
