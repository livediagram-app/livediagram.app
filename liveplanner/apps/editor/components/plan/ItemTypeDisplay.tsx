'use client';

// The type editor's Display (docs/specs/026-plan/item-types.md "Editing a type": Display): where this type's cards
// show each field, per card size, edited on the card itself. The preview is a real card of this type, drawn large as
// a board draws it, with each part of the card a dotted box (an empty one reads its name) and each field's bit in it
// a chip that drags (mouse, pen or touch, `useCardFieldDrag`) to another part or place, a copy following the pointer
// and a bar marking where it lands, moves with the arrow keys, and comes off with its cross or dropped on Available
// Fields. Available Fields lists the type's fields not on the card: drag one onto any part, or press it to pick a
// part from a menu. Reset to Default puts a size back; a size equal to its default is stored as absent.
import {
  isValidElement,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  CARD_FIELDS,
  CARD_SIZES,
  CARD_SLOTS,
  CARD_SLOT_LABELS,
  cardDisplayFields,
  cardLayoutFields,
  cardSlotFits,
  typeDefaultCardLayout,
  sameCardLayout,
  typeCardLayout,
  typeOffersCardField,
  customCardFields,
  type CardDisplay,
  type CardField,
  AUTOMATIC_CARD_FIELDS,
  type CardLayout,
  type CardSize,
  type CardSlot,
  type ItemTypeDef,
} from '@liveplanner/items';
import { Button, CloseIcon } from '@liveplanner/ui';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { useObservedSize } from '@liveworkspace/workbench/hooks/canvas/useObservedSize';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { SegmentSlider } from '@liveworkspace/workbench/components/primitives/SegmentSlider';
import { moveCardField, neighbourSlot, removeCardField } from './card-layout-edits';
import { PlanCardFace, type CardFaceEdit } from './PlanCardFace';
import { planPalette } from './plan-palette';
import { useCardFieldDrag } from './useCardFieldDrag';
import { ThreadCountsProvider } from './threads/CardThreadsContext';

import { sampleCard, sampleThreadStore } from './item-type-display-sample';
import { DROP_MARKER, fieldIcon, fieldLabel, PlaceMenu } from './ItemTypeDisplayParts';

export type CardDisplayDraft = CardDisplay;

const SIZE_LABELS: Record<CardSize, string> = {
  minimal: 'Minimal',
  detailed: 'Detailed',
};
// The card's width in the editor (wider than a board's 300, so a long title has room), and how much larger it is
// drawn (CSS zoom, so its box grows too): at most CARD_ZOOM, less where the tab is narrower (a phone), never
// below CARD_ZOOM_MIN. CARD_GUTTER_PX is the column backdrop's padding either side.
const CARD_PX = 360;
const CARD_ZOOM = 1.4;
const CARD_ZOOM_MIN = 0.75;
const CARD_GUTTER_PX = 16;

// The zoom that fits the card in `width` (the backdrop's), within its bounds; the largest until measured.
export function cardZoomFor(width: number | undefined): number {
  if (!width) return CARD_ZOOM;
  const fit = (width - 2 * CARD_GUTTER_PX) / CARD_PX;
  return Math.max(CARD_ZOOM_MIN, Math.min(CARD_ZOOM, fit));
}

export function ItemTypeDisplay({
  type,
  display,
  onChange,
}: {
  // The type as drafted (its fields, colour, glyph and name), for the card and the list.
  type: ItemTypeDef;
  display: CardDisplayDraft;
  onChange: (next: CardDisplayDraft) => void;
}) {
  const [size, setSize] = useState<CardSize>('detailed');
  const drafted = useMemo(() => ({ ...type, display }), [type, display]);
  const layout = typeCardLayout(drafted, size);
  const placed = cardLayoutFields(size, layout);
  // The size's built-in fields the type has, then its custom fields, not yet on the card.
  const available = [...cardDisplayFields(size), ...customCardFields(type)].filter(
    (f) => typeOffersCardField(type, f) && !placed.includes(f),
  );
  // The fields a person fills in, then those filled in automatically (Age and the stamps), each group under its head.
  const automatic = available.filter((f) => AUTOMATIC_CARD_FIELDS.includes(f));
  const filledIn = available.filter((f) => !AUTOMATIC_CARD_FIELDS.includes(f));
  const isDefault = sameCardLayout(size, layout, typeDefaultCardLayout(type, size));
  const sample = useMemo(() => sampleCard(type), [type]);
  const sampleThreads = useMemo(() => sampleThreadStore(type, sample.id), [type, sample.id]);
  const palette = planPalette(useCanvasSurface());
  const setLayout = (next: CardLayout) => onChange({ ...display, [size]: next });

  const card = useRef<HTMLDivElement>(null);
  // The column backdrop, measured so the card fits it on a narrow screen.
  const backdrop = useRef<HTMLDivElement>(null);
  const zoom = cardZoomFor(useObservedSize(backdrop)?.width);
  const tray = useRef<HTMLElement>(null);
  const { drag, target, overTray, dragProps, ghost, pointer } = useCardFieldDrag({
    size,
    card,
    tray,
    onDrop: (field, at) => setLayout(moveCardField(size, layout, field, at.slot, at.index)),
    onTakeOff: (field) => setLayout(removeCardField(layout, field)),
  });
  // The available field whose "where to?" menu is open, and the button it hangs from.
  const [placing, setPlacing] = useState<{ field: CardField; anchor: HTMLElement } | null>(null);
  // A chip already on the card is being dragged (Available Fields then takes it off).
  const draggingPlaced = !!drag?.moving && placed.includes(drag.field);
  // The part's chips with the landing bar among them, counted past the dragged chip as the drop counts.
  const withMarker = (slot: CardSlot, bits: ReactNode[]): ReactNode[] => {
    if (!drag?.moving || target?.slot !== slot) return bits;
    const out: ReactNode[] = [];
    let seen = 0;
    for (const bit of bits) {
      const dragged = isValidElement(bit) && bit.key === drag.field;
      if (!dragged && seen++ === target.index) out.push(DROP_MARKER);
      out.push(bit);
    }
    if (!out.includes(DROP_MARKER)) out.push(DROP_MARKER);
    return out;
  };
  // The keyboard's way on the card: Left and Right move a chip within its part, Up and Down to the part before or
  // after, Delete or Backspace takes it off.
  const chipKeys = (field: CardField, slot: CardSlot) => (e: KeyboardEvent<HTMLElement>) => {
    const list = layout[slot] ?? [];
    const at = list.indexOf(field);
    let next: CardLayout | null = null;
    if (e.key === 'ArrowLeft' && at > 0) next = moveCardField(size, layout, field, slot, at - 1);
    else if (e.key === 'ArrowRight' && at < list.length - 1)
      next = moveCardField(size, layout, field, slot, at + 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const to = neighbourSlot(size, slot, field, e.key === 'ArrowUp' ? -1 : 1);
      if (to) next = moveCardField(size, layout, field, to, (layout[to] ?? []).length);
    } else if (e.key === 'Delete' || e.key === 'Backspace') next = removeCardField(layout, field);
    if (!next) return;
    e.preventDefault();
    e.stopPropagation();
    setLayout(next);
    requestAnimationFrame(() =>
      card.current?.querySelector<HTMLElement>(`[data-chip="${field}"]`)?.focus(),
    );
  };
  // A group of Available Fields' chips: drag one onto the card, or press it to choose where it goes.
  const fieldChips = (fields: readonly CardField[]) => (
    <ul className="flex flex-wrap gap-1.5">
      {fields.map((f) => (
        <li key={f}>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={placing?.field === f}
            {...dragProps(f, (el) => setPlacing({ field: f, anchor: el }))}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              setPlacing({ field: f, anchor: e.currentTarget });
            }}
            className={`inline-flex cursor-grab touch-none select-none items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1 pl-1.5 pr-2.5 text-[12px] font-medium text-slate-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50/60 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10 ${
              drag?.moving && drag.field === f ? 'opacity-40' : ''
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {fieldIcon(type, f, 12)}
            </span>
            {fieldLabel(type, f)}
          </button>
        </li>
      ))}
    </ul>
  );

  const slotOf = (field: CardField) =>
    CARD_SLOTS[size].find((s) => (layout[s] ?? []).includes(field))!;

  // How the card draws itself as its own editor: each part a dotted box, each bit a chip.
  const edit: CardFaceEdit = {
    slot: (slot, bits) => {
      const label = CARD_SLOT_LABELS[size][slot]!;
      const lit = !!drag?.moving && target?.slot === slot;
      const takes = !!drag?.moving && cardSlotFits(size, slot, drag.field);
      return (
        <span
          key={`slot-${slot}`}
          data-slot={slot}
          role="group"
          aria-label={label}
          className={`flex flex-wrap items-center gap-1 rounded-md border border-dashed px-1 py-0.5 transition ${
            bits.length === 0 ? 'min-h-6 min-w-10' : 'min-h-7'
          } ${slot === 'head' || slot === 'body' || slot === 'foot' ? 'flex-1' : ''} ${
            lit
              ? 'border-brand-500 bg-brand-50/70 dark:border-brand-400 dark:bg-brand-500/15'
              : takes
                ? 'border-brand-300 dark:border-brand-500/60'
                : 'border-slate-300 dark:border-slate-600'
          }`}
        >
          {/* An empty part is a small target with no label (its name is for assistive technology). */}
          {lit ? withMarker(slot, bits) : bits}
        </span>
      );
    },
    bit: (field, node) => {
      const slot = slotOf(field);
      const label = fieldLabel(type, field);
      return (
        <span
          key={field}
          data-chip={field}
          tabIndex={0}
          role="button"
          aria-label={`${label}, in ${CARD_SLOT_LABELS[size][slot]}. Drag or use the arrow keys to move it; Delete takes it off.`}
          {...dragProps(field)}
          onKeyDown={chipKeys(field, slot)}
          className={`group/chip relative inline-flex cursor-grab touch-none select-none items-center rounded-md p-0.5 outline-none ring-1 ring-transparent transition hover:ring-brand-300 pointer-coarse:ring-brand-300 dark:pointer-coarse:ring-brand-500/60 focus-visible:ring-2 focus-visible:ring-brand-400 active:cursor-grabbing dark:hover:ring-brand-500/60 ${
            drag?.moving && drag.field === field ? 'opacity-40' : ''
          }`}
        >
          {node ?? <span className="text-[11px]">{label}</span>}
          <button
            type="button"
            aria-label={`Take ${label} off the card`}
            tabIndex={-1}
            // A touch screen has no hover: there the cross always shows.
            className={`absolute -right-1 -top-1 z-10 hidden h-3 w-3 cursor-pointer items-center justify-center rounded-full bg-slate-700 text-white shadow ring-1 ring-white hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900 dark:ring-slate-900 dark:hover:bg-white ${
              drag?.moving
                ? ''
                : 'group-hover/chip:flex group-focus-visible/chip:flex pointer-coarse:flex'
            }`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setLayout(removeCardField(layout, field))}
          >
            <CloseIcon size={7} />
          </button>
        </span>
      );
    },
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        Arrange this type&apos;s cards at each size, right on the card: drag a field to any part of
        it, or off it (onto Available Fields, or with its cross).
      </p>
      <div
        role="radiogroup"
        aria-label="Card size"
        className="relative grid grid-cols-2 self-start rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800"
      >
        {/* The selection slides to the picked size, as the Share dialog's Valid does. */}
        <SegmentSlider
          count={CARD_SIZES.length}
          index={CARD_SIZES.indexOf(size)}
          className="bg-white shadow-sm dark:bg-slate-900"
        />
        {CARD_SIZES.map((z) => (
          <button
            key={z}
            type="button"
            role="radio"
            aria-checked={size === z}
            className={`relative z-10 cursor-pointer rounded-md px-3 py-1 text-[13px] font-medium transition ${
              size === z
                ? 'text-slate-900 dark:text-slate-50'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
            onClick={() => setSize(z)}
          >
            {SIZE_LABELS[z]}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        {/* The card, editable in place, on a board column's colour; scrolls sideways on a narrow screen. */}
        <div
          ref={backdrop}
          className="flex justify-center overflow-x-auto rounded-xl px-4 py-6"
          style={{ backgroundColor: palette.column }}
        >
          <div
            ref={card}
            role="group"
            aria-label={`${SIZE_LABELS[size]} card`}
            className="shrink-0"
            style={{ width: CARD_PX, zoom }}
          >
            <ThreadCountsProvider value={sampleThreads}>
              <PlanCardFace
                item={sample}
                palette={palette}
                fields={CARD_FIELDS}
                size={size}
                typeOverride={drafted}
                edit={edit}
              />
            </ThreadCountsProvider>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <section
            ref={tray}
            aria-label="Available Fields"
            className={`flex flex-col gap-1.5 rounded-xl border border-dashed p-3 transition-colors ${
              overTray && draggingPlaced
                ? 'border-solid border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/15'
                : draggingPlaced
                  ? 'border-brand-300 dark:border-brand-500/60'
                  : 'border-transparent'
            }`}
          >
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Available Fields
            </h4>
            {draggingPlaced ? (
              <p className="py-1 text-[12px] font-medium text-brand-700 dark:text-brand-300">
                Drop to take it off the card
              </p>
            ) : available.length === 0 ? (
              <p className="text-[12px] text-slate-500 dark:text-slate-400">
                Every field this type has is on the card.
              </p>
            ) : (
              <>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Drag one onto the card, or press it to choose where it goes.
                </p>
                {filledIn.length > 0 ? fieldChips(filledIn) : null}
                {automatic.length > 0 ? (
                  <>
                    <h5 className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Filled In Automatically
                    </h5>
                    {fieldChips(automatic)}
                  </>
                ) : null}
              </>
            )}
          </section>
          {/* Reset to Default, once the size differs from its default. */}
          {!isDefault ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  const { [size]: _drop, ...rest } = display;
                  onChange(rest);
                }}
              >
                Reset to Default
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      {drag?.moving && typeof document !== 'undefined'
        ? createPortal(
            // The field under the pointer while it drags: its glyph and name, just below and right of the pointer, clear of where it lands.
            <div
              ref={ghost}
              aria-hidden
              className="pointer-events-none fixed left-0 top-0 z-[var(--z-toast)]"
              style={{ transform: `translate(${pointer.current.x}px, ${pointer.current.y}px)` }}
            >
              <span className="ml-4 mt-4 inline-flex -rotate-2 items-center gap-1.5 rounded-lg border border-brand-300 bg-white py-1 pl-1.5 pr-2.5 text-[12px] font-medium text-slate-800 shadow-lg dark:border-brand-500/60 dark:bg-slate-900 dark:text-slate-100">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  {fieldIcon(type, drag.field, 12)}
                </span>
                {fieldLabel(type, drag.field)}
              </span>
            </div>,
            document.body,
          )
        : null}
      {placing ? (
        <AnchoredPopover
          anchor={placing.anchor}
          name={`Add ${fieldLabel(type, placing.field)} to`}
          width={220}
          onClose={() => setPlacing(null)}
        >
          <PlaceMenu
            title={`Add ${fieldLabel(type, placing.field)} to`}
            slots={CARD_SLOTS[size].filter((s) => cardSlotFits(size, s, placing.field))}
            labelOf={(s) => CARD_SLOT_LABELS[size][s]!}
            onPick={(slot) => {
              setLayout(
                moveCardField(size, layout, placing.field, slot, (layout[slot] ?? []).length),
              );
              setPlacing(null);
            }}
          />
        </AnchoredPopover>
      ) : null}
    </div>
  );
}
