// The writing as an open edit (docs/specs/007-editor/article-pages.md "Commits"): what was typed since the last commit,
// in the writing (held for the idle commit) or in a footnote's note (held until the note is left), goes with the page
// when it is reloaded or closed. Neither fires a blur, so the unload flush asks the open edit to commit first
// (@liveworkspace/workbench/lib/open-edit.ts). The writing registers as that edit whenever the focus comes into it, its
// notes included, and stays registered after a blur: the commit is a no-op once nothing is held.
import { registerOpenEdit } from '@liveworkspace/workbench/lib/open-edit';

/** Registers `commit` as the open edit each time the focus enters `mount`; returns the cleanup. */
export function commitWritingOnLeave(mount: HTMLElement, commit: () => void): () => void {
  let unregister: (() => void) | null = null;
  const onFocusIn = () => {
    unregister?.();
    unregister = registerOpenEdit(commit);
  };
  mount.addEventListener('focusin', onFocusIn);
  return () => {
    mount.removeEventListener('focusin', onFocusIn);
    unregister?.();
    unregister = null;
  };
}
