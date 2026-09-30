'use client';

// The dock's Drawing tools group (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"):
// Select, Markers 1 to 3, Text, Sticky note, Path tool and Eraser, in every dock mode. A pen or the
// eraser already in hand opens its flyout.

import {
  EditPointsIcon,
  EraserIcon,
  SelectIcon,
  ShapePenIcon,
} from '@/components/palette/palette-icons';
import { penLabel } from '@/lib/whiteboard-prefs';
import { WHITEBOARD_TOOL_KEYS } from '@/hooks/canvas/editor-shortcut-keys';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import { DockButton, DockDivider, DockToolbar } from './DockToolbar';
import type { DockFlyoutApi } from './useDockFlyout';
import { DOCK_ICON_PX, PenGlyph, StickyGlyph, TextGlyph } from './whiteboard-icons';

export function DrawingToolsGroup({
  model,
  ink,
  fly,
  pickAndClose,
}: {
  model: WhiteboardDockModel;
  ink: string;
  fly: DockFlyoutApi;
  pickAndClose: (pick: () => void) => void;
}) {
  const { tool, prefs } = model;
  const expanded = (kind: string) => fly.flyout?.kind === kind;
  return (
    <DockToolbar label="Drawing tools" group="drawing">
      {/* In a path's edit mode (docs/specs/023-whiteboard/path-tool.md "Editing") Select shows the
          path glyph, and pressing it leaves the mode. */}
      <DockButton
        itemKey="select"
        label={model.pathEditing ? 'Select, editing a path' : 'Select'}
        shortcut={WHITEBOARD_TOOL_KEYS.select}
        icon={
          model.pathEditing ? (
            <EditPointsIcon size={DOCK_ICON_PX} />
          ) : (
            <SelectIcon size={DOCK_ICON_PX} />
          )
        }
        pressed={tool === 'select'}
        onPress={() => pickAndClose(model.pathEditing ? model.leavePathEdit : model.pickSelect)}
      />
      <DockDivider />
      {prefs.pens.map((pen) => {
        const inHand = tool === 'pen' && prefs.activePenId === pen.id;
        return (
          <DockButton
            key={pen.id}
            itemKey={pen.id}
            label={penLabel(pen)}
            shortcut={WHITEBOARD_TOOL_KEYS[pen.id]}
            icon={<PenGlyph colour={pen.colour ?? ink} width={pen.width} />}
            pressed={inHand}
            controls={{ id: `whiteboard-flyout-${pen.id}`, expanded: expanded(pen.id) }}
            onPress={(el) =>
              inHand ? fly.toggle(pen.id, el) : pickAndClose(() => model.pickPen(pen.id))
            }
            onContext={() => model.resetPen(pen.id)}
          />
        );
      })}
      <DockDivider />
      <DockButton
        itemKey="text"
        label="Text"
        shortcut={WHITEBOARD_TOOL_KEYS.text}
        icon={<TextGlyph />}
        pressed={tool === 'text'}
        onPress={() => pickAndClose(model.pickText)}
      />
      <DockButton
        itemKey="sticky"
        label="Sticky note"
        shortcut={WHITEBOARD_TOOL_KEYS.sticky}
        icon={<StickyGlyph />}
        pressed={tool === 'sticky'}
        onPress={() => pickAndClose(model.pickSticky)}
      />
      {/* The Path tool (docs/specs/023-whiteboard/path-tool.md), in the Shape Pen's own icon. */}
      <DockButton
        itemKey="path"
        label="Path tool"
        shortcut={WHITEBOARD_TOOL_KEYS.path}
        icon={<ShapePenIcon size={DOCK_ICON_PX} />}
        pressed={tool === 'path'}
        onPress={() => pickAndClose(model.pickPath)}
      />
      <DockDivider />
      <DockButton
        itemKey="eraser"
        label="Eraser"
        shortcut={WHITEBOARD_TOOL_KEYS.eraser}
        icon={<EraserIcon size={DOCK_ICON_PX} />}
        pressed={tool === 'eraser'}
        controls={{ id: 'whiteboard-flyout-eraser', expanded: expanded('eraser') }}
        onPress={(el) =>
          tool === 'eraser' ? fly.toggle('eraser', el) : pickAndClose(model.pickEraser)
        }
      />
    </DockToolbar>
  );
}
