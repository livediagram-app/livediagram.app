'use client';

import { useNoteActions } from '@/hooks/canvas/useNoteActions';
import { usePhotoPicker } from '@/hooks/canvas/usePhotoPicker';
import { warmBoundaryModel } from '@/lib/photo-model/client';
import { usePhotoDraft } from '@/hooks/canvas/usePhotoDraft';
import { useAssignRef } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorCommentsSlice } from './useEditorComments';
import type { EditorViewportSlice } from './useEditorViewport';
import type { EditorFollowingSlice } from './useEditorFollowing';
import type { EditorEditingSlice } from './useEditorEditing';
import type { EditorLayersSlice } from './useEditorLayers';

// The event-storming photo import (its draft owns the history while open) and the note acts. A slice of
// useEditorState (../useEditorState.ts): it takes the slices composed before it and returns its own, with
// `view`, its part of the editor's view-model.
export function useEditorEventStorming({
  fromDocument,
  fromHistory,
  fromSelection,
  fromComments,
  fromViewport,
  fromFollowing,
  fromEditing,
  fromLayers,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromComments: EditorCommentsSlice;
  fromViewport: EditorViewportSlice;
  fromFollowing: EditorFollowingSlice;
  fromEditing: EditorEditingSlice;
  fromLayers: EditorLayersSlice;
}) {
  const { selfParticipant, toast } = fromDocument;
  const { cancelGesture, markCheckpoint, photoDraftOpenRef } = fromHistory;
  const { activeId, setMultiSelectedIds, setSelectedId } = fromSelection;
  const { activeTab } = fromComments;
  const { fitToBounds } = fromViewport;
  const { aiCapable } = fromFollowing;
  const { commit } = fromEditing;
  const { addBoxedAt, createBlocked, esBoard, layerInertIds, tick } = fromLayers;

  // Photo import (docs/specs/021-event-storming/event-storming.md Phase 8): reads a photographed wall, reconciles it
  // against this board and lands the result as an on-canvas DRAFT. Detection
  // and reading are both in-browser now (Phase 9), so this needs no model key.
  const photoDraft = usePhotoDraft({
    activeTab,
    activeId,
    ownerId: selfParticipant.id,
    aiEnabled: aiCapable,
    createBlocked,
    tick,
    markCheckpoint,
    // The draft OWNS the gesture, so it cancels it directly rather than
    // through the guard that keeps everyone else out of its checkpoint.
    cancelToCheckpoint: cancelGesture,
    setSelectedId,
    setMultiSelectedIds,
    fitToBounds,
    toastError: toast.error,
  });
  // The hidden file input the palette row and the command-palette entry open.
  // Keep the history-ownership ref (declared beside `commit`) in step with
  // whether a draft is actually open.
  // While a photo draft is open it OWNS the history (docs/specs/021-event-storming/event-storming.md Phase 8): the
  // landing and every correction the author makes to a draft note are one
  // gesture, ending at Add (the step stands) or Discard (it is thrown away).
  // A ref, because `commit` / `markCheckpoint` are defined long before the
  // draft hook and read it at call time.
  useAssignRef(photoDraftOpenRef, photoDraft.draftOpen);
  const photoImportAvailable = esBoard;
  // One draft at a time: while one is open the entry points say so rather
  // than starting a second import over the first.
  const photoImportBlocked = createBlocked || photoDraft.draftOpen;
  // A photo dropped or pasted on one of these boards is a piece of WALL, not
  // a picture element: it goes straight to the reader, and nothing on the
  // canvas becomes an image.
  const readPhotoFile =
    photoImportAvailable && !photoImportBlocked
      ? (file: File) => {
          void photoDraft.startFromFile(file);
        }
      : undefined;
  // One input, rendered once beside the canvas, so the camera-capture attribute
  // and the accepted-type list live in exactly one place. The picker guards the
  // dialog itself: a stray second click (a double-click in the file dialog)
  // must not replace the chooser that is already returning a file.
  const photoPicker = usePhotoPicker({
    canOpen: () => photoImportAvailable && !photoImportBlocked,
    onFile: (file) => readPhotoFile?.(file),
    onOpen: warmBoundaryModel,
  });
  const photoPickerRef = photoPicker.inputRef;
  const openPhotoImport = photoPicker.open;

  // Note acts on an event-storming board (docs/specs/021-event-storming/event-storming.md): add the next note beside
  // one, change a note's kind.
  const noteActions = useNoteActions({
    activeTab,
    createBlocked,
    layerInertIds,
    commit,
    addBoxedAt,
  });
  return {
    readPhotoFile,
    view: {
      // Note acts on an event-storming board (docs/specs/021-event-storming/event-storming.md).
      ...noteActions,
      // Photo import (docs/specs/021-event-storming/event-storming.md Phase 8): the draft run, whether the entry
      // points may be offered, and the hidden file input they open.
      photoDraft,
      photoImportAvailable,
      photoImportBlocked,
      openPhotoImport,
      photoPickerRef,
      onPhotoPicked: photoPicker.onChange,
      readPhotoFile,
    },
  };
}

export type EditorEventStormingSlice = ReturnType<typeof useEditorEventStorming>;
