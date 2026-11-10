import { useCanvasTool } from '@/hooks/canvas/useCanvasTool';
import { useShortcutsEnabled } from '@/hooks/ui/useShortcutsEnabled';
import { usePanelLayout } from '../usePanelLayout';
import { useEditorDialogs as useDialogFlags } from '../useEditorDialogs';
import type { EditorEnvSlice } from './useEditorEnv';

// A slice of the editor's state, composed by useEditorState in a fixed order (docs/development/architecture.md
// "The editor's shape"). It takes the slices composed before it and returns what the slices after it, and the
// view (editor-view.ts), read. Its hooks run in the order they did in the one hook this was split from, so the
// effects keep their order.
//
// The editor's UI flags: panel layout, the dialogs, the canvas tool and the keyboard-shortcuts switch.
export function useEditorDialogs(env: EditorEnvSlice) {
  const { embedMode } = env;
  // Drag state lives inside the useEditorDrag hook, lifted out of
  // this component to keep the page focused on orchestration. The
  // hook is invoked further down (after `tick`, `commit` and the rest
  // of the drag dependencies exist).
  // Panel layout (positions + open/visible flags) is one
  // cohesive slice — see usePanelLayout. Spread wholesale into the
  // returned view-model (see the return below).
  const panelLayout = usePanelLayout();
  const dialogs = useDialogFlags();
  // Canvas tool (Hand / Select). See useCanvasTool.
  const { canvasTool, setCanvasTool } = useCanvasTool({
    defaultPan: embedMode,
  });
  // Keyboard-shortcut catalog modal + per-device disable toggle.
  // The toggle gates EVERY shortcut in useEditorKeyboardShortcuts
  // below; the modal opens from a button in the TabBar.
  const { enabled: shortcutsEnabled, setEnabled: setShortcutsEnabled } = useShortcutsEnabled();
  return { canvasTool, dialogs, panelLayout, setCanvasTool, setShortcutsEnabled, shortcutsEnabled };
}

export type EditorDialogsSlice = ReturnType<typeof useEditorDialogs>;
