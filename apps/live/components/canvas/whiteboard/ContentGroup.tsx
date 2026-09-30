'use client';

// The dock's Content group (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"): Text,
// Sticky note and the Path tool, between the drawing tools and the shapes. Only in the With shapes
// mode; their keys (T, N, P) work in every mode.

import { ShapePenIcon } from '@/components/palette/palette-icons';
import { WHITEBOARD_TOOL_KEYS } from '@/hooks/canvas/editor-shortcut-keys';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import { DockButton, DockToolbar } from './DockToolbar';
import { DOCK_ICON_PX, StickyGlyph, TextGlyph } from './whiteboard-icons';

export function ContentGroup({
  model,
  pickAndClose,
}: {
  model: WhiteboardDockModel;
  pickAndClose: (pick: () => void) => void;
}) {
  return (
    <DockToolbar label="Content" group="content">
      <DockButton
        itemKey="text"
        label="Text"
        shortcut={WHITEBOARD_TOOL_KEYS.text}
        icon={<TextGlyph />}
        pressed={model.tool === 'text'}
        onPress={() => pickAndClose(model.pickText)}
      />
      <DockButton
        itemKey="sticky"
        label="Sticky note"
        shortcut={WHITEBOARD_TOOL_KEYS.sticky}
        icon={<StickyGlyph />}
        pressed={model.tool === 'sticky'}
        onPress={() => pickAndClose(model.pickSticky)}
      />
      {/* The Path tool (docs/specs/023-whiteboard/path-tool.md), in the Shape Pen's own icon. */}
      <DockButton
        itemKey="path"
        label="Path tool"
        shortcut={WHITEBOARD_TOOL_KEYS.path}
        icon={<ShapePenIcon size={DOCK_ICON_PX} />}
        pressed={model.tool === 'path'}
        onPress={() => pickAndClose(model.pickPath)}
      />
    </DockToolbar>
  );
}
