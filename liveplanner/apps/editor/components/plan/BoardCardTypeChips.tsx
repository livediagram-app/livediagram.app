'use client';

// A board's card type chips (docs/specs/026-plan/plan-board.md "Card type chips"): in its header, after the title, a
// chip per card type the board takes, each a small card in its type's colour with its glyph, then its name. A click
// (or Enter or Space) adds a card of the type and opens it to be named, as Add card does; a drag carries one onto the
// board, into the column and row it is let go over (useCardTypeDrag). PlanBoardView decides whether they show
// (chipsShown); in a header band they ride in the menu box after the board's name.
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { HoverCard } from '@liveplanner/ui';
import {
  newItemId,
  type BoardProjection,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { useCardTypeDrag } from '@/hooks/plan/useCardTypeDrag';
import { CHIP_NAMES_MAX, chipClickCell } from './card-type-chips';
import { usePlan } from './PlanContext';
import { PlanCardTileArt } from './plan-tile-art';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_BG, ACCENT_TEXT, accentVars, type PlanPalette } from './plan-palette';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function BoardCardTypeChips({
  setup,
  projection,
  types,
  palette,
  inBox,
}: {
  setup: PlanBoardSetup;
  projection: BoardProjection;
  // The types the board takes (boardAddTypes), in the project's order.
  types: readonly ItemTypeDef[];
  palette: PlanPalette;
  // In the menu box (a header band): the chrome's ink and hairlines rather than the board's.
  inBox: boolean;
}) {
  const plan = usePlan();
  const ghostRef = useRef<HTMLDivElement>(null);
  const add = (typeId: string) => {
    if (!plan) return;
    const card = chipClickCell(setup, projection, plan.types, typeId, plan.statusNames);
    if (!card) return;
    const id = newItemId();
    void plan.addItem({
      id,
      type: card.type,
      fields: card.fields,
      status: card.status,
      after: card.after,
    });
    plan.openNewItem(id);
    const label = types.find((t) => t.id === typeId)?.label ?? 'Card';
    plan.announce(`${label} added to ${card.columnName}`);
  };
  const { carrying, onPointerDown } = useCardTypeDrag({
    onClick: add,
    onRefused: (message) => plan?.announce(message),
    ghostRef,
  });
  const named = types.length <= CHIP_NAMES_MAX;
  const carried = carrying ? types.find((t) => t.id === carrying) : undefined;
  return (
    <div
      data-card-type-chips=""
      role="group"
      aria-label="Add Cards"
      // A row that scrolls sideways when it does not fit, as the widget zone does; no bar of its own.
      className={`flex min-w-0 shrink items-center gap-1 overflow-x-auto [scrollbar-width:none] ${
        inBox ? 'ml-1 border-l border-slate-200 pl-2.5 dark:border-slate-700' : ''
      }`}
      onDoubleClick={stop}
    >
      {types.map((t) => (
        <HoverCard
          key={t.id}
          title={`Add a ${t.label}`}
          description="Click to add one, or drag it onto the board."
          disabled={!!carrying}
        >
          <button
            type="button"
            data-card-type-chip={t.id}
            aria-label={`Add a ${t.label}`}
            className={`flex h-8 shrink-0 cursor-pointer touch-none select-none items-center gap-1.5 rounded-lg text-[13px] font-medium transition hover:bg-black/5 focus-visible:outline-2 dark:hover:bg-white/10 ${
              named ? 'pl-1.5 pr-2.5' : 'px-1.5'
            } ${carrying === t.id ? 'bg-black/5 dark:bg-white/10' : ''}`}
            style={
              inBox
                ? { outlineColor: palette.focus }
                : { color: palette.text, outlineColor: palette.focus }
            }
            onPointerDown={(e) => onPointerDown(t.id, e)}
            onClick={(e) => {
              e.stopPropagation();
              // A pointer's click is the drag hook's (a press that never travelled); this is the keyboard's.
              if (e.detail === 0) add(t.id);
            }}
          >
            <span className={ACCENT_TEXT} style={accentVars(t.color)}>
              <PlanCardTileArt size={22} color={t.color} glyph={t.glyph} />
            </span>
            {named ? <span className="whitespace-nowrap">{t.label}</span> : null}
          </button>
        </HoverCard>
      ))}
      {carried
        ? createPortal(
            // The card being carried: a small card in the type's colour, reading its new-card title.
            <div
              ref={ghostRef}
              data-card-type-ghost=""
              aria-hidden
              className="pointer-events-none fixed left-0 top-0 z-[1000] flex h-10 w-48 items-center gap-2 overflow-hidden rounded-lg border pr-3 text-[13px] font-semibold shadow-xl"
              style={{
                backgroundColor: palette.card,
                borderColor: palette.border,
                color: palette.text,
                transform: 'translate(-9999px, -9999px)',
              }}
            >
              <span
                className={`h-full w-1 shrink-0 ${ACCENT_BG}`}
                style={accentVars(carried.color)}
              />
              <span className={`shrink-0 ${ACCENT_TEXT}`} style={accentVars(carried.color)}>
                <PlanTypeGlyph glyph={carried.glyph} size={14} />
              </span>
              <span className="truncate">{carried.newTitle}</span>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
