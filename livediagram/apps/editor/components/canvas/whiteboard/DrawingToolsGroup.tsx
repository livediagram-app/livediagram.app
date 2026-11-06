'use client';

// The dock's Drawing tools group (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows"):
// Select, Markers 1 to 3, Text, Path tool, Fill and Eraser; the sticky note is a shape (the Shapes
// group). A pen, the Fill tool or the eraser already in hand opens its flyout. A bar too wide for its
// room folds the least-used tools into More Tools at the end ("When the bar is too wide").

import { Fragment } from 'react';
import { EllipsisIcon } from '@livediagram/ui';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import { drawingRuns, type FoldableTool } from '@/lib/whiteboard-dock-fold';
import { DockButton, DockDivider, DockToolbar } from './DockToolbar';
import { useDrawingTools } from './drawing-tools';
import type { DockFlyoutApi } from './useDockFlyout';

export const MORE_TOOLS_LABEL = 'More Tools';

export function DrawingToolsGroup({
  model,
  ink,
  fly,
  folded,
  pickAndClose,
}: {
  model: WhiteboardDockModel;
  ink: string;
  fly: DockFlyoutApi;
  // The tools in More Tools rather than on the bar.
  folded: ReadonlySet<FoldableTool>;
  pickAndClose: (pick: () => void) => void;
}) {
  const specOf = useDrawingTools(model, ink);
  const runs = drawingRuns(
    model.prefs.pens.map((p) => p.id),
    folded,
  );
  const foldedInHand = [...folded].some((tool) => specOf(tool)?.inHand);
  return (
    <DockToolbar label="Drawing tools" group="drawing">
      {runs.map((run, i) => (
        <Fragment key={run[0]}>
          {i > 0 ? <DockDivider /> : null}
          {run.map((tool) => {
            const spec = specOf(tool);
            if (!spec) return null;
            const { flyout } = spec;
            return (
              <DockButton
                key={tool}
                itemKey={tool}
                label={spec.label}
                shortcut={spec.shortcut}
                icon={spec.icon}
                pressed={spec.inHand}
                controls={
                  flyout
                    ? { id: `whiteboard-flyout-${flyout}`, expanded: fly.flyout?.kind === flyout }
                    : undefined
                }
                onPress={(el) =>
                  flyout && spec.inHand ? fly.toggle(flyout, el) : pickAndClose(spec.arm)
                }
                // A right-click on a marker puts it back as it came.
                onContext={
                  tool === 'main' || tool === 'second' || tool === 'third'
                    ? () => model.resetPen(tool)
                    : undefined
                }
              />
            );
          })}
        </Fragment>
      ))}
      {folded.size > 0 ? (
        <DockButton
          itemKey="more"
          label={MORE_TOOLS_LABEL}
          icon={<EllipsisIcon />}
          // A folded tool in hand: the bar still says a tool is held.
          pressed={foldedInHand}
          // Expanded too while a folded tool's own flyout, opened from here, is up.
          controls={{
            id: `whiteboard-flyout-${fly.flyout?.openerKey === 'more' ? fly.flyout.kind : 'more'}`,
            expanded: fly.flyout?.openerKey === 'more',
          }}
          onPress={(el) => fly.toggle('more', el)}
        />
      ) : null}
    </DockToolbar>
  );
}
