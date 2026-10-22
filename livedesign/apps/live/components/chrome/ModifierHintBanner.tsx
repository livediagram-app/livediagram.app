'use client';

import { useCallback, type ComponentProps } from 'react';
import type { Element } from '@livedesign/document';
import type { DragState } from '@/lib/canvas';
import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import type { Selection } from '@/lib/selection-store';
import { TopCenterBanner } from '@/components/chrome/TopCenter';
import { PaletteTray, usePaletteStripBox } from '@/components/chrome/PaletteTray';
import { useShiftHeld } from '@/hooks/ui/useShiftHeld';

// The modifier hint (docs/specs/008-canvas/canvas-and-palette.md): a passive top-centre pill naming what
// a modifier does right now.
// The chain / branch / lock / multi-select powers are invisible until tried,
// and a held modifier nobody has heard of is a feature nobody finds. One
// concise message, picked most-specific-first; nothing while typing (the hook
// filters that), while another mode banner owns the slot, or with nothing to
// act on. Same chrome as the mode banners, minus the action button.
export function ModifierHintBanner({
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
  const shiftHeld = useShiftHeld();
  if (suppressed || !shiftHeld) return null;
  const message = shiftHintMessage(drag, selectedKind, hasElements);
  if (!message) return null;
  return <Hint modifier="⇧ Shift">{message}</Hint>;
}

// The selected element's flavour for the no-drag hints: an arrow, a table, anything else, or none.
export function selectedKindOf(
  elements: readonly Element[],
  selectedId: string | null,
): 'arrow' | 'table' | 'other' | null {
  const el = selectedId ? elements.find((e) => e.id === selectedId) : undefined;
  if (!el) return null;
  return el.type === 'arrow' ? 'arrow' : el.type === 'table' ? 'table' : 'other';
}

// The banner with its selection read from the store (docs/specs/008-canvas/blueprints/selection-store.md):
// a selection change renders this, not the editor view that places it.
export function ModifierHint({
  elements,
  readOnly = false,
  ...banner
}: {
  elements: readonly Element[];
  // A read-only session (a Participant, a Viewer) never splits an arrow, so a selected arrow gets the
  // general hint, not the branch one (docs/specs/013-workspace/share-roles.md).
  readOnly?: boolean;
} & Omit<ComponentProps<typeof ModifierHintBanner>, 'selectedKind'>) {
  const kind = useSelectionOf(
    useCallback((s: Selection) => selectedKindOf(elements, s.selectedId), [elements]),
  );
  const selectedKind = readOnly && kind === 'arrow' ? 'other' : kind;
  return <ModifierHintBanner {...banner} selectedKind={selectedKind} />;
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

function shiftHintMessage(
  drag: DragState | null,
  selectedKind: 'arrow' | 'table' | 'other' | null,
  hasElements: boolean,
): string | null {
  // Drawing a NEW arrow's endpoint (quick-connect drag or follow mode):
  // releasing / clicking with Shift chains the next arrow (docs/specs/008-canvas/canvas-and-palette.md).
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
