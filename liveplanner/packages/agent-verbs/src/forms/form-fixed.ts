// Values filled in automatically, for agents (docs/specs/030-forms/forms.md "Agents", blueprint §15 "Set values and
// extra columns"): a board form's card fields set on every response's card (Set Automatically) and a sheet form's
// extra columns (Extra Columns), set, changed and cleared through the builder's own edits (`withFixed`,
// `withSheetFixed`), and read back as read_form shows them. A refusal says what there is, and nothing is written.
import {
  FIXED_DAYS_MAX,
  FIXED_FIELDS_MAX,
  FIXED_TEXT_MAX,
  PROMPT_MAX,
  SHEET_FIXED_MAX,
  brokenFixed,
  destinationType,
  effectiveTarget,
  fixedFieldsOf,
  fixedValueOf,
  newFormPartId,
  promptOf,
  questionsOf,
  sheetHeaders,
  withFixed,
  withSheetFixed,
  type FixedField,
  type FixedValue,
  type FormDefinition,
  type SheetFixedColumn,
  type SubmittedDay,
} from '@liveplanner/forms';
import { PRIORITIES, type ItemTypeDef } from '@liveplanner/items';
import type { FormDraft } from './form-draft';
import { refuse, type FormRefusal, type Named } from './form-names';

// A value as agents give it: a value, or the submitted day plus some days in a zone. `value: null` clears.
export interface FixedInput {
  value?: string | number | readonly string[] | null;
  submitted?: { days?: number; timeZone?: string };
}
export interface SetFieldInput extends FixedInput {
  field: string;
}
export interface ColumnInput extends FixedInput {
  header: string;
}
export interface SetColumnInput extends FixedInput {
  column: string;
  header?: string;
}

// What read_form shows of each.
export type ReadSubmitted = { days: number; timeZone?: string };
export interface ReadFixedField {
  field: string;
  fieldId: string;
  value?: string | number | readonly string[];
  submitted?: ReadSubmitted;
  broken?: true;
}
export interface ReadExtraColumn {
  id: string;
  header: string;
  // The header as the sheet has it (made distinct from the form's others).
  column: string;
  value?: string | number;
  submitted?: ReadSubmitted;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const quoted = (names: readonly string[]) =>
  names.length ? names.map((n) => `"${n}"`).join(', ') : 'none';

// A time zone as Intl names one, the shape the stored form keeps (`readForm`'s ZONE).
const ZONE = /^[A-Za-z0-9_+\-/]{1,64}$/;

function zoneKnown(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// The submitted day as agents give it: `days` a whole 0..FIXED_DAYS_MAX (absent 0), `timeZone` an IANA zone.
function submittedOf(s: FixedInput['submitted']): Named<{ submitted: SubmittedDay }> {
  const days = s?.days ?? 0;
  if (!Number.isInteger(days) || days < 0 || days > FIXED_DAYS_MAX)
    return refuse(
      'fixed_value_invalid',
      `submitted.days is a whole number from 0 to ${FIXED_DAYS_MAX} (the days after the response is submitted).`,
    );
  const tz = s?.timeZone?.trim();
  if (tz !== undefined && (!ZONE.test(tz) || !zoneKnown(tz)))
    return refuse(
      'fixed_value_invalid',
      'submitted.timeZone is an IANA time zone such as Europe/London or America/New_York (UTC when left out).',
    );
  return { ok: true, submitted: { days, ...(tz ? { tz } : {}) } };
}

const both = () =>
  refuse('fixed_value_invalid', 'Give value or submitted, not both: one source per field.');

// What a field of `kind` takes, in words, for a refusal.
function takes(field: FixedField): string {
  switch (field.kind) {
    case 'choice':
      return `one of its options: ${quoted(field.options!)}`;
    case 'multichoice':
      return `a list of its options: ${quoted(field.options!)}`;
    case 'labels':
      return 'labels, as a list or a comma-separated text';
    case 'text':
      return `text, up to ${FIXED_TEXT_MAX} characters`;
    case 'number':
      return 'a number';
    case 'priority':
      return `a priority: ${PRIORITIES.join(', ')}`;
    case 'date':
      return `submitted: { days? } (the day the response is submitted, plus 0 to ${FIXED_DAYS_MAX} days)`;
  }
}

// An option as the field spells it, case aside.
const optionOf = (pick: unknown, options: readonly string[]) =>
  typeof pick === 'string' ? (options.find((o) => same(o, pick)) ?? pick) : pick;

// The stored value for `field` from what the agent gave, before it is checked against the field.
function rawValue(field: FixedField, v: NonNullable<FixedInput['value']>): unknown {
  switch (field.kind) {
    case 'priority':
      return typeof v === 'string' ? v.trim().toLowerCase() : v;
    case 'choice':
      return optionOf(v, field.options!);
    case 'multichoice':
      return ((Array.isArray(v) ? v : [v]) as readonly unknown[]).map((p) =>
        optionOf(p, field.options!),
      );
    case 'labels': {
      const list: readonly unknown[] =
        typeof v === 'string' ? v.split(',') : Array.isArray(v) ? v : [v];
      return list.map((l) => (typeof l === 'string' ? l.trim() : l)).filter((l) => l !== '');
    }
    case 'text':
      return typeof v === 'string' ? v.trim() : v;
    default:
      return v;
  }
}

// A card field's set value from the agent's input; a refusal says what the field takes.
function fieldValueOf(field: FixedField, input: FixedInput): Named<{ value: FixedValue }> {
  if (input.submitted !== undefined && input.value !== undefined && input.value !== null)
    return both();
  if (field.kind === 'date') {
    if (input.value !== undefined && input.value !== null)
      return refuse(
        'fixed_value_invalid',
        `${field.label} is a date: it takes ${takes(field)}, not a value.`,
      );
    const s = submittedOf(input.submitted);
    return s.ok ? { ok: true, value: { submitted: s.submitted } } : s;
  }
  if (input.submitted !== undefined || input.value === undefined || input.value === null)
    return refuse('fixed_value_invalid', `${field.label} takes ${takes(field)}.`);
  const value = { value: rawValue(field, input.value) } as FixedValue;
  if (fixedValueOf(value, field, 0) === undefined)
    return refuse('fixed_value_invalid', `${field.label} takes ${takes(field)}.`);
  return { ok: true, value };
}

// The card type a board form's set values name; a refusal when the form sends rows to a sheet or has no type.
function boardType(d: FormDraft): Named<{ type: ItemTypeDef }> {
  if (d.form.sheet)
    return refuse(
      'fixed_on_sheet',
      'This form’s responses are rows in a sheet: fill a column on every row with add_column instead.',
    );
  const type = destinationType(d.form.destination, d.types);
  if (!type)
    return refuse(
      'goes_to_needs_board',
      'Responses go nowhere yet: set respondsTo to a board before setting card fields automatically.',
    );
  return { ok: true, type };
}

const valueWords = (v: FixedValue): string =>
  'submitted' in v
    ? `the submitted date${v.submitted.days ? ` + ${v.submitted.days} days` : ''}`
    : Array.isArray(v.value)
      ? (v.value as readonly string[]).join(', ')
      : String(v.value);

// set_field: a card field every response's card gets without a question (value null: no longer set).
export function setFieldValue(d: FormDraft, input: SetFieldInput): FormRefusal | null {
  const t = boardType(d);
  if (!t.ok) return t;
  const { type } = t;
  const fields = fixedFieldsOf(type);
  const set = d.form.destination?.fixed ?? {};
  const named = fields.find((f) => same(f.id, input.field) || same(f.label, input.field));
  if (input.value === null && input.submitted === undefined) {
    // A field since removed from the type is named by its id, as read_form shows it.
    const id = named?.id ?? (input.field in set ? input.field : undefined);
    if (!id || !(id in set))
      return refuse(
        'field_not_set',
        `"${input.field}" is not set automatically. Set: ${quoted(Object.keys(set).map((k) => fields.find((f) => f.id === k)?.label ?? k))}.`,
      );
    d.form = withFixed(d.form, id, null);
    d.lines.push(`stops setting ${named?.label ?? id} automatically`);
    return null;
  }
  if (!named)
    return refuse(
      'field_not_settable',
      `${type.label} has no field "${input.field}" that can be set automatically. Fields that can: ${quoted(fields.map((f) => f.label))}.`,
    );
  const asking = questionsOf(d.form).find(
    (q) => q.goesTo?.to === 'field' && effectiveTarget(q, type).field?.id === named.id,
  );
  if (asking)
    return refuse(
      'field_asked',
      `"${promptOf(asking)}" (${asking.id}) already fills ${named.label}: one source per field. Send its answer elsewhere (set_question goesTo) or delete it first.`,
    );
  if (!(named.id in set) && Object.keys(set).length >= FIXED_FIELDS_MAX)
    return refuse('fixed_full', `A form sets at most ${FIXED_FIELDS_MAX} fields automatically.`);
  const v = fieldValueOf(named, input);
  if (!v.ok) return v;
  d.form = withFixed(d.form, named.id, v.value);
  d.lines.push(`sets ${named.label} automatically to ${valueWords(v.value)}`);
  return null;
}

// --- Extra columns ----------------------------------------------------------------------------------------------

type ColumnValue = { value: string | number } | { submitted: SubmittedDay };

// An extra column's value: a text, a number, or the submitted day (the default, as Add Column makes it).
function columnValueOf(input: FixedInput, fallback: boolean): Named<{ value?: ColumnValue }> {
  const hasValue = input.value !== undefined && input.value !== null;
  if (input.submitted !== undefined && hasValue) return both();
  if (input.submitted !== undefined || (!hasValue && fallback)) {
    const s = submittedOf(input.submitted);
    return s.ok ? { ok: true, value: { submitted: s.submitted } } : s;
  }
  if (!hasValue) return { ok: true };
  const v = input.value;
  if (typeof v === 'number' && Number.isFinite(v)) return { ok: true, value: { value: v } };
  if (typeof v === 'string' && v.trim() && [...v.trim()].length <= FIXED_TEXT_MAX)
    return { ok: true, value: { value: v.trim() } };
  return refuse(
    'fixed_value_invalid',
    `An extra column takes text (1 to ${FIXED_TEXT_MAX} characters), a number, or submitted: { days? }.`,
  );
}

function headerOf(raw: string): Named<{ header: string }> {
  const header = raw.trim();
  if (!header) return refuse('header_empty', 'An extra column needs a header.');
  if ([...header].length > PROMPT_MAX)
    return refuse('too_long', `A header holds at most ${PROMPT_MAX} characters.`);
  return { ok: true, header };
}

function sheetColumns(d: FormDraft): Named<{ columns: SheetFixedColumn[] }> {
  if (!d.form.sheet)
    return refuse(
      'columns_on_board',
      'This form’s responses are cards on a board: set a card field on every response with set_field instead.',
    );
  return { ok: true, columns: [...(d.form.sheet.fixed ?? [])] };
}

function resolveColumn(columns: readonly SheetFixedColumn[], ref: string) {
  const c = columns.find((x) => x.id === ref) ?? columns.find((x) => same(x.header, ref));
  return c
    ? ({ ok: true, column: c } as const)
    : refuse(
        'column_unknown',
        `No extra column "${ref}". Extra columns: ${quoted(columns.map((x) => `${x.header} (${x.id})`))}.`,
      );
}

const columnWords = (c: SheetFixedColumn) => valueWords(c);

// add_column: a column every row fills without a question.
export function addExtraColumn(d: FormDraft, input: ColumnInput): FormRefusal | null {
  const s = sheetColumns(d);
  if (!s.ok) return s;
  if (s.columns.length >= SHEET_FIXED_MAX)
    return refuse('columns_full', `A form fills at most ${SHEET_FIXED_MAX} extra columns.`);
  const h = headerOf(input.header);
  if (!h.ok) return h;
  const v = columnValueOf(input, true);
  if (!v.ok) return v;
  const column: SheetFixedColumn = { id: newFormPartId('x'), header: h.header, ...v.value! };
  d.form = withSheetFixed(d.form, [...s.columns, column]);
  d.lines.push(`added the extra column "${column.header}" (${column.id}): ${columnWords(column)}`);
  return null;
}

// set_column: an extra column's header or value.
export function setExtraColumn(d: FormDraft, input: SetColumnInput): FormRefusal | null {
  const s = sheetColumns(d);
  if (!s.ok) return s;
  const found = resolveColumn(s.columns, input.column);
  if (!found.ok) return found;
  let header = found.column.header;
  if (input.header !== undefined) {
    const h = headerOf(input.header);
    if (!h.ok) return h;
    header = h.header;
  }
  const v = columnValueOf(input, false);
  if (!v.ok) return v;
  const { id } = found.column;
  const value: ColumnValue =
    v.value ??
    ('submitted' in found.column
      ? { submitted: found.column.submitted }
      : { value: found.column.value });
  const next: SheetFixedColumn = { id, header, ...value };
  d.form = withSheetFixed(
    d.form,
    s.columns.map((c) => (c.id === id ? next : c)),
  );
  d.lines.push(`changed the extra column "${header}": ${columnWords(next)}`);
  return null;
}

// delete_column: the form stops filling it; the sheet keeps the column and the values rows hold.
export function deleteExtraColumn(d: FormDraft, ref: string): FormRefusal | null {
  const s = sheetColumns(d);
  if (!s.ok) return s;
  const found = resolveColumn(s.columns, ref);
  if (!found.ok) return found;
  d.form = withSheetFixed(
    d.form,
    s.columns.filter((c) => c.id !== found.column.id),
  );
  d.lines.push(
    `removed the extra column "${found.column.header}" (the sheet keeps its column and values)`,
  );
  return null;
}

// --- Reading ----------------------------------------------------------------------------------------------------

const readSubmitted = (s: SubmittedDay): ReadSubmitted => ({
  days: s.days,
  ...(s.tz ? { timeZone: s.tz } : {}),
});

// What read_form shows: a board form's set fields (in the type's field order, then any gone from it), or a sheet
// form's extra columns.
export function readFixedOf(
  form: FormDefinition,
  type: ItemTypeDef | undefined,
): { setAutomatically?: ReadFixedField[]; extraColumns?: ReadExtraColumn[] } {
  if (form.sheet) {
    const fixed = form.sheet.fixed ?? [];
    if (!fixed.length) return {};
    const written = new Map(sheetHeaders(form).map((h) => [h.key, h.header]));
    return {
      extraColumns: fixed.map((c) => ({
        id: c.id,
        header: c.header,
        column: written.get(c.id)!,
        ...('submitted' in c ? { submitted: readSubmitted(c.submitted) } : { value: c.value }),
      })),
    };
  }
  const set = form.destination?.fixed;
  if (!set || !Object.keys(set).length) return {};
  const fields = fixedFieldsOf(type);
  const broken = new Set(type ? brokenFixed(set, type) : Object.keys(set));
  const order = [
    ...fields.map((f) => f.id).filter((id) => id in set),
    ...Object.keys(set).filter((id) => !fields.some((f) => f.id === id)),
  ];
  return {
    setAutomatically: order.map((id) => {
      const v = set[id]!;
      return {
        field: fields.find((f) => f.id === id)?.label ?? id,
        fieldId: id,
        ...('submitted' in v ? { submitted: readSubmitted(v.submitted) } : { value: v.value }),
        ...(broken.has(id) ? { broken: true as const } : {}),
      };
    }),
  };
}
