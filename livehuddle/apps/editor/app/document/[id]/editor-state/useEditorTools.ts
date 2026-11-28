'use client';

import { useCanvasTool } from '@/hooks/canvas/useCanvasTool';
import type { CanvasTool } from '@/components/palette/palette.types';
import { useShortcutsEnabled } from '@/hooks/ui/useShortcutsEnabled';
import { startPanelIsOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorSelectionSlice } from './useEditorSelection';

// The canvas tool (Edit, Walk), the shortcuts switch, and the pickers
// that guard a tool change. A slice of useEditorState (../useEditorState.ts): it takes the slices composed
// before it and returns its own, with `view`, its part of the editor's view-model.
export function useEditorTools({
  fromDocument,
  fromSelection,
}: {
  fromDocument: EditorDocumentSlice;
  fromSelection: EditorSelectionSlice;
}) {
  const { embedMode } = fromDocument;
  const { activeId, setMultiSelectedIds, setSelectedId } = fromSelection;
  // Canvas tool (Pan / Select / Avatar ...). See useCanvasTool: the raw
  // setter serves internal auto-switches, the tracked selectCanvasTool
  // serves the user-facing pickers.
  const {
    canvasTool,
    setCanvasTool,
    selectCanvasTool,
    openWalking: enterWalking,
    exitAvatarTool,
    toolBeforeCurrent,
    keepWalkingTo,
    holdWalking,
  } = useCanvasTool({
    defaultPan: embedMode,
    tabId: activeId,
  });

  // User-facing tool picker. Avatar mode is a non-editing mode, so entering it clears any selection. Wraps the tracked selectCanvasTool so every entry point (palette
  // dropdown, keyboard) routes through it; internal auto-switches keep using
  // the raw setCanvasTool and are unaffected.
  const pickCanvasTool = (tool: CanvasTool) => {
    // No walking while Start a Space is in front of the canvas (docs/specs/008-canvas/avatar-mode.md "Not over a
    // start"): the toggle's Walk greys out, and this guards every other way in (Search, a board's button) to match.
    // A Participant or a Viewer held walking (share-roles.md "Always walking") is refused every other tool by
    // useCanvasTool's hold, which selectCanvasTool below goes through.
    if (tool === 'avatar' && canvasTool !== 'avatar' && startPanelIsOpen()) return;
    // Avatar mode (docs/specs/008-canvas/avatar-mode.md) is a non-editing mode, so it clears the selection on entry.
    if (tool === 'avatar') {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
    }
    selectCanvasTool(tool);
  };
  // Pressing a Selection Mode button (docs/specs/009-elements/mode-button.md). Pressing the button for the
  // mode you are ALREADY in takes you back where you came from: on a read-only
  // walkthrough the button may be the only control on screen, so it has to work
  // in both directions. Everything else is an ordinary pick, guards included.
  const pressModeButton = (mode: CanvasTool) => {
    pickCanvasTool(canvasTool === mode ? toolBeforeCurrent() : mode);
  };

  // Keyboard-shortcut catalog modal + per-device disable toggle.
  // The toggle gates EVERY shortcut in useEditorKeyboardShortcuts
  // below; the modal opens from a button in the TabBar.
  const { enabled: shortcutsEnabled, setEnabled: setShortcutsEnabled } = useShortcutsEnabled();
  return {
    canvasTool,
    enterWalking,
    holdWalking,
    keepWalkingTo,
    pickCanvasTool,
    setCanvasTool,
    shortcutsEnabled,
    view: {
      canvasTool,
      exitAvatarTool,
      setCanvasTool: pickCanvasTool,
      pressModeButton,
      setShortcutsEnabled,
      shortcutsEnabled,
    },
  };
}

export type EditorToolsSlice = ReturnType<typeof useEditorTools>;
