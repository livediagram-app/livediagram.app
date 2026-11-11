'use client';

// Extra Columns (docs/specs/030-forms/forms.md "Columns filled in automatically"): under a sheet destination, the
// columns every row fills without a question: a text, a number or the submitted day. A closed accordion; the api
// writes them into the row, never the respondent's browser.
import { useState } from 'react';
import {
  FIXED_TEXT_MAX,
  PROMPT_MAX,
  SHEET_FIXED_MAX,
  newFormPartId,
  withSheetFixed,
  type SheetFixedColumn,
} from '@liveplanner/forms';
import { PlusIcon, Select } from '@liveplanner/ui';
import { DraftText } from './DraftText';
import { useFormBuilder } from './form-builder-context';
import {
  ADD,
  BOX,
  Row,
  Shell,
  SubmittedDays,
  readNumber,
  submittedAfter,
} from './fixed-value-parts';

type ColumnKind = 'text' | 'number' | 'submitted';
const kindOf = (c: SheetFixedColumn): ColumnKind =>
  'submitted' in c ? 'submitted' : typeof c.value === 'number' ? 'number' : 'text';

// A header for a new extra column, distinct from the others ("Extra Column", "Extra Column 2").
function newHeader(columns: readonly SheetFixedColumn[]): string {
  const taken = new Set(columns.map((c) => c.header.toLowerCase()));
  if (!taken.has('extra column')) return 'Extra Column';
  for (let n = 2; ; n += 1) if (!taken.has(`extra column ${n}`)) return `Extra Column ${n}`;
}

// Extra Columns: the columns every sheet row fills without a question.
export function ExtraColumns() {
  const b = useFormBuilder();
  const sheet = b.form.sheet;
  // A kind picked whose value is still to be typed (Text or Number), by column id.
  const [picking, setPicking] = useState<Record<string, ColumnKind>>({});
  if (!sheet) return null;
  const columns = sheet.fixed ?? [];
  const save = (next: SheetFixedColumn[]) => b.actions.changeForm((f) => withSheetFixed(f, next));
  const change = (id: string, next: SheetFixedColumn) =>
    save(columns.map((c) => (c.id === id ? next : c)));
  return (
    <Shell
      title="Extra Columns"
      count={columns.length}
      hint="Columns every row fills without a question."
      startOpen={false}
    >
      {columns.length ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
          {columns.map((c) => {
            const kind = picking[c.id] ?? kindOf(c);
            const value = 'value' in c ? c.value : undefined;
            const head = { id: c.id, header: c.header };
            return (
              <Row
                key={c.id}
                name={
                  <div className={BOX}>
                    <DraftText
                      label="Column header"
                      value={c.header}
                      maxLength={PROMPT_MAX}
                      disabled={!b.canEdit}
                      onSave={(t) => {
                        if (t.trim()) change(c.id, { ...c, header: t.trim() });
                      }}
                    />
                  </div>
                }
                onRemove={() => save(columns.filter((x) => x.id !== c.id))}
                removeLabel={`Remove ${c.header}`}
                disabled={!b.canEdit}
              >
                <div className="flex items-center gap-2">
                  <Select
                    className="w-36 shrink-0"
                    selectClassName="text-[13px]"
                    aria-label={`${c.header}: what it holds`}
                    value={kind}
                    disabled={!b.canEdit}
                    onChange={(e) => {
                      const k = e.target.value as ColumnKind;
                      if (k === 'submitted') {
                        setPicking(({ [c.id]: _gone, ...rest }) => rest);
                        change(c.id, { ...head, ...submittedAfter(0) });
                      } else setPicking((p) => ({ ...p, [c.id]: k }));
                    }}
                  >
                    <option value="submitted">Submitted Date</option>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                  </Select>
                  {kind === 'submitted' ? null : (
                    <div className={`${BOX} flex-1`}>
                      <DraftText
                        key={kind}
                        label={`${c.header}: its value`}
                        value={kind === kindOf(c) && value !== undefined ? String(value) : ''}
                        maxLength={FIXED_TEXT_MAX}
                        disabled={!b.canEdit}
                        placeholder={kind === 'number' ? 'A number' : 'Text every row gets'}
                        onSave={(t) => {
                          const v = kind === 'number' ? readNumber(t) : t.trim() || null;
                          if (v === null) return;
                          setPicking(({ [c.id]: _gone, ...rest }) => rest);
                          change(c.id, { ...head, value: v });
                        }}
                      />
                    </div>
                  )}
                </div>
                {kind === 'submitted' && 'submitted' in c ? (
                  <SubmittedDays
                    label={c.header}
                    days={c.submitted.days}
                    disabled={!b.canEdit}
                    onDays={(d) => change(c.id, { ...head, ...submittedAfter(d) })}
                  />
                ) : kind !== kindOf(c) ? (
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">
                    Type a value to use it.
                  </p>
                ) : null}
              </Row>
            );
          })}
        </ul>
      ) : null}
      <button
        type="button"
        disabled={!b.canEdit || columns.length >= SHEET_FIXED_MAX}
        onClick={() =>
          save([
            ...columns,
            {
              id: newFormPartId('x'),
              header: newHeader(columns),
              ...submittedAfter(0),
            },
          ])
        }
        className={ADD}
      >
        <PlusIcon size={13} />
        Add Column
      </button>
    </Shell>
  );
}
