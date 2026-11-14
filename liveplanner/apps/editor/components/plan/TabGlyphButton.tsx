'use client';

// A tab's icon in the type editor's Fields and Tabs list (docs/specs/026-plan/item-types.md "Editing a type": Icons):
// the icon on a tint of the type's colour with a small chevron, leading the group's header, opening the card type
// glyph picker (GlyphGrid, in the same AnchoredPopover as the type's Glyph) named "{Tab} Icon". A pick closes it and
// hands focus back; while the icon is not the default, Reset To Default in the picker's foot puts the default back.
// Read-only (an inherited type's tabs are its base's): the icon alone, no button.
import { useState } from 'react';
import { planGlyphLabel, type PlanGlyphId } from '@liveplanner/items';
import { ChevronDownIcon, Tooltip, UndoIcon } from '@liveplanner/ui';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { GlyphGrid } from './GlyphPicker';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, ACCENT_TINT, accentVars } from './plan-palette';

// Ten 32px tiles to a row, with the popover's padding (as the type's Glyph).
const GLYPH_POPOVER_PX = 352;

const TILE = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-md';

export function TabGlyphButton({
  value,
  fallback,
  colour,
  tabName,
  onChange,
  readOnly = false,
}: {
  // The icon chosen, or undefined for the default.
  value: PlanGlyphId | undefined;
  // The default it falls back to (Overview's page, Details' checklist, another tab's kanban).
  fallback: PlanGlyphId;
  colour: string;
  // The group's name, for the picker's ("Design Icon").
  tabName: string;
  onChange: (glyph: PlanGlyphId | undefined) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const shown = value ?? fallback;
  const tint = (
    <span
      aria-hidden
      className={`${TILE} ${ACCENT_TINT} ${ACCENT_TEXT}`}
      style={accentVars(colour)}
    >
      <PlanTypeGlyph glyph={shown} size={14} />
    </span>
  );
  if (readOnly) return <span className="flex h-7 shrink-0 items-center pl-0.5">{tint}</span>;
  const close = () => {
    setOpen(false);
    trigger?.focus();
  };
  const name = `Icon: ${planGlyphLabel(shown)}`;
  return (
    <>
      <Tooltip label={name}>
        <button
          ref={setTrigger}
          type="button"
          aria-label={name}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-tab-glyph=""
          className="flex h-7 shrink-0 cursor-pointer items-center gap-0.5 rounded-md py-0.5 pl-0.5 pr-0.5 transition hover:bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:hover:bg-slate-700/70"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => {
            if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          {tint}
          <ChevronDownIcon size={10} className="shrink-0 text-slate-400" />
        </button>
      </Tooltip>
      {open && trigger ? (
        <AnchoredPopover
          anchor={trigger}
          name={`${tabName} Icon`}
          width={GLYPH_POPOVER_PX}
          onClose={() => setOpen(false)}
        >
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
            <GlyphGrid
              value={shown}
              colour={colour}
              label={`${tabName} Icon`}
              onPick={(g) => {
                onChange(g === fallback ? undefined : g);
                close();
              }}
            />
            {value && value !== fallback ? (
              <div className="flex justify-end border-t border-slate-100 pt-2 dark:border-slate-800">
                <button
                  type="button"
                  className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                  onClick={() => {
                    onChange(undefined);
                    close();
                  }}
                >
                  <UndoIcon size={13} />
                  Reset To Default
                </button>
              </div>
            ) : null}
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}
