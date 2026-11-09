'use client';

import { useCanvasTool } from '@/hooks/canvas/useCanvasTool';
import { useDesktopOnlyToolExit } from '@/hooks/canvas/useDesktopOnlyToolExit';
import { isMobileViewportSync } from '@liveworkspace/workbench/lib/responsive';
import { useLaserConfig } from '@/hooks/canvas/useLaserConfig';
import { useEraserConfig } from '@/hooks/canvas/useEraserConfig';
import { useFormatConfig } from '@/hooks/canvas/useFormatConfig';
import type { CanvasTool } from '@/components/palette/palette.types';
import { useShortcutsEnabled } from '@/hooks/ui/useShortcutsEnabled';
import { useFormatTool } from '../useFormatTool';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorHistory';
import type { EditorSelectionSlice } from './useEditorSelection';

// The canvas tool (Select, Hand, Laser, Eraser, Format and the rest), its per-browser settings, the shortcuts
// switch, and the pickers that guard a tool change. A slice of useEditorState (../useEditorState.ts): it takes
// the slices composed before it and returns its own, with `view`, its part of the editor's view-model.
export function useEditorTools({
  fromDocument,
  fromHistory,
  fromSelection,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
}) {
  const { embedMode, toast } = fromDocument;
  const { tabs } = fromHistory;
  const { activeId, setFormatSourceId, setMultiSelectedIds, setSelectedId, tabScopeRef } =
    fromSelection;
  // Canvas tool (Pan / Select / Laser). See useCanvasTool: the raw
  // setter serves internal auto-switches, the tracked selectCanvasTool
  // serves the user-facing pickers.
  // The laser pen (docs/specs/008-canvas/laser-panel.md): persisted per browser, published with every
  // laser sample, and edited from the Laser Panel.
  const laserPen = useLaserConfig();
  // The eraser's settings (docs/specs/008-canvas/eraser-panel.md): read by the erase gesture below and
  // edited from the Eraser Panel.
  const eraserSettings = useEraserConfig();
  // The format painter's settings (docs/specs/008-canvas/format-panel.md): which parts of a copied style
  // travel, read by the paint and edited from the Format Panel.
  const formatSettings = useFormatConfig();
  const { canvasTool, setCanvasTool, selectCanvasTool, toolBeforeCurrent } = useCanvasTool({
    defaultPan: embedMode,
  });
  useDesktopOnlyToolExit(canvasTool, setCanvasTool);
  // Persistent Format painter tool (docs/specs/008-canvas/canvas-and-palette.md): the mode-boundary reset +
  // the exit that restores the pre-Format tool. See useFormatTool.
  const { formatToolActive, exitFormatTool } = useFormatTool({
    canvasTool,
    setCanvasTool,
    setFormatSourceId,
  });

  // User-facing tool picker. Spotlight (docs/specs/008-canvas/canvas-and-palette.md) is a non-editing presenter
  // mode, so entering it clears any selection: an element selected beforehand
  // would otherwise keep its handles (dimmed under the shroud) and pop back
  // on exit. Wraps the tracked selectCanvasTool so every entry point (palette
  // dropdown, keyboard) routes through it; internal auto-switches keep using
  // the raw setCanvasTool and are unaffected.
  const pickCanvasTool = (tool: CanvasTool) => {
    // Eraser / Format / Laser / Spotlight / Isometric all act on existing
    // content, so they're unavailable on an empty canvas — the palette greys
    // them out, and this guards the keyboard-shortcut path to match. Select +
    // Hand stay available.
    const tabForTool = tabs.find((t) => t.id === activeId) ?? tabs[0];
    if (
      tabForTool &&
      tabForTool.elements.length === 0 &&
      (tool === 'eraser' ||
        tool === 'format' ||
        tool === 'laser' ||
        tool === 'spotlight' ||
        tool === 'isometric')
    ) {
      return;
    }
    // A slide deck spans tabs, so a tab-scoped session has none
    // (docs/specs/013-workspace/tab-scoped-share-links.md): the server withholds it and refuses writes.
    if (tool === 'slide-deck' && tabScopeRef.current !== null) {
      toast.info("The slide deck isn't shared with you");
      return;
    }
    // Desktop-only (docs/specs/012-collaboration/presentation-mode.md): the pickers
    // already hide it on a phone, so this catches any path that still asks.
    if (tool === 'slide-deck' && isMobileViewportSync()) {
      toast.info('Slide Deck is only available on a larger screen');
      return;
    }
    // Spotlight is a non-editing presenter mode, so it clears the selection on entry.
    if (tool === 'spotlight') {
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
    eraserSettings,
    formatSettings,
    formatToolActive,
    laserPen,
    pickCanvasTool,
    selectCanvasTool,
    setCanvasTool,
    shortcutsEnabled,
    view: {
      canvasTool,
      exitFormatTool,
      setCanvasTool: pickCanvasTool,
      laserConfig: laserPen.config,
      onChangeLaserField: laserPen.setField,
      eraserConfig: eraserSettings.config,
      onChangeEraserField: eraserSettings.setField,
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
