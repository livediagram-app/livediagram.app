'use client';

// What each of the dock's drawing tools is (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard
// shows"): its name, key, icon, whether it is in hand, the flyout a press on it in hand opens, and how
// it is armed. One table for the bar (DrawingToolsGroup) and More Tools (MoreToolsFlyout), so a folded
// tool reads exactly as it does on the bar.

import type { ReactNode } from 'react';
import {
  EditPointsIcon,
  EraserIcon,
  SelectIcon,
  ShapePenIcon,
} from '@/components/palette/palette-icons';
import { penColourCss } from '@livediagram/document';
import { FillToolIcon } from '@livediagram/ui';
import { FILL_TRANSPARENT } from '@liveworkspace/workbench/lib/fill-choice';
import { useCanvasSurface } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { WHITEBOARD_TOOL_KEYS } from '@/hooks/canvas/editor-shortcut-keys';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import type { DrawingTool } from '@/lib/whiteboard-dock-fold';
import { penLabel } from '@/lib/whiteboard-prefs';
import type { DockFlyoutKind } from './useDockFlyout';
import { DOCK_ICON_PX, PenGlyph, TextGlyph } from './whiteboard-icons';

export type DrawingToolSpec = {
  label: string;
  shortcut?: string;
  icon: ReactNode;
  inHand: boolean;
  // The flyout a press on the tool already in hand opens (a marker's, Fill's, the Eraser's).
  flyout?: DockFlyoutKind;
  // Puts the tool in hand (Select in a path's edit mode leaves the mode).
  arm: () => void;
};

export function useDrawingTools(
  model: WhiteboardDockModel,
  ink: string,
): (tool: DrawingTool) => DrawingToolSpec | null {
  // A named colour in its version for this board; the canvas the stock colours are drawn for
  // (docs/specs/007-editor/editor-modes.md "One look").
  const appearance = useCanvasSurface();
  const { tool: inHand, prefs } = model;
  return (tool) => {
    switch (tool) {
      case 'select':
        // In a path's edit mode (docs/specs/023-draw-mode/path-tool.md "Editing") Select shows the
        // path glyph, and pressing it leaves the mode.
        return {
          label: model.pathEditing ? 'Select, editing a path' : 'Select',
          shortcut: WHITEBOARD_TOOL_KEYS.select,
          icon: model.pathEditing ? (
            <EditPointsIcon size={DOCK_ICON_PX} />
          ) : (
            <SelectIcon size={DOCK_ICON_PX} />
          ),
          inHand: inHand === 'select',
          arm: model.pathEditing ? model.leavePathEdit : model.pickSelect,
        };
      case 'text':
        return {
          label: 'Text',
          shortcut: WHITEBOARD_TOOL_KEYS.text,
          icon: <TextGlyph />,
          inHand: inHand === 'text',
          arm: model.pickText,
        };
      case 'path':
        // The Path tool (docs/specs/023-draw-mode/path-tool.md), in the Shape Pen's own icon.
        return {
          label: 'Path tool',
          shortcut: WHITEBOARD_TOOL_KEYS.path,
          icon: <ShapePenIcon size={DOCK_ICON_PX} />,
          inHand: inHand === 'path',
          arm: model.pickPath,
        };
      case 'fill':
        // The Fill tool (docs/specs/023-draw-mode/fill-tool.md): a paint bucket over its colour.
        return {
          label: 'Fill',
          shortcut: WHITEBOARD_TOOL_KEYS.fill,
          icon: (
            <FillToolIcon
              colour={model.fill === FILL_TRANSPARENT ? null : model.fill}
              size={DOCK_ICON_PX}
            />
          ),
          inHand: inHand === 'fill',
          flyout: 'fill',
          arm: model.pickFill,
        };
      case 'eraser':
        return {
          label: 'Eraser',
          shortcut: WHITEBOARD_TOOL_KEYS.eraser,
          icon: <EraserIcon size={DOCK_ICON_PX} />,
          inHand: inHand === 'eraser',
          flyout: 'eraser',
          arm: model.pickEraser,
        };
      default: {
        const pen = prefs.pens.find((p) => p.id === tool);
        if (!pen) return null;
        return {
          label: penLabel(pen),
          shortcut: WHITEBOARD_TOOL_KEYS[pen.id],
          icon: <PenGlyph colour={penColourCss(pen.colour, appearance, ink)} width={pen.width} />,
          inHand: inHand === 'pen' && prefs.activePenId === pen.id,
          flyout: pen.id,
          arm: () => model.pickPen(pen.id),
        };
      }
    }
  };
}
