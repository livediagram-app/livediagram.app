'use client';

// A start panel's mode switch (docs/specs/007-editor/start-diagramming.md "Changing mode"): the editor's own mode
// switch (ModeMenuChip), named, leading every start panel's rail, so a tab begun in the
// wrong mode can change before anything is made. The same rules as the top chrome's: Plan stands apart, so from a
// Plan tab (or into Plan) it offers a new tab instead. Nothing where the switch is not offered. A change runs as a
// `start-mode` transition, which StartViewTransition cross-fades, never blinking the panel's content out.
import { useEditorModeState } from '@/components/chrome/editor-mode/editor-mode-context';
import { ModeMenuChip } from '@/components/chrome/editor-mode/ModeMenuChip';
import { startTypedTransition } from '@/lib/view-transition';
import { START_MODE_TRANSITION } from './StartViewTransition';

export function StartModeSwitch() {
  const editorMode = useEditorModeState();
  if (!editorMode?.canEdit || (!editorMode.canSwitch && !editorMode.lockedReason)) return null;
  return (
    <div data-start-mode-switch className="flex w-full shrink-0 sm:w-auto">
      <ModeMenuChip
        mode={editorMode.mode}
        onChange={(mode) =>
          startTypedTransition(START_MODE_TRANSITION, () => editorMode.setMode(mode))
        }
        newTabIn={editorMode.newTabIn}
        crossPlan={editorMode.crossPlan}
        labelled
        {...(editorMode.canSwitch ? {} : { lockedReason: editorMode.lockedReason })}
      />
    </div>
  );
}
