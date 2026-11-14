import { useCanvasTool } from '@/hooks/canvas/useCanvasTool';
import { useLaserConfig } from '@/hooks/canvas/useLaserConfig';
import { useFormatConfig } from '@liveworkspace/workbench/hooks/canvas/useFormatConfig';
import type { CanvasTool } from '@/components/palette/palette.types';
import { usePanelLayout } from '../usePanelLayout';
import { useEditorDialogs } from '../useEditorDialogs';
import { useFormatTool } from '@liveworkspace/workbench/hooks/editor/useFormatTool';
import type { EditorDocument } from './useEditorDocument';
import type { EditorSelection } from './useEditorSelection';

// The tools and the chrome flags around them: panel layout, dialogs, the laser pen and format painter settings, the
// canvas tool and the Format tool, and the user-facing tool picker.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorTools({
  documentSlice,
  selectionSlice,
}: {
  documentSlice: EditorDocument;
  selectionSlice: EditorSelection;
}) {
  // Unmemoised by the React Compiler, as the one hook it was cut from was (see ../useEditorState.ts).
  'use no memo';
  const { embedMode, tabs } = documentSlice;
  const { activeId, setSelectedId, setFormatSourceId, setMultiSelectedIds } = selectionSlice;
  // Drag state lives inside the useEditorDrag hook, lifted out of
  // this component to keep the page focused on orchestration. The
  // hook is invoked further down (after `tick`, `commit`,
  // `applyFormatFromSource` and the rest of the drag dependencies
  // exist).
  // Panel layout (positions + open/visible flags) is one
  // cohesive slice — see usePanelLayout. Spread wholesale into the
  // returned view-model (see the return below).
  const panelLayout = usePanelLayout();
  const dialogs = useEditorDialogs();
  // Canvas tool (Pan / Select / Laser). See useCanvasTool: the raw
  // setter serves internal auto-switches, the tracked selectCanvasTool
  // serves the user-facing pickers.
  // The laser pen (docs/specs/008-canvas/laser-panel.md): persisted per browser, published with every
  // laser sample, and edited from the Laser Panel.
  const laserPen = useLaserConfig();
  // The format painter's settings (docs/specs/008-canvas/format-panel.md): which parts of a copied style
  // travel, read by the paint and edited from the Format Panel.
  const formatSettings = useFormatConfig();
  const { canvasTool, setCanvasTool, selectCanvasTool } = useCanvasTool({
    defaultPan: embedMode,
  });
  // Persistent Format painter tool (docs/specs/008-canvas/canvas-and-palette.md): the mode-boundary reset +
  // the exit that restores the pre-Format tool. See useFormatTool.
  const { formatToolActive, exitFormatTool } = useFormatTool({
    canvasTool,
    setCanvasTool,
    setFormatSourceId,
  });
  // identityPromptOpen (from useEditorUiState) gates the derived
  // `identityOnlyScreenOpen` chrome flag; it closes through useTemplateFlow's
  // `confirmIdentity` / `cancelIdentity`.
  // User-facing tool picker. Spotlight (docs/specs/008-canvas/canvas-and-palette.md) is a non-editing presenter
  // mode, so entering it clears any selection: an element selected beforehand
  // would otherwise keep its handles (dimmed under the shroud) and pop back
  // on exit. Wraps the tracked selectCanvasTool so every entry point (palette
  // dropdown, keyboard) routes through it; internal auto-switches keep using
  // the raw setCanvasTool and are unaffected.
  const pickCanvasTool = (tool: CanvasTool) => {
    // Format / Laser / Spotlight all act on existing
    // content, so they're unavailable on an empty canvas — the palette greys
    // them out, and this guards the keyboard-shortcut path to match. Select +
    // Hand stay available.
    const tabForTool = tabs.find((t) => t.id === activeId) ?? tabs[0];
    if (
      tabForTool &&
      tabForTool.elements.length === 0 &&
      (tool === 'format' || tool === 'laser' || tool === 'spotlight')
    ) {
      return;
    }
    // Spotlight is a non-editing presenter mode, so it clears the selection on entry.
    if (tool === 'spotlight') {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
    }
    selectCanvasTool(tool);
  };

  return {
    panelLayout,
    dialogs,
    laserPen,
    formatSettings,
    canvasTool,
    setCanvasTool,
    formatToolActive,
    exitFormatTool,
    pickCanvasTool,
  };
}

export type EditorTools = ReturnType<typeof useEditorTools>;
