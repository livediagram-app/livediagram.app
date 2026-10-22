'use client';

// A marker's flyout (docs/specs/023-draw-mode/drawing-tools.md "Markers"): its colour and width.

import type { ReactNode } from 'react';
import {
  WHITEBOARD_PEN_WIDTHS,
  PEN_NAMES,
  penAdjustsColour,
  type WhiteboardPen,
} from '@/lib/whiteboard-prefs';
import type { MarkerPensModel } from '@/hooks/canvas/useMarkerPens';
import { FlyoutHeading, FlyoutOption } from './WhiteboardFlyout';
import { ColourPicker } from './ColourPicker';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { PenWidthIcon } from './PenWidthIcon';

export function PenFlyoutBody({ pen, model }: { pen: WhiteboardPen; model: MarkerPensModel }) {
  // The canvas the stock colours are drawn for.
  const appearance = useCanvasSurface();
  return (
    <div className="flex flex-col gap-3">
      {/* The main marker always stays the canvas ink: its flyout is the width only. The others get
          the colour picker. */}
      {penAdjustsColour(pen) ? (
        <ColourPicker
          value={pen.colour}
          board={appearance}
          onPick={(colour) => model.updatePen(pen.id, { colour })}
        />
      ) : null}
      <FlyoutRow label="Width">
        {WHITEBOARD_PEN_WIDTHS.map((w) => (
          <FlyoutOption
            key={w.id}
            label={w.label}
            selected={pen.width === w.px}
            onPick={() => model.updatePen(pen.id, { width: w.px })}
          >
            <PenWidthIcon width={w.id} />
          </FlyoutOption>
        ))}
      </FlyoutRow>
    </div>
  );
}

// Named by its place, so "which marker am I editing" never changes under the pointer.
export const penFlyoutLabel = (pen: WhiteboardPen) => PEN_NAMES[pen.id];

// A section of switch buttons, headed in the flyouts' small capitals.
function FlyoutRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <FlyoutHeading className="mb-1.5">{label}</FlyoutHeading>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}
