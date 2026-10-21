import type { EditorMode } from '@liveplanner/document';
import type { CleanupKind } from '@/lib/tab-cleanup';
import type { CleanupVerdict } from '@/lib/tidy-verdict';

// What Diagram mode's Tidy Up button hands its popover (docs/specs/008-canvas/layout-cleanup.md "The Tidy Up
// button"). The editor builds it only for a session that may tidy (an Editor, not an embed); the chrome
// adds the rest of the gate (tidyUpOffered).
export type TidyUpActions = {
  // Run a tidier on the active tab: one undoable step, the command palette's own command. `judged`
  // when the popover already found it worth offering; otherwise it is judged first and refused
  // with a notice if it would not help.
  run: (kind: CleanupKind, judged: boolean) => void;
  // Lay the tab out as `kind` would, present-only, and put it back (useCleanupPreview).
  preview: (kind: CleanupKind) => void;
  endPreview: () => void;
  // Whether a tidier is worth offering on the tab as the author has it (lib/tidy-verdict.ts): the
  // popover greys out one that would change nothing or damage the drawing, with the reason.
  assess: (kind: CleanupKind) => CleanupVerdict;
  // The active tab is locked: the popover shows every tidier inert.
  blocked: boolean;
};

// Whether the cluster shows the button: Diagram mode, out of Zen, and only for a session the editor handed
// actions to. Phones too: there a tap is the press, with no hover preview.
export function tidyUpOffered(input: {
  actions: TidyUpActions | undefined;
  editorMode: EditorMode | undefined;
  zenMode: boolean;
}): boolean {
  return !!input.actions && input.editorMode === 'diagram' && !input.zenMode;
}
