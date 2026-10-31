'use client';

// The current card's part of the item panel header (docs/specs/026-plan/plan-board.md "The header reads part by
// part"): its Card Type picker as a bordered pill, its number as a quiet tag that copies "#12", and the desktop's
// Maximise / Minimise Card button beside the close button ("Maximised").
import type { ItemTypeDef } from '@liveplanner/items';
import {
  ChevronDownIcon,
  MaximizeIcon,
  MinimizeIcon,
  Tooltip,
  useCopiedFlash,
} from '@liveplanner/ui';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, accentVars } from './plan-palette';

// How long the number's tooltip says Copied.
export const KEY_COPIED_MS = 1500;

export function ItemTypePill({
  type,
  value,
  types,
  canEdit,
  onType,
}: {
  // The card's type as drawn (a fallback when its id is not in the catalogue).
  type: ItemTypeDef;
  value: string;
  types: readonly ItemTypeDef[];
  canEdit: boolean;
  onType: (typeId: string) => void;
}) {
  const glyph = (
    <span className={`shrink-0 ${ACCENT_TEXT}`} style={accentVars(type.color)}>
      <PlanTypeGlyph glyph={type.glyph} size={15} />
    </span>
  );
  if (!canEdit)
    return (
      <span className="flex shrink-0 items-center gap-1.5 px-1 text-[13px] font-semibold text-slate-900 dark:text-slate-50">
        {glyph}
        {type.label}
      </span>
    );
  return (
    <label className="relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1 pl-2 pr-1.5 text-[13px] font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 focus-within:ring-2 focus-within:ring-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:hover:border-slate-600">
      {glyph}
      <span>{type.label}</span>
      <span aria-hidden className="text-slate-400">
        <ChevronDownIcon size={12} />
      </span>
      {/* The native select covers the pill, so the system picker opens wherever it is pressed. */}
      <select
        aria-label="Card Type"
        className="absolute inset-0 cursor-pointer opacity-0"
        value={value}
        onChange={(e) => onType(e.target.value)}
      >
        {!types.some((t) => t.id === value) ? <option value={value}>{type.label}</option> : null}
        {types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ItemKeyTag({ itemKey }: { itemKey: number }) {
  const { copied, flash } = useCopiedFlash(KEY_COPIED_MS);
  const text = `#${itemKey}`;
  return (
    <Tooltip label={copied ? 'Copied' : 'Copy Card Number'}>
      <button
        type="button"
        aria-label={copied ? `Copied ${text}` : `Copy card number ${text}`}
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(
            () => flash(),
            () => undefined,
          );
        }}
        className="shrink-0 cursor-pointer rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] tabular-nums text-slate-600 transition hover:bg-slate-200 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
      >
        {text}
      </button>
    </Tooltip>
  );
}

// Maximise Card / Minimise Card (docs/specs/026-plan/plan-board.md "Maximised"): the window-control pair to the
// close button's left, drawn as the close button is (compact), pressed while the panel is maximised.
export function ItemMaximiseButton({
  maximised,
  onToggle,
}: {
  maximised: boolean;
  onToggle: (on: boolean) => void;
}) {
  const label = maximised ? 'Minimise Card' : 'Maximise Card';
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={maximised}
        onClick={() => onToggle(!maximised)}
        className="touch-target relative rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        {maximised ? <MinimizeIcon size={16} /> : <MaximizeIcon size={16} />}
      </button>
    </Tooltip>
  );
}
