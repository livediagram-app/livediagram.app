'use client';

import { useEditorContextMenu } from '@/hooks/canvas/useEditorContextMenu';
import { usePanelLayout } from '../usePanelLayout';
import { useEditorDialogs as useDialogState } from '../useEditorDialogs';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorSelectionSlice } from './useEditorSelection';

// Panel layout, the open dialogs, the context menu, and the join screen's chrome-hide flags. A slice of
// useEditorState (../useEditorState.ts): it takes the slices composed before it and returns its own, with
// `view`, its part of the editor's view-model.
export function useEditorDialogs({
  fromDocument,
  fromSelection,
}: {
  fromDocument: EditorDocumentSlice;
  fromSelection: EditorSelectionSlice;
}) {
  const { embedMode, hydrated, loadedExistingDocument, nameConfirmed, workbenchMode } =
    fromDocument;
  const { identityPromptOpen } = fromSelection;
  // Drag state lives inside the useEditorDrag hook, lifted out of
  // this component to keep the page focused on orchestration. The
  // hook is invoked further down (after `tick`, `commit`,
  // `applyFormatFromSource` and the rest of the drag dependencies
  // exist).
  // Panel layout (positions + open/visible flags) is one
  // cohesive slice — see usePanelLayout. Spread wholesale into the
  // returned view-model (see the return below).
  const panelLayout = usePanelLayout();
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
    !embedMode &&
    !workbenchMode &&
    hydrated &&
    loadedExistingDocument &&
    !nameConfirmed &&
    identityPromptOpen;
  const identityOnlyScreenOpen = joinScreenOpen;
  // Combined gate for chrome-hide. Only the join-existing flow lives
  // on this route now; the historical new-document welcome lives on
  // /live/new.
  const anyWelcomeOpen = identityOnlyScreenOpen;
  return {
    contextMenu,
    dialogs,
    panelLayout,
    setContextMenu,
    view: {
      ...panelLayout,
      ...dialogs,
      anyWelcomeOpen,
      closeContextMenu,
      contextMenu,
      identityOnlyScreenOpen,
      setContextMenu,
    },
  };
}

export type EditorDialogsSlice = ReturnType<typeof useEditorDialogs>;
