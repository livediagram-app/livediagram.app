'use client';

// Each Email Becomes (docs/specs/026-plan/email-to-board.md "What a message makes"): the card an address makes, as a
// card type and a column, and under them the boards that show such a card. An address makes a card, never a board's:
// the boards follow from the plan (every board that takes the type and has the column) and are read back, not chosen.
import { useId } from 'react';
import type { EmailIntakeTarget, EmailIntakeType } from '@liveplanner/api-schema';
import { boardNamesText } from '@liveplanner/items';
import { Select, lucideGlyph } from '@liveplanner/ui';
import { lucideSquareKanban } from '@liveworkspace/icons/lucide';

const BoardIcon = lucideGlyph(lucideSquareKanban, 13);

const LABEL = 'text-xs font-medium text-slate-600 dark:text-slate-300';

/** What picking `typeId` makes: the column kept while the type has it, else the type's first. */
export function targetForType(
  types: readonly EmailIntakeType[],
  typeId: string,
  status: string | undefined,
): { typeId: string; status: string } | null {
  const type = types.find((t) => t.id === typeId);
  const column = type?.columns.find((c) => c.status === status) ?? type?.columns[0];
  return type && column ? { typeId, status: column.status } : null;
}

export function EmailIntakeMakes({
  types,
  value,
  showsOn,
  disabled,
  onChange,
}: {
  // The card types some board shows, each with its columns.
  types: readonly EmailIntakeType[];
  value: Pick<EmailIntakeTarget, 'typeId' | 'status'> | null;
  // The boards that show the card as it is saved; none while a change is on its way.
  showsOn: readonly string[];
  disabled: boolean;
  onChange: (next: { typeId: string; status: string }) => void;
}) {
  const typeId = useId();
  const columnId = useId();
  const type = types.find((t) => t.id === value?.typeId);
  const columns = type?.columns ?? [];
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled} data-email-intake-makes="">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Each Email Becomes
      </legend>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1 [&>*]:min-w-0">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={typeId} className={LABEL}>
            Card Type
          </label>
          <Select
            id={typeId}
            className="w-full"
            selectClassName="w-full truncate"
            value={type?.id ?? ''}
            onChange={(e) => {
              const next = targetForType(types, e.target.value, value?.status);
              if (next) onChange(next);
            }}
          >
            {type ? null : (
              <option value="" disabled>
                Choose a card type…
              </option>
            )}
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={columnId} className={LABEL}>
            Column
          </label>
          <Select
            id={columnId}
            className="w-full"
            selectClassName="w-full truncate"
            value={columns.some((c) => c.status === value?.status) ? value!.status : ''}
            disabled={!type}
            onChange={(e) => type && onChange({ typeId: type.id, status: e.target.value })}
          >
            {columns.some((c) => c.status === value?.status) ? null : (
              <option value="" disabled>
                Choose a column…
              </option>
            )}
            {columns.map((c) => (
              <option key={c.status} value={c.status}>
                {c.name || 'Untitled'}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {showsOn.length ? (
        <p
          data-email-intake-shows-on=""
          className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
        >
          <span aria-hidden className="text-slate-400">
            <BoardIcon />
          </span>
          <span>
            Shows on{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {boardNamesText(showsOn)}
            </span>
          </span>
        </p>
      ) : null}
    </fieldset>
  );
}
