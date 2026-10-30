'use client';

// The item panel's layout pieces (docs/specs/026-plan/plan-board.md "The item panel"): the thin type-colour band at
// its top, a main-column section under its heading, a Details row (label beside its control), and the
// quiet created and edited lines at the foot of Details. ItemPanel arranges them; the field controls are
// ItemFieldEditor's.
import { FROM_FORM_FIELD, readFromForm } from '@liveplanner/forms';
import type { ReactNode } from 'react';
import { relativeSince } from '@liveplanner/ui';
import type { Item } from '@liveplanner/items';
import { PersonDisc } from './PersonDisc';
import { ACCENT_BG, accentVars } from './plan-palette';

// The card type's colour as a thin band across the panel's top edge: the type shows without shouting. ACCENT_BG
// lifts a colour too dark to see on the dark chrome (Project's black), as the Card Types panel's stripes do.
export function ItemTypeBand({ colour }: { colour: string }) {
  return <div aria-hidden className={`h-1 shrink-0 ${ACCENT_BG}`} style={accentVars(colour)} />;
}

// A main-column field (or section) under its heading.
// A required field's mark after its name (docs/specs/026-plan/item-types.md "Required fields"): a red asterisk,
// read as "required".
export function RequiredMark() {
  return (
    <>
      <span aria-hidden className="ml-0.5 text-red-600 dark:text-red-400">
        *
      </span>
      <span className="sr-only"> required</span>
    </>
  );
}

export function ItemPanelSection({
  heading,
  htmlFor,
  required,
  children,
}: {
  heading: string;
  // The control the heading labels, when it labels one.
  htmlFor?: string | undefined;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-[13px] font-semibold text-slate-800 dark:text-slate-100"
      >
        {heading}
        {required ? <RequiredMark /> : null}
      </label>
      {children}
    </section>
  );
}

// A Details row: a muted label beside its control on a wide screen (32 px rows; no hover highlight, the control itself shows it), above it in the
// phone's Details tab.
export function ItemDetailsRow({
  label,
  htmlFor,
  required,
  wide = false,
  children,
}: {
  label: string;
  htmlFor?: string | undefined;
  required?: boolean;
  // A maximised panel's wider Details (plan-board.md "Maximised"): an 8 rem label column.
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`-mx-2 grid min-h-9 ${wide ? 'grid-cols-[8rem_1fr]' : 'grid-cols-[6.5rem_1fr]'} items-center gap-2 rounded-lg px-2 py-1 max-sm:mx-0 max-sm:grid-cols-1 max-sm:items-start max-sm:gap-1.5 max-sm:px-0 max-sm:py-2`}
    >
      <label
        htmlFor={htmlFor}
        className="self-start pt-2 text-[12px] text-slate-500 max-sm:pt-0 max-sm:font-medium dark:text-slate-400"
      >
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      <div className="min-w-0 text-[13px]">{children}</div>
    </div>
  );
}

// Who made the card and who last changed it, small and quiet at Details' foot.
export function ItemMeta({ item, now }: { item: Item; now: number }) {
  const response = readFromForm(item.fields[FROM_FORM_FIELD]);
  return (
    <div className="mt-5 flex flex-col gap-1.5 border-t border-slate-200/80 pt-3 text-[11px] text-slate-500 dark:text-slate-400 dark:border-slate-700/80">
      <div className="flex items-center gap-1.5">
        Created by <PersonDisc person={item.createdBy} />
        <span className="font-medium text-slate-600 dark:text-slate-300">
          {item.createdBy.name}
        </span>
      </div>
      {response ? (
        // A form's response (docs/specs/030-forms/forms.md "What a response makes"): its number and when it came.
        <div>
          Form response #{response.number},{' '}
          {new Date(item.createdAt).toLocaleString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      ) : null}
      <div className="flex items-center gap-1.5">
        Edited by <PersonDisc person={item.updatedBy} />
        <span>
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {item.updatedBy.name}
          </span>
          , {relativeSince(item.updatedAt, now)}
        </span>
      </div>
    </div>
  );
}
