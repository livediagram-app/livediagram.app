'use client';

// A family of the Sheet's functions as a toolbar menu (docs/specs/029-sheets/sheet.md "Toolbar"): every function of
// that family the engine knows, by name, each with what it takes and what it does, from the engine's own catalogue
// (as the Sheet Functions article reads it), so the menu can never offer a function the Sheet lacks or miss one.
// Picking one, with several cells selected, writes it over them into the cell below (=SUM(B2:B6)); else starts it in
// the active cell, where the formula bar's assist takes over (insertFunction).
import { FUNCTION_DOCS, FUNCTION_FAMILIES, type FunctionFamily } from '@livediagram/sheets';
import { useMenuItemProps } from '@/components/primitives/menu-item-props';

// The families as the toolbar names them (Title Case).
export const FUNCTION_FAMILY_LABELS: Record<FunctionFamily, string> = {
  Maths: 'Maths',
  Statistics: 'Statistics',
  Logic: 'Logic',
  Information: 'Information',
  Lookup: 'Lookup',
  Text: 'Text',
  'Date and time': 'Date and Time',
  Arrays: 'Arrays',
  Finance: 'Finance',
  'Plan cards': 'Plan Cards',
};

export const functionsOf = (family: FunctionFamily): string[] =>
  Object.keys(FUNCTION_FAMILIES.find(([f]) => f === family)?.[1] ?? {}).sort();

function FunctionRow({ name, onPick }: { name: string; onPick: () => void }) {
  const { itemProps } = useMenuItemProps();
  const doc = FUNCTION_DOCS[name];
  return (
    <button
      type="button"
      {...itemProps}
      aria-label={`Insert ${name}`}
      onClick={onPick}
      className="flex w-full min-w-0 cursor-pointer flex-col items-start gap-0.5 break-words px-3 py-1.5 text-left transition hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
    >
      <span className="font-mono text-[12px] font-semibold text-slate-800 dark:text-slate-100">
        {name}
        <span className="font-normal text-slate-400">({doc?.args.join(', ') ?? ''})</span>
      </span>
      {doc?.summary ? (
        <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {doc.summary}
        </span>
      ) : null}
    </button>
  );
}

export function SheetFunctionMenu({
  family,
  onPick,
}: {
  family: FunctionFamily;
  onPick: (name: string) => void;
}) {
  return (
    <div className="max-h-80 w-full overflow-y-auto overscroll-contain py-1">
      {functionsOf(family).map((name) => (
        <FunctionRow key={name} name={name} onPick={() => onPick(name)} />
      ))}
    </div>
  );
}
