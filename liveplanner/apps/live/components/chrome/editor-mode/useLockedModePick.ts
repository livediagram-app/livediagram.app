import { editorModeLabel, type EditorMode } from '@liveplanner/document';
import { useConfirm } from '@/hooks/ui/useConfirm';

// A mode the tab cannot switch to (across Plan's line, or on a tab that keeps its mode) is a new tab in it, asked
// first (docs/specs/026-plan/plan-tabs.md, docs/specs/007-editor/editor-modes.md). Shared by the mode switch and the
// tab menu's Mode, so both ask the same question.
export function useLockedModePick({
  mode,
  lockedReason,
  newTabIn,
}: {
  // The tab's own mode.
  mode: EditorMode;
  lockedReason?: string | undefined;
  newTabIn?: ((mode: EditorMode) => void) | undefined;
}): (next: EditorMode) => Promise<void> {
  const confirm = useConfirm();
  return async (next) => {
    const name = editorModeLabel(next);
    // Plan stands apart (crossesPlan): a tab never switches into or out of it.
    const why =
      lockedReason ??
      (mode === 'plan' ? 'A Plan tab stays in Plan.' : 'Plan works in tabs of its own.');
    const ok = await confirm({
      title: `Open a New ${name} Tab?`,
      message: `${why} Its mode can’t change, but you can carry on in a new ${name} tab.`,
      confirmLabel: `New ${name} Tab`,
    });
    if (ok) newTabIn?.(next);
  };
}
