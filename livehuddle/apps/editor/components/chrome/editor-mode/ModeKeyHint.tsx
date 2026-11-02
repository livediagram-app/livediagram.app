import { EDITOR_MODE_KEY_LABEL } from './editor-mode-copy';

// The Shift+D hint the mode controls show beside a mode's name (docs/specs/007-editor/editor-modes.md
// "The mode switch"). Visual only: the controls announce it through `aria-keyshortcuts`.
export function ModeKeyHint() {
  return (
    <kbd
      aria-hidden
      className="shrink-0 rounded border border-slate-300 bg-slate-50 px-1 py-px font-sans text-[10px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
    >
      {EDITOR_MODE_KEY_LABEL}
    </kbd>
  );
}
