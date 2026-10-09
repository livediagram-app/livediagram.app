'use client';

// Focus (docs/specs/026-plan/plan-board.md "Focus", docs/specs/029-sheets/sheet.md "Header"): in a board's or a
// Sheet's header, left of Maximise, a button that glides the view to fit the element, a margin round it. Not drawn
// while the element is maximised (it already fills the view) or outside an editor's canvas.
import { Tooltip, lucideGlyph } from '@livediagram/ui';
import { lucideScanEye } from '@livediagram/icons/lucide';
import { useCanvasFocus } from '@/hooks/canvas/useCanvasFocus';
import { track } from '@/lib/telemetry';
import type { PlanPalette } from './plan-palette';

const FocusIcon = lucideGlyph(lucideScanEye, 16);

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function FocusElementButton({
  bounds,
  kind,
  palette,
}: {
  bounds: { x: number; y: number; width: number; height: number };
  // What it focuses, for its name and telemetry.
  kind: 'Board' | 'Sheet';
  palette: PlanPalette;
}) {
  const focus = useCanvasFocus();
  if (!focus) return null;
  const label = `Focus ${kind}`;
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10"
        style={{ color: palette.muted }}
        onPointerDown={stop}
        onDoubleClick={stop}
        onClick={(e) => {
          e.stopPropagation();
          focus({ x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height });
          track('Plan', 'Toggled', kind === 'Board' ? 'BoardFocused' : 'SheetFocused');
        }}
      >
        <FocusIcon />
      </button>
    </Tooltip>
  );
}
