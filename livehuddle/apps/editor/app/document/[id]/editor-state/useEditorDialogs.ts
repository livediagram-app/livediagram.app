'use client';

import { nameChoiceViews, useNameCardAsked } from '@liveworkspace/workbench/lib/name-card';

import { useEditorContextMenu } from '@/hooks/canvas/useEditorContextMenu';
import { useEditorDialogs as useDialogState } from '../useEditorDialogs';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorSelectionSlice } from './useEditorSelection';

// The open dialogs, the context menu, and the join screen's chrome-hide flags. A slice of
// useEditorState (../useEditorState.ts): it takes the slices composed before it and returns its own, with
// `view`, its part of the editor's view-model.
export function useEditorDialogs({
  fromDocument,
  fromSelection,
}: {
  fromDocument: EditorDocumentSlice;
  fromSelection: EditorSelectionSlice;
}) {
  const { embedMode, hydrated, loadedExistingDocument, nameConfirmed } = fromDocument;
  const { identityPromptOpen } = fromSelection;
  // Drag state lives inside the useEditorDrag hook, lifted out of
  // this component to keep the page focused on orchestration. The
  // hook is invoked further down (after `tick`, `commit`,
  // `applyFormatFromSource` and the rest of the drag dependencies
  // exist).
  const dialogs = useDialogState();

  // Right-click context menu state (cursor position + element-scoped
  // vs tab-scoped mode). See useEditorContextMenu.
  const { contextMenu, setContextMenu, closeContextMenu } = useEditorContextMenu();

  // The visitor name prompt drives the chrome hide rule (palette / explorer / dock / tab bar all suppressed so the
  // visitor's focus is on it). Gated on `hydrated` so it only shows once the post-mount useLayoutEffect has replaced
  // the placeholder participant with the loaded / freshly minted one; otherwise IdentityPrompt's
  // `useState(participant.name)` would capture the SSG placeholder "Guest".
  //
  // Join screen for visitors landing on an existing document who haven't
  // confirmed their identity yet. Same chrome-hide rule as the old
  // welcome modal — focus the user on the name input before they
  // start editing.
  //
  // View-role visitors get this too: their name is broadcast to other
  // participants (cursor label, presence stack, comments), so they need
  // a chance to set it before joining rather than appearing under a
  // default. The identity card only writes the participant's OWN row
  // (PUT /api/participants/:id, gated on owner === id, not document
  // edit), so a viewer can confirm a name without any 403.
  //
  // Embeds skip the prompt entirely (docs/specs/013-workspace/embeds.md): a "what's your name"
  // card inside a README iframe is wrong, so embed sessions keep
  // their default guest identity silently.
  const joinScreenOpen =
    !embedMode && hydrated && loadedExistingDocument && !nameConfirmed && identityPromptOpen;
  // A visitor's name is defaulted, not asked (liveworkspace/docs/specs/011-workbench/first-edit.md "A visitor's
  // name"): the offer is the name tray, and the card only opens from its Change Name.
  const nameViews = nameChoiceViews(joinScreenOpen, useNameCardAsked());
  const identityOnlyScreenOpen = nameViews.card;
  const identityTrayOpen = nameViews.tray;
  // The name card holds the tours while it is open (they wait on this), and nothing else: it is a modal over the
  // canvas, so the chrome and both sidebars stay as they are (Work Tracker 1522).
  const anyWelcomeOpen = identityOnlyScreenOpen;
  return {
    contextMenu,
    dialogs,
    setContextMenu,
    view: {
      ...dialogs,
      anyWelcomeOpen,
      closeContextMenu,
      contextMenu,
      identityOnlyScreenOpen,
      identityTrayOpen,
      setContextMenu,
    },
  };
}

export type EditorDialogsSlice = ReturnType<typeof useEditorDialogs>;
