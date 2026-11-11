'use client';

import { useCanvasTool } from '@/hooks/canvas/useCanvasTool';
import { useFormatConfig } from '@liveworkspace/workbench/hooks/canvas/useFormatConfig';
import type { CanvasTool } from '@/components/palette/palette.types';
import { useShortcutsEnabled } from '@/hooks/ui/useShortcutsEnabled';
import { useFormatTool } from '../useFormatTool';
import { startPanelIsOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorSelectionSlice } from './useEditorSelection';

// The canvas tool (Select, Hand, Avatar and the rest), the Format painter, the shortcuts switch, and the pickers
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
  const { activeId, setFormatSourceId, setMultiSelectedIds, setSelectedId } = fromSelection;
  // Canvas tool (Pan / Select / Avatar ...). See useCanvasTool: the raw
  // setter serves internal auto-switches, the tracked selectCanvasTool
  // serves the user-facing pickers.
  // The format painter's settings (docs/specs/008-canvas/format-panel.md): which parts of a copied style
  // travel, read by the paint and edited from the Format Panel.
  const formatSettings = useFormatConfig();
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
  // Persistent Format painter tool (docs/specs/008-canvas/canvas-and-palette.md): the mode-boundary reset +
  // the exit that restores the pre-Format tool. See useFormatTool.
  const { formatToolActive, exitFormatTool, startFormatFrom } = useFormatTool({
    canvasTool,
    setCanvasTool,
    setFormatSourceId,
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
  // The selection toolbar's Format Painter (docs/specs/008-canvas/canvas-and-palette.md "Format painter"): the
  // painter on with the selected element loaded, the selection cleared so the toolbar steps out of the way.
  const startFormatPainter = (id: string) => {
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    startFormatFrom(id, pickCanvasTool);
  };

  // Keyboard-shortcut catalog modal + per-device disable toggle.
  // The toggle gates EVERY shortcut in useEditorKeyboardShortcuts
  // below; the modal opens from a button in the TabBar.
  const { enabled: shortcutsEnabled, setEnabled: setShortcutsEnabled } = useShortcutsEnabled();
  return {
    canvasTool,
    enterWalking,
    formatSettings,
    formatToolActive,
    holdWalking,
    keepWalkingTo,
    pickCanvasTool,
    setCanvasTool,
    shortcutsEnabled,
    view: {
      canvasTool,
      exitAvatarTool,
      exitFormatTool,
      startFormatPainter,
      setCanvasTool: pickCanvasTool,
      formatConfig: formatSettings.config,
      onToggleFormatGroup: formatSettings.toggleGroup,
      onSetFormatMode: formatSettings.setMode,
      pressModeButton,
      setShortcutsEnabled,
      shortcutsEnabled,
    },
  };
}

export type EditorToolsSlice = ReturnType<typeof useEditorTools>;
