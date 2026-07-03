'use client';

import type { DragState } from '@/lib/canvas';
import { TopCenterBanner } from '@/components/chrome/TopCenter';
import { useShiftHeld } from '@/hooks/ui/useShiftHeld';

// The shift hint (spec/09): while Shift is held, a passive top-centre pill
// names what the modifier is doing right now — the chain / branch / lock /
// multi-select powers are invisible until tried. One concise message,
// picked most-specific-first; nothing while typing (the hook filters
// that), while another mode banner owns the slot, or with nothing to act
// on. Same chrome as the mode banners, minus the action button.
export function ShiftHintBanner({
  drag,
  selectedKind,
  hasElements,
  suppressed,
}: {
  drag: DragState | null;
  // The primary selection's flavour, for the no-drag hints.
  selectedKind: 'arrow' | 'table' | 'other' | null;
  // False on an empty canvas — nothing to multi-select.
  hasElements: boolean;
  // True while a mode banner (paint / group / draw) owns the top slot,
  // or the session is read-only.
  suppressed: boolean;
}) {
  const held = useShiftHeld();
  if (!held || suppressed) return null;
  const message = shiftHintMessage(drag, selectedKind, hasElements);
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[var(--z-modal)] flex justify-center">
      <TopCenterBanner tone="neutral" className="gap-2 px-3 py-1.5 text-xs">
        <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
          ⇧ Shift
        </kbd>
        <span className="font-medium">{message}</span>
      </TopCenterBanner>
    </div>
  );
}

function shiftHintMessage(
  drag: DragState | null,
  selectedKind: 'arrow' | 'table' | 'other' | null,
  hasElements: boolean,
): string | null {
  // Drawing a NEW arrow's endpoint (quick-connect drag or follow mode):
  // releasing / clicking with Shift chains the next arrow (spec/09).
  if (drag?.kind === 'arrow-endpoint' && drag.end === 'to' && !drag.reposition) {
    return 'Click places it and starts another arrow';
  }
  // Resizing: Shift locks the aspect ratio.
  if (drag?.kind === 'boxed' && drag.mode !== 'move') return 'Proportions locked';
  // Mid-gesture otherwise (move, curve handles, …): Shift does nothing.
  if (drag) return null;
  if (selectedKind === 'arrow') return 'Drag an arrowhead to split it into a branch';
  if (selectedKind === 'table') return 'Click cells to select several';
  return hasElements ? 'Click elements to select several' : null;
}
