'use client';

// Inherited card types in the type editor (docs/specs/026-plan/item-types.md "Inherited types"): the Inherits From
// row in Configuration's General section, with Detach while a base type is chosen, and the notice the States and
// Display tabs show in place of their controls while the type takes them from its base.
import type { ReactNode } from 'react';
import type { ItemTypeDef } from '@liveplanner/items';
import { Button, LinkIcon, Select, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideScissors } from '@liveworkspace/icons/lucide';
import { SheetRow } from './PlanModal';

const DetachIcon = lucideGlyph(lucideScissors, 14);

// "a, b and c".
const andList = (xs: readonly string[]) =>
  xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs.join('');

export function InheritsFromRow({
  id,
  base,
  bases,
  heirs,
  onBase,
  onDetach,
}: {
  // The menu's id (its label points at it).
  id: string;
  // The base type chosen, if any.
  base: ItemTypeDef | undefined;
  // The types it may inherit from (basesFor).
  bases: readonly ItemTypeDef[];
  // The types inheriting from this one: a base never inherits, so the menu is disabled while there are any.
  heirs: readonly ItemTypeDef[];
  onBase: (base: ItemTypeDef) => void;
  // Detach (and None): the type keeps what it holds, now its own.
  onDetach: () => void;
}) {
  const note = heirs.length
    ? `${andList(heirs.map((t) => t.label))} ${heirs.length === 1 ? 'inherits' : 'inherit'} from this type.`
    : base
      ? `Takes ${base.label}’s fields, tabs, states and display, and follows every change to it. Fields you add here are this type’s own.`
      : 'Share fields, tabs, states and display with another type, and follow its changes.';
  const detachHint = base ? `Stop following ${base.label} and keep a copy of its settings` : '';
  return (
    <SheetRow label="Inherits From" htmlFor={id}>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          id={id}
          className="w-full max-w-xs"
          selectClassName="h-9 text-[13px]"
          value={base?.id ?? ''}
          disabled={heirs.length > 0 || (!base && bases.length === 0)}
          onChange={(e) => {
            const next = bases.find((t) => t.id === e.target.value);
            if (next) onBase(next);
            else onDetach();
          }}
        >
          <option value="">None</option>
          {bases.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
        {base ? (
          <Tooltip label={detachHint}>
            <Button variant="secondary" aria-label={`Detach: ${detachHint}`} onClick={onDetach}>
              <DetachIcon />
              Detach
            </Button>
          </Tooltip>
        ) : null}
      </div>
      <p className="mt-1.5 text-[12px] text-slate-500 dark:text-slate-400">{note}</p>
    </SheetRow>
  );
}

// What an inherited type shows in place of a tab's controls: who sets them, then what it takes, read-only.
export function InheritedPartNotice({
  typeLabel,
  baseLabel,
  part,
  children,
}: {
  typeLabel: string;
  baseLabel: string;
  // "states" or "display".
  part: string;
  // The base's settings as this type takes them, drawn read-only.
  children: ReactNode;
}) {
  const name = typeLabel.trim() || 'This type';
  return (
    <div className="flex flex-col gap-3">
      <p
        role="note"
        className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-[13px] text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100"
      >
        <span aria-hidden className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-300">
          <LinkIcon />
        </span>
        <span>
          {name} takes its {part} from {baseLabel}. Change them on {baseLabel}, or Detach to give{' '}
          {name === 'This type' ? 'it' : name} its own.
        </span>
      </p>
      {/* The base's settings as this type takes them: shown, never edited here. */}
      <div inert role="group" aria-label={`${baseLabel}’s ${part}`} className="opacity-60 saturate-50">
        {children}
      </div>
    </div>
  );
}
