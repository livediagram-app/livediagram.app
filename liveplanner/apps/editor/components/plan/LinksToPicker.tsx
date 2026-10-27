'use client';

// A Card field's Links To (docs/specs/026-plan/item-types.md "Editing a type"): a multi-select dropdown of card types.
// One field-sized button naming the ticked types ("Links To Project or Epic"), opening a popover under it
// (AnchoredPopover, so the type editor's scrolling body never clips it) with every card type as a checkbox row. A
// tick adds the type and the popover stays open for more; the last ticked type cannot be unticked, so the field
// always links somewhere. Escape, a press outside or the button again close it.
import { useState } from 'react';
import { ITEM_TYPES, type ItemTypeDef } from '@liveplanner/items';
import { ChevronDownIcon } from '@liveplanner/ui';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { OptionRows } from './OptionRows';
import { usePlan } from './PlanContext';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, accentVars } from './plan-palette';

const POPOVER_PX = 260;

// The linked types as a sample value reads them: "Project", "Project or Epic", "Project, Epic or Bug".
export function linkTypeNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

// The button's words: "Links To Project", "Links To Project or Epic", "Links To Project, Epic and 2 more".
export function linksToLabel(names: readonly string[]): string {
  if (names.length === 0) return 'Links To a Card Type…';
  if (names.length <= 2) return `Links To ${linkTypeNames(names)}`;
  return `Links To ${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

// The ticked list after pressing `id`: ticked in the order they were ticked, never emptied.
export function toggledLinkTypes(value: readonly string[], id: string): readonly string[] {
  if (!value.includes(id)) return [...value, id];
  return value.length > 1 ? value.filter((t) => t !== id) : value;
}

export function LinksToPicker({
  value,
  onChange,
}: {
  value: readonly string[];
  onChange: (linkTypes: readonly string[]) => void;
}) {
  const types: readonly ItemTypeDef[] = usePlan()?.types ?? ITEM_TYPES;
  const [open, setOpen] = useState(false);
  // Held in state so the popover anchors on its first render.
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  // A type gone from the catalogue keeps its id as its name (docs/specs/026-plan/item-types.md "Card fields").
  const names = value.map((id) => types.find((t) => t.id === id)?.label ?? id);
  return (
    <>
      <button
        ref={setTrigger}
        type="button"
        aria-label="Links To"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-[34px] w-full cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white pl-2 pr-1.5 text-left text-[13px] text-slate-700 transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span
          className={`min-w-0 flex-1 truncate ${value.length ? '' : 'text-slate-400 dark:text-slate-500'}`}
        >
          {linksToLabel(names)}
        </span>
        <ChevronDownIcon className="shrink-0 text-slate-400" />
      </button>
      {open && trigger ? (
        <AnchoredPopover
          anchor={trigger}
          name="Links To"
          width={POPOVER_PX}
          onClose={() => setOpen(false)}
        >
          <div className="rounded-lg border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-900">
            <p className="px-1.5 pb-1.5 pt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Link to cards of any type ticked.
            </p>
            <OptionRows
              label="Card types it links to"
              kind="multiple"
              selected={value}
              rows={types.map((t) => ({
                id: t.id,
                label: t.label,
                // The last ticked type stays: a Card field always links somewhere.
                disabled: value.length === 1 && value[0] === t.id,
                icon: (
                  <span aria-hidden className={ACCENT_TEXT} style={accentVars(t.color)}>
                    <PlanTypeGlyph glyph={t.glyph} size={14} />
                  </span>
                ),
              }))}
              onPick={(id) => onChange(toggledLinkTypes(value, id))}
            />
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}
