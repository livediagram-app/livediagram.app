'use client';

import type { EditorSurface } from './editor-surface';
import { useEditorDocument } from './editor-state/useEditorDocument';
import { useEditorUndoState } from './editor-state/useEditorUndoState';
import { useEditorSelection } from './editor-state/useEditorSelection';
import { useEditorDialogs } from './editor-state/useEditorDialogs';
import { useEditorTools } from './editor-state/useEditorTools';
import { useEditorCollaboration } from './editor-state/useEditorCollaboration';
import { useEditorPersistence } from './editor-state/useEditorPersistence';
import { useEditorRoom } from './editor-state/useEditorRoom';
import { useEditorComments } from './editor-state/useEditorComments';
import { useEditorModes } from './editor-state/useEditorModes';
import { useEditorViewport } from './editor-state/useEditorViewport';
import { useEditorFollowing } from './editor-state/useEditorFollowing';
import { useEditorPresence } from './editor-state/useEditorPresence';
import { useEditorEditing } from './editor-state/useEditorEditing';
import { useEditorTabs } from './editor-state/useEditorTabs';
import { useEditorCreation } from './editor-state/useEditorCreation';
import { useEditorStyle } from './editor-state/useEditorStyle';
import { useEditorInteraction } from './editor-state/useEditorInteraction';
import { useEditorKeyboard } from './editor-state/useEditorKeyboard';

// The editor's state, composed from the slices in editor-state/
// (docs/specs/003-system-architecture/blueprints/editor-state.md).
// Each slice is one hook; the composer calls them in order and passes each the slices before it, so dependencies
// flow one way. The order is the order the hooks ran in when this was one function: effects run in declaration
// order, so a slice's effects run where its hooks are called. The returned view-model is every slice's `view`
// spread in that order, the same object EditorContext has always carried.
export function useEditorState(opts: { surface?: EditorSurface } = {}) {
  const fromDocument = useEditorDocument(opts);
  const fromHistory = useEditorUndoState({ fromDocument });
  const fromSelection = useEditorSelection({ fromDocument });
  const fromDialogs = useEditorDialogs({ fromDocument, fromSelection });
  const fromTools = useEditorTools({ fromDocument, fromSelection });
  const fromCollaboration = useEditorCollaboration({
    fromDocument,
    fromHistory,
    fromSelection,
    fromTools,
  });
  const fromPersistence = useEditorPersistence({
    fromDocument,
    fromHistory,
    fromSelection,
    fromDialogs,
    fromCollaboration,
  });
  const fromRoom = useEditorRoom({
    fromDocument,
    fromHistory,
    fromSelection,
    fromCollaboration,
    fromPersistence,
  });
  const fromComments = useEditorComments({
    fromDocument,
    fromHistory,
    fromSelection,
    fromCollaboration,
  });
  const fromModes = useEditorModes({
    fromDocument,
    fromHistory,
    fromSelection,
    fromTools,
    fromCollaboration,
    fromComments,
  });
  const fromViewport = useEditorViewport({
    fromDocument,
    fromHistory,
    fromSelection,
    fromTools,
    fromCollaboration,
    fromComments,
  });
  const fromFollowing = useEditorFollowing({
    fromDocument,
    fromSelection,
    fromTools,
    fromCollaboration,
    fromPersistence,
    fromRoom,
    fromComments,
    fromViewport,
  });
  const fromPresence = useEditorPresence({
    fromDocument,
    fromHistory,
    fromSelection,
    fromCollaboration,
  });
  const fromEditing = useEditorEditing({
    fromDocument,
    fromHistory,
    fromSelection,
    fromTools,
    fromCollaboration,
    fromPersistence,
    fromComments,
    fromViewport,
    fromFollowing,
  });
  const fromTabs = useEditorTabs({
    fromDocument,
    fromHistory,
    fromSelection,
    fromCollaboration,
    fromPersistence,
    fromRoom,
    fromComments,
    fromModes,
    fromViewport,
    fromFollowing,
    fromEditing,
  });
  const fromCreation = useEditorCreation({
    fromDocument,
    fromHistory,
    fromSelection,
    fromTools,
    fromCollaboration,
    fromPersistence,
    fromComments,
    fromPresence,
    fromEditing,
    fromTabs,
  });
  const fromStyle = useEditorStyle({
    fromDocument,
    fromHistory,
    fromSelection,
    fromDialogs,
    fromCollaboration,
    fromPersistence,
    fromComments,
    fromEditing,
    fromTabs,
    fromCreation,
  });
  const fromInteraction = useEditorInteraction({
    fromDocument,
    fromHistory,
    fromSelection,
    fromDialogs,
    fromTools,
    fromCollaboration,
    fromPersistence,
    fromComments,
    fromViewport,
    fromFollowing,
    fromPresence,
    fromEditing,
    fromTabs,
    fromCreation,
  });
  const fromKeyboard = useEditorKeyboard({
    fromSelection,
    fromDialogs,
    fromTools,
    fromCollaboration,
    fromRoom,
    fromComments,
    fromViewport,
    fromEditing,
    fromCreation,
    fromStyle,
    fromInteraction,
  });
  return {
    ...fromDocument.view,
    ...fromHistory.view,
    ...fromSelection.view,
    ...fromDialogs.view,
    ...fromTools.view,
    ...fromCollaboration.view,
    ...fromPersistence.view,
    ...fromRoom.view,
    ...fromComments.view,
    ...fromModes.view,
    ...fromViewport.view,
    ...fromFollowing.view,
    ...fromPresence.view,
    ...fromEditing.view,
    ...fromTabs.view,
    ...fromCreation.view,
    ...fromStyle.view,
    ...fromInteraction.view,
    ...fromKeyboard.view,
  };
}
