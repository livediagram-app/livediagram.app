'use client';

import type { DragState } from '@/lib/canvas';
import { TopCenterBanner } from '@/components/chrome/TopCenter';
import {
  PaletteTray,
  usePaletteStripBox,
} from '@liveworkspace/workbench/components/chrome/PaletteTray';
import { useShiftHeld } from '@liveworkspace/workbench/hooks/ui/useShiftHeld';

// The modifier hint (docs/specs/008-canvas/canvas-and-palette.md): a passive top-centre pill naming what
// a modifier does right now.
// The lock / multi-select powers are invisible until tried,
// and a held modifier nobody has heard of is a feature nobody finds. One
// concise message, picked most-specific-first; nothing while typing (the hook
// filters that), while another mode banner owns the slot, or with nothing to
// act on. Same chrome as the mode banners, minus the action button.
export function ModifierHintBanner({
  drag,
  hasElements,
  suppressed,
}: {
  drag: DragState | null;
  // False on an empty canvas — nothing to multi-select.
  hasElements: boolean;
  // True while a mode banner (paint / group / draw) owns the top slot,
  // or the session is read-only.
  suppressed: boolean;
}) {
  const shiftHeld = useShiftHeld();
  if (suppressed || !shiftHeld) return null;
  const message = shiftHintMessage(drag, hasElements);
  if (!message) return null;
  return <Hint modifier="⇧ Shift">{message}</Hint>;
}

const KEY_CHIP =
  'rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300';

// In the Toolbar layout the hint hangs from the strip as its tray (docs/specs/007-editor/toolbar-layout.md);
// elsewhere it is a top-centre pill.
function Hint({ modifier, children }: { modifier: string; children: React.ReactNode }) {
  const strip = usePaletteStripBox();
  if (strip) {
    return (
      <PaletteTray box={strip} lead={<kbd className={KEY_CHIP}>{modifier}</kbd>}>
        <span className="font-medium">{children}</span>
      </PaletteTray>
    );
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[var(--z-modal)] flex justify-center">
      <TopCenterBanner tone="neutral" className="gap-2 px-3 py-1.5 text-xs">
        <kbd className={KEY_CHIP}>{modifier}</kbd>
        <span data-mode-message="" className="font-medium">
          {children}
        </span>
      </TopCenterBanner>
    </div>
  );
}

function shiftHintMessage(drag: DragState | null, hasElements: boolean): string | null {
  // Resizing: Shift locks the aspect ratio.
  if (drag && drag.mode !== 'move') return 'Proportions locked';
  // Mid-move: Shift does nothing.
  if (drag) return null;
  return hasElements ? 'Click elements to select several' : null;
}
