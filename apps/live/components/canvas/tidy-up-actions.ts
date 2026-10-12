import type { EditorMode } from '@livediagram/document';
import type { CleanupKind } from '@/lib/tab-cleanup';

// What Diagram mode's Tidy Up button hands its popover (docs/specs/008-canvas/layout-cleanup.md "The Tidy Up
// button"). The editor builds it only for a session that may tidy (an Editor, not an embed); the chrome
// adds the rest of the gate (tidyUpOffered).
export type TidyUpActions = {
  // Run a tidier on the active tab: one undoable step, the command palette's own command.
  run: (kind: CleanupKind) => void;
  // Lay the tab out as `kind` would, present-only, and put it back (useCleanupPreview).
  preview: (kind: CleanupKind) => void;
  endPreview: () => void;
  // The active tab is locked: the popover shows every tidier inert.
  blocked: boolean;
};

// Whether the cluster shows the button: Diagram mode, off a phone, out of Zen, and only for a session the
// editor handed actions to.
export function tidyUpOffered(input: {
  actions: TidyUpActions | undefined;
  editorMode: EditorMode | undefined;
  isMobile: boolean;
  zenMode: boolean;
}): boolean {
  return !!input.actions && input.editorMode === 'diagram' && !input.isMobile && !input.zenMode;
}
