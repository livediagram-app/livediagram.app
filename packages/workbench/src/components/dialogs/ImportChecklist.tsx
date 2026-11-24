import { Button } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';

// One checkbox size for Select all and every row; its colour is the theme's accent (theme.css).
const BOX = 'h-4 w-4 shrink-0 cursor-pointer';

/** One thing an import found, ticked to import it. */
export type ImportChecklistRow = { key: string; name: string; detail: string };

/**
 * The move prompt's list after signing in (docs/specs/014-identity/auth-and-guest-access.md): what
 * was found, each with a checkbox, all ticked, under the name it will get and a one-line detail;
 * Select all; a note about what will be left out; Back and Import.
 */
export function ImportChecklist({
  legend,
  rows,
  checked,
  onToggle,
  onToggleAll,
  leftOut,
  importLabel,
  cancelLabel = 'Back',
  onImport,
  onCancel,
}: {
  legend: string;
  rows: readonly ImportChecklistRow[];
  checked: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onToggleAll: () => void;
  /** Said when some files will be left out ("2 files couldn't be read and will be left out."). */
  leftOut?: string;
  importLabel: string;
  /** The secondary button: Back on an import's list step. */
  cancelLabel?: string;
  onImport: () => void;
  onCancel: () => void;
}) {
  const count = rows.filter((r) => checked.has(r.key)).length;
  const all = count === rows.length;
  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {legend}
        </legend>
        {/* On the rows' own left edge, so its box sits over theirs. */}
        <label className="mb-1.5 flex w-fit cursor-pointer items-center gap-2.5 px-3 text-[13px] font-medium text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            className={BOX}
            checked={all}
            ref={(el) => {
              if (el) el.indeterminate = count > 0 && !all;
            }}
            onChange={onToggleAll}
          />
          Select all
        </label>
        <ul className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
          {rows.map((row) => (
            <li key={row.key}>
              <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <input
                  type="checkbox"
                  className={`${BOX} mt-0.5`}
                  checked={checked.has(row.key)}
                  onChange={() => onToggle(row.key)}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-800 dark:text-slate-100">
                    {row.name}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {row.detail}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {leftOut ? (
        <Callout tone="warning" role="alert" className="mt-3">
          {leftOut}
        </Callout>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="md" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="primary" size="md" onClick={onImport} disabled={count === 0}>
          {importLabel}
        </Button>
      </div>
    </>
  );
}
