'use client';

// "Add a card" (docs/specs/026-plan/plan-board.md "Working on a board"): a cell's Add card button
// opens this popover, as Illustrate's + opens "Add a page". It offers the card types the board shows,
// each a tile with its glyph on its colour; choosing one adds a card of it (titled "New task"...) at
// the end of the cell, to be titled in place or in its panel. Arrow keys move between tiles; Escape or
// an outside press closes. On a phone it is a bottom sheet.
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { type ItemFields, type ItemTypeDef } from '@livediagram/items';
import { useClickOutside, useEscape } from '@livediagram/ui';
import { Portal } from '@livediagram/ui';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, ACCENT_TINT, accentVars } from './plan-palette';

const WIDTH = 300;
const GAP = 8;
const COLUMNS = 3;

export type NewCard = { type: string; fields: ItemFields };

export function AddCardPopover({
  getAnchor,
  types,
  onAdd,
  onClose,
}: {
  // The Add card button the popover hangs from.
  getAnchor: () => HTMLElement | null;
  // The types this board shows, in the document's order.
  types: readonly ItemTypeDef[];
  onAdd: (card: NewCard) => void;
  onClose: (restoreFocus: boolean) => void;
}) {
  const mobile = useIsMobileViewport();
  const box = useRef<HTMLDivElement>(null);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const a = getAnchor()?.getBoundingClientRect();
    if (!a) return;
    const h = box.current?.offsetHeight ?? 0;
    // Under the button, from its left edge, kept inside the window.
    const left = Math.max(EDGE, Math.min(a.left, window.innerWidth - WIDTH - EDGE));
    const below = a.bottom + GAP;
    const top = below + h + EDGE <= window.innerHeight ? below : Math.max(EDGE, a.top - GAP - h);
    setPos({ left, top });
    tiles.current[0]?.focus({ preventScroll: true });
  }, [getAnchor]);
  useClickOutside(box, () => onClose(false), true, '[data-add-card-trigger]');
  useEscape(() => onClose(true), { capture: true, stopPropagation: true });

  const choose = (type: ItemTypeDef) => {
    onClose(false);
    onAdd({ type: type.id, fields: { title: type.newTitle } });
  };
  const onTilesKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === 'ArrowLeft'
        ? -1
        : e.key === 'ArrowRight'
          ? 1
          : e.key === 'ArrowUp'
            ? -COLUMNS
            : e.key === 'ArrowDown'
              ? COLUMNS
              : 0;
    if (!step) return;
    e.preventDefault();
    const at = tiles.current.findIndex((t) => t === document.activeElement);
    const next = Math.max(0, Math.min(types.length - 1, at + step));
    tiles.current[next]?.focus();
  };

  const body = (
    <div
      className={mobile ? 'flex flex-col gap-2.5 px-4 pb-3' : 'flex flex-col gap-2.5 p-3'}
      // Keys typed here are the popover's, never the canvas's shortcuts.
      onKeyDown={(e) => e.stopPropagation()}
    >
      <p className="px-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Add a Card</p>
      <div
        role="group"
        aria-label="Card types"
        onKeyDown={onTilesKey}
        className="grid grid-cols-3 gap-1.5"
      >
        {types.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tiles.current[i] = el;
            }}
            type="button"
            onClick={() => choose(t)}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 px-1.5 py-2.5 text-[12px] font-medium text-slate-700 outline-none transition hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-md ${ACCENT_TINT} ${ACCENT_TEXT}`}
              style={accentVars(t.color)}
              aria-hidden
            >
              <PlanTypeGlyph glyph={t.glyph} size={16} />
            </span>
            <span className="max-w-full truncate">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  if (mobile) {
    return (
      <BottomSheet
        ref={box}
        role="dialog"
        aria-label="Add a card"
        onClose={() => onClose(false)}
        zClassName="z-[var(--z-overlay)]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {body}
      </BottomSheet>
    );
  }
  return (
    <Portal>
      <div
        ref={box}
        role="dialog"
        aria-label="Add a card"
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-[var(--z-overlay)] animate-fade-in rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
        style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: WIDTH }}
      >
        {body}
      </div>
    </Portal>
  );
}
