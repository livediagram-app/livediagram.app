'use client';

import { memo, useCallback, type ComponentProps, type ReactNode } from 'react';
import { useSelectionOf } from '../../hooks/canvas/useSelectionStore';
import { useShiftHeld } from '../../hooks/ui/useShiftHeld';
import type { Selection } from '../../lib/selection-store';
import { PaletteTray, usePaletteStripBox } from './PaletteTray';
import { TopCenterBanner } from './TopCenter';

// The modifier hint (each editor's docs/specs/008-canvas/canvas-and-palette.md), every editor's one copy: a passive
// top-centre pill naming what a modifier does right now, or, while a drag is in hand, what one COULD do (an editor
// hands that offer in as `altHint`). The chain / branch / lock / multi-select powers are invisible until tried, and a
// held modifier nobody has heard of is a feature nobody finds. One concise message, picked most-specific-first;
// nothing while typing (useShiftHeld filters that), while another mode banner owns the slot, or with nothing to act
// on. Same chrome as the mode banners, minus the action button.

/** What the hint reads of a canvas drag: each editor's DragState, as far as the Shift message cares. */
export type HintDrag = {
  readonly kind: string;
  readonly mode?: unknown;
  readonly end?: unknown;
  readonly reposition?: unknown;
};

/** The primary selection's flavour, for the no-drag hints. */
export type HintSelectedKind = 'arrow' | 'table' | 'other' | null;

export function ModifierHintBanner({
  drag,
  selectedKind = null,
  hasElements,
  suppressed = false,
  altHint = null,
  shiftMessage = null,
}: {
  drag: HintDrag | null;
  selectedKind?: HintSelectedKind;
  // False on an empty canvas: nothing to multi-select.
  hasElements: boolean;
  // True while a mode banner (paint / group / draw) owns the top slot, or the session is read-only.
  suppressed?: boolean;
  // An Alt gesture on offer right now (livediagram's insert between, docs/specs/021-event-storming/event-storming.md),
  // shown while Shift is up: Shift's own gesture (drag-duplicate) owns the drag while it is down, so offering a second
  // meaning for the same drag would be a lie.
  altHint?: string | null;
  // What Shift does in place of the canvas's messages (livehuddle's walk, where Shift runs).
  shiftMessage?: string | null;
}) {
  const shiftHeld = useShiftHeld();
  if (suppressed) return null;
  if (!shiftHeld) {
    // "Press", not "Hold", in the offer's words: a window manager that claims Alt+press (Cinnamon's default, and
    // others') never lets the page see a drag that STARTED with Alt down. Pressing it mid-drag always works.
    return altHint ? <ModifierHintPill modifier="Alt">{altHint}</ModifierHintPill> : null;
  }
  const message = shiftMessage ?? shiftHintMessage(drag, selectedKind, hasElements);
  if (!message) return null;
  return <ModifierHintPill modifier="⇧ Shift">{message}</ModifierHintPill>;
}

/** The selected element's flavour for the no-drag hints: an arrow, a table, anything else, or none. */
export function selectedKindOf(
  elements: readonly { readonly id: string; readonly type: string }[],
  selectedId: string | null,
): HintSelectedKind {
  const el = selectedId ? elements.find((e) => e.id === selectedId) : undefined;
  if (!el) return null;
  return el.type === 'arrow' ? 'arrow' : el.type === 'table' ? 'table' : 'other';
}

// The banner with its selection read from the store (docs/specs/008-canvas/blueprints/selection-store.md): a selection
// change renders this, not the editor view that places it. Memoised, so the editor view's own renders (a typing
// commit among them) skip it while its props hold (livedocuments docs/specs/007-editor/blueprints/flashcards.md
// "Performance and limits").
export const ModifierHint = memo(function ModifierHint({
  elements,
  readOnly = false,
  ...banner
}: {
  elements: readonly { readonly id: string; readonly type: string }[];
  // A read-only session (a Participant, a Viewer) never splits an arrow, so a selected arrow gets the general hint,
  // not the branch one (docs/specs/013-workspace/share-roles.md).
  readOnly?: boolean;
} & Omit<ComponentProps<typeof ModifierHintBanner>, 'selectedKind'>) {
  const kind = useSelectionOf(
    useCallback((s: Selection) => selectedKindOf(elements, s.selectedId), [elements]),
  );
  const selectedKind = readOnly && kind === 'arrow' ? 'other' : kind;
  return <ModifierHintBanner {...banner} selectedKind={selectedKind} />;
});

const KEY_CHIP =
  'rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300';

/** The hint's pill: in the Toolbar layout it sits just under the strip as its tray (docs/specs/007-editor/
 *  toolbar-layout.md); elsewhere it is a top-centre pill. */
export function ModifierHintPill({
  modifier,
  children,
}: {
  modifier: string;
  children: ReactNode;
}) {
  const strip = usePaletteStripBox();
  if (strip) {
    return (
      <PaletteTray box={strip} lead={<kbd className={KEY_CHIP}>{modifier}</kbd>}>
        <span className="font-medium">{children}</span>
      </PaletteTray>
    );
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[var(--z-modal)] flex justify-center px-3">
      <TopCenterBanner
        tone="neutral"
        shape="card"
        className="gap-2 px-3 py-1.5 text-xs leading-snug"
      >
        <kbd className={KEY_CHIP}>{modifier}</kbd>
        <span data-mode-message="" className="font-medium">
          {children}
        </span>
      </TopCenterBanner>
    </div>
  );
}

/** What holding Shift does now, most specific first, or null when it does nothing worth naming. */
export function shiftHintMessage(
  drag: HintDrag | null,
  selectedKind: HintSelectedKind,
  hasElements: boolean,
): string | null {
  // Drawing a NEW arrow's endpoint (quick-connect drag or follow mode): releasing / clicking with Shift chains the
  // next arrow (docs/specs/008-canvas/canvas-and-palette.md).
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
