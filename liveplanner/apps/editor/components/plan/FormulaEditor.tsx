'use client';

// The formula editor (docs/specs/026-plan/item-types.md "Formula fields", In the type editor): a Calculated field's
// Formula written in place in its form, never a dialog. Its Result, a monospaced Formula box, a line checking it as it
// is typed ("Works", or the problem), the type's fields and the functions as chips that write themselves at the caret,
// and a Preview working it out on the type's first live card (CalculatedPreview). The box holds the formula with names; the field keeps it
// with ids (storedFormula), so a renamed field keeps working.
import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  FORMULA_MAX,
  FORMULA_RESULTS,
  FORMULA_RESULT_LABELS,
  FUNCTION_NAMES,
  formulaResultOf,
  formulaScopeOf,
  ITEM_TYPES,
  nameAsWritten,
  shownFormula,
  storedFormula,
  typeIn,
  type CustomFieldDef,
  type FormulaResult,
  type ItemTypeDef,
} from '@liveplanner/items';
import { Select, TextArea, lucideGlyph } from '@liveplanner/ui';
import { lucideCircleCheck, lucideTriangleAlert } from '@liveworkspace/icons/lucide';
import { CalculatedPreview } from './CalculatedPreview';
import { usePlan } from './PlanContext';

const CheckIcon = lucideGlyph(lucideCircleCheck, 13);
const AlertIcon = lucideGlyph(lucideTriangleAlert, 13);

const LABEL = 'text-[12px] font-medium text-slate-700 dark:text-slate-200';
const CHIP =
  'inline-flex min-h-6 cursor-pointer items-center rounded-md border px-1.5 text-[12px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 motion-reduce:transition-none pointer-coarse:min-h-9';
const FIELD_CHIP = `${CHIP} border-slate-200 bg-white font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10 dark:hover:text-brand-100`;
const FUNCTION_CHIP = `${CHIP} border-transparent bg-slate-100 font-mono text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-50`;

// The type a formula is written on, as the type editor holds it: its fields in order and its custom fields.
export interface FormulaDraft {
  // Undefined for a type being made: no card has it yet.
  typeId?: string | undefined;
  fields: readonly string[];
  custom: readonly CustomFieldDef[];
}

type FormulaFieldDraft = Pick<CustomFieldDef, 'formula' | 'result' | 'currency'> &
  Partial<Pick<CustomFieldDef, 'id'>>;

export function FormulaEditor({
  field,
  draft,
  onChange,
  keepLastWorking,
  currencySelect,
}: {
  field: FormulaFieldDraft;
  draft: FormulaDraft;
  onChange: (patch: Partial<Pick<CustomFieldDef, 'formula' | 'result' | 'showAs'>>) => void;
  // An existing field keeps its last working formula while the box holds one that doesn't; a new one has none.
  keepLastWorking: boolean;
  // The Currency menu, for a Currency result.
  currencySelect: ReactNode;
}) {
  const ids = useId();
  const plan = usePlan();
  const types = plan?.types ?? ITEM_TYPES;
  const box = useRef<HTMLTextAreaElement>(null);
  // The type as drafted: what the formula may read now, before the type is saved.
  const type: ItemTypeDef = useMemo(
    () => ({
      ...typeIn(types, draft.typeId ?? ''),
      ...(draft.typeId ? { id: draft.typeId } : {}),
      fields: [...draft.fields],
      custom: [...draft.custom],
    }),
    [types, draft.typeId, draft.fields, draft.custom],
  );
  const scope = useMemo(() => formulaScopeOf(type), [type]);
  const [text, setText] = useState(() => shownFormula(field.formula ?? '', scope));
  const check = useMemo(() => storedFormula(text, scope, field.id), [text, scope, field.id]);
  const result = formulaResultOf(field);
  const previewed = useMemo(
    () =>
      check.ok
        ? {
            kind: 'calculated' as const,
            calculation: 'formula' as const,
            ...field,
            formula: check.formula,
          }
        : null,
    [check, field],
  );

  const write = (next: string) => {
    setText(next);
    const stored = storedFormula(next, scope, field.id);
    if (stored.ok) onChange({ formula: stored.formula });
    else if (!keepLastWorking) onChange({ formula: undefined });
  };

  // A chip's text written at the caret (over any selection), the caret left after it: put back as soon as the box
  // holds the new text (a layout effect, before anything else can type), never on a later frame that could land
  // after more typing.
  const caretAfter = useRef<number | null>(null);
  useLayoutEffect(() => {
    const caret = caretAfter.current;
    if (caret === null) return;
    caretAfter.current = null;
    box.current?.focus();
    box.current?.setSelectionRange(caret, caret);
  }, [text]);
  const insert = (piece: string) => {
    const el = box.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = (text.slice(0, start) + piece + text.slice(end)).slice(0, FORMULA_MAX);
    caretAfter.current = Math.min(start + piece.length, next.length);
    write(next);
  };

  const empty = text.trim() === '';
  const status = empty
    ? { ok: null, line: 'Write a formula, such as Budget - Spent.' }
    : check.ok
      ? { ok: true, line: 'Works' }
      : {
          ok: false,
          line: keepLastWorking && field.formula ? `Not saved: ${check.error}` : check.error,
        };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-32 flex-1 flex-col gap-1">
          <span className={LABEL}>Result</span>
          <Select
            className="w-full"
            selectClassName="text-[13px]"
            value={result}
            onChange={(e) => {
              const next = e.target.value as FormulaResult;
              // Only a Percent result is a share: any other stops showing as a Percent bar.
              onChange({
                result: next === 'number' ? undefined : next,
                ...(next === 'percent' ? {} : { showAs: undefined }),
              });
            }}
          >
            {FORMULA_RESULTS.map((r) => (
              <option key={r} value={r}>
                {FORMULA_RESULT_LABELS[r]}
              </option>
            ))}
          </Select>
        </label>
        {result === 'currency' ? <div className="min-w-28 flex-1">{currencySelect}</div> : null}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${ids}-formula`} className={LABEL}>
          Formula
        </label>
        <TextArea
          id={`${ids}-formula`}
          ref={box}
          compact
          rows={2}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          maxLength={FORMULA_MAX}
          placeholder="Budget - Spent"
          invalid={status.ok === false}
          aria-invalid={status.ok === false}
          aria-describedby={`${ids}-check`}
          className="min-h-14 resize-y font-mono leading-relaxed"
          value={text}
          onChange={(e) => write(e.target.value)}
        />
        <p
          id={`${ids}-check`}
          role="status"
          className={`flex items-start gap-1.5 text-[12px] leading-snug ${
            status.ok === true
              ? 'text-emerald-700 dark:text-emerald-300'
              : status.ok === false
                ? 'text-red-700 dark:text-red-300'
                : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {status.ok === null ? null : (
            <span aria-hidden className="mt-px flex shrink-0">
              {status.ok ? <CheckIcon /> : <AlertIcon />}
            </span>
          )}
          <span className="min-w-0 break-words">{status.line}</span>
        </p>
      </div>
      <ChipRow label="Fields" id={`${ids}-fields`}>
        {scope.fields
          .filter((f) => f.id !== field.id)
          .map((f) => (
            <button
              key={f.id}
              type="button"
              className={FIELD_CHIP}
              onClick={() => insert(nameAsWritten(f.name))}
            >
              {f.name}
            </button>
          ))}
      </ChipRow>
      <ChipRow label="Functions" id={`${ids}-functions`}>
        {FUNCTION_NAMES.map((fn) => (
          <button key={fn} type="button" className={FUNCTION_CHIP} onClick={() => insert(`${fn}(`)}>
            {fn}
          </button>
        ))}
      </ChipRow>
      <CalculatedPreview
        typeId={draft.typeId}
        typeLabel={draft.typeId ? type.label : undefined}
        type={type}
        field={previewed}
        waiting="Waiting for a formula that works"
      />
    </div>
  );
}

function ChipRow({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-1">
      <span id={id} className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}
