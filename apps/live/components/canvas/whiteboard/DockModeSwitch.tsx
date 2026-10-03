import {
  EditorModeSwitch,
  useEditorModeSwitchShown,
} from '@/components/chrome/editor-mode/EditorModeSwitch';

// The editor mode switch leading the dock in the Floating layout (docs/specs/007-editor/editor-modes.md
// "The mode switch"): the dock takes the Palette's place in Draw mode, so the switch the Palette
// carries in Diagram mode moves here, labelled, in a pill of its own beside the dock's groups. It
// sits outside the groups' scroller, which would clip its menu; `mr-6` makes the usual 12px gap
// against the scroller's -m-3. Nothing where no switch is offered.
export function DockModeSwitch() {
  if (!useEditorModeSwitchShown()) return null;
  return (
    <div className="pointer-events-auto relative mr-6 flex shrink-0 animate-pop-in items-center rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40">
      <EditorModeSwitch labelled />
    </div>
  );
}
