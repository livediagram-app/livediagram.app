import type { CleanupVerdict } from '@/lib/tidy-verdict';

// What the Tidy Up button hands its popover (docs/specs/008-canvas/layout-cleanup.md "The Tidy Up
// button"). The editor builds it only for a session that may tidy (an Editor, not an embed); the chrome
// adds the rest of the gate (tidyUpOffered). Auto-align is the one tidier: Auto Layout's styles left
// livehuddle (Work Tracker #423, part 4).
export type TidyUpActions = {
  // Run Auto-align on the active tab: one undoable step, the command palette's own command. `judged`
  // when the popover already found it worth offering; otherwise it is judged first and refused
  // with a notice if it would not help.
  run: (judged: boolean) => void;
  // Lay the tab out as Auto-align would, present-only, and put it back (useCleanupPreview).
  preview: () => void;
  endPreview: () => void;
  // Whether Auto-align is worth offering on the tab as the author has it (lib/tidy-verdict.ts): the
  // popover greys it out if it would change nothing or damage the drawing, with the reason.
  assess: () => CleanupVerdict;
  // The active tab is locked: the popover shows Auto-align inert.
  blocked: boolean;
};

// Whether the cluster shows the button: outside an embed, and only for a session the editor handed
// actions to. Phones too: there a tap is the press, with no hover preview.
export function tidyUpOffered(input: {
  actions: TidyUpActions | undefined;
  chromeAway: boolean;
}): boolean {
  return !!input.actions && !input.chromeAway;
}
