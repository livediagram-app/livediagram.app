'use client';

// More Tools (docs/specs/023-draw-mode/draw-mode.md "When the bar is too wide"): the drawing tools a
// bar too wide for its room folded, one row of tiles in bar order, each as the bar shows it (icon,
// name, key) and the one in hand marked. A press arms the tool and closes the menu; a press on the
// tool already in hand opens its own flyout in the menu's place, pointing at More Tools.

import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import { foldedInBarOrder, type FoldableTool } from '@/lib/whiteboard-dock-fold';
import { useDrawingTools } from './drawing-tools';
import type { DockFlyoutApi } from './useDockFlyout';
import { FlyoutOption } from './WhiteboardFlyout';

export function MoreToolsFlyout({
  model,
  ink,
  folded,
  fly,
  pickAndClose,
}: {
  model: WhiteboardDockModel;
  ink: string;
  folded: ReadonlySet<FoldableTool>;
  fly: DockFlyoutApi;
  pickAndClose: (pick: () => void) => void;
}) {
  const specOf = useDrawingTools(model, ink);
  const tools = foldedInBarOrder(
    model.prefs.pens.map((p) => p.id),
    folded,
  );
  return (
    <div role="group" aria-label="Folded tools" className="flex gap-1">
      {tools.map((tool) => {
        const spec = specOf(tool);
        if (!spec) return null;
        return (
          <FlyoutOption
            key={tool}
            label={spec.label}
            shortcut={spec.shortcut}
            selected={spec.inHand}
            onPick={() => {
              const opener = document.querySelector<HTMLElement>(
                '[data-whiteboard-dock] [data-dock-item="more"]',
              );
              if (spec.flyout && spec.inHand && opener) fly.open(spec.flyout, opener);
              else pickAndClose(spec.arm);
            }}
          >
            {spec.icon}
          </FlyoutOption>
        );
      })}
    </div>
  );
}
