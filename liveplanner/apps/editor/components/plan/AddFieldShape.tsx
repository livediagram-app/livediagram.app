'use client';

// Add Field's second step, Shape (docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field): All kinds back to
// Pick, the kind as a pill, the built-in fields of the kind the type lacks as Ready to use (one press adds one), then
// "Or make your own": the field's Name, only the settings its kind needs, Required (and Notifies, a Person's), a
// card holding it to try (AddFieldTryIt), and one button, "Add {Name}", off until the field is ready (and saying what is missing).
import { useId, useState } from 'react';
import {
  CUSTOM_FIELD_LABEL_MAX,
  canBeRequired,
  canShowAsPercent,
  holdsSeveralKind,
  hasResult,
  isFormulaField,
  isLookupField,
  isRollupField,
  linkTypesOf,
  withLinkTypes,
  type CustomFieldDef,
  type ItemFieldId,
  type ItemTypeDef,
} from '@liveplanner/items';
import { BackBar, Button, CheckIcon, PlusIcon, TextInput } from '@liveplanner/ui';
import type { ValueLoss } from './edit-field-values';
import {
  BUILT_IN_ROLES,
  hasOptions,
  kindReadiness,
  pickOf,
  READINESS_HINT,
} from './add-field-kinds';
import { ChoiceOptionsEditor } from './ChoiceOptionsEditor';
import { fieldIconOf } from './CustomFieldKindParts';
import { AddFieldTryIt } from './AddFieldTryIt';
import {
  BUILT_IN_FIELD_LABELS,
  PICK_KIND_LABELS,
  CalculationSelect,
  calculationPatch,
  CurrencySelect,
  RatingScaleSelect,
  FieldSwitches,
} from './ItemTypeFieldForms';
import { LinksToPicker, linkTypeNames } from './LinksToPicker';
import { FormulaEditor, type FormulaDraft } from './FormulaEditor';
import { RollupEditor } from './RollupEditor';

export type NewField = Omit<CustomFieldDef, 'id'>;

const LABEL = 'text-[12px] font-medium text-slate-700 dark:text-slate-200';

/** The field as added: its trimmed name, and only the settings its kind keeps. */
export function addedField(field: NewField): NewField {
  return {
    ...field,
    label: field.label.trim(),
    ...(hasOptions(field.kind) ? {} : { options: undefined }),
    ...(field.kind === 'rating' ? {} : { scale: undefined }),
    ...(field.kind === 'card' ? {} : { linkType: undefined, linkTypes: undefined }),
    ...(field.kind === 'currency' || (hasResult(field) && field.result === 'currency')
      ? {}
      : { currency: undefined }),
    ...(field.kind === 'calculated' ? {} : { calculation: undefined }),
    ...(isFormulaField(field) ? {} : { formula: undefined }),
    ...(hasResult(field) ? {} : { result: undefined }),
    ...(isRollupField(field) || isLookupField(field)
      ? {}
      : { through: undefined, aggregate: undefined, source: undefined }),
    ...(field.showAs === 'percent' && canShowAsPercent(field) ? {} : { showAs: undefined }),
    ...(field.required && canBeRequired(field.kind) ? {} : { required: undefined }),
    ...(field.notifies && field.kind === 'person' ? {} : { notifies: undefined }),
    ...(field.multiple && holdsSeveralKind(field.kind) ? {} : { multiple: undefined }),
    ...(field.blocks && field.kind === 'card' ? {} : { blocks: undefined }),
    ...(field.withTime && field.kind === 'daterange' ? {} : { withTime: undefined }),
  };
}

export function AddFieldShape({
  field,
  onChange,
  types,
  formulaDraft,
  ready,
  canAddCustom,
  onBack,
  onAdd,
  onAddBuiltIn,
  edit,
}: {
  field: NewField;
  onChange: (next: NewField) => void;
  types: readonly ItemTypeDef[];
  // The type as drafted, for a Formula's names and preview.
  formulaDraft?: FormulaDraft | undefined;
  // The built-in fields of this kind the type lacks, offered as Ready to use.
  ready: readonly ItemFieldId[];
  // Whether a field of the type's own can still be made (under ITEM_TYPE_CUSTOM_MAX).
  canAddCustom: boolean;
  onBack: () => void;
  onAdd: (field: NewField) => void;
  onAddBuiltIn: (id: ItemFieldId) => void;
  // Edit Field (item-types.md "Edit Field"): an existing field, saved by Save (`onAdd`), saying first what its new
  // type does to the values cards hold (`loss`), and asking before any is cut down or cleared. `builtIn`: a built-in
  // field on its own tile, renamed only (BuiltInShape).
  edit?: { loss: ValueLoss | null; builtIn?: BuiltInShapeOf | undefined } | undefined;
}) {
  const ids = useId();
  // Asking to confirm a Save that loses something; asked again whenever what it would lose changes.
  const [confirming, setConfirming] = useState<string | null>(null);
  const loss = edit?.loss ?? null;
  const losing = loss !== null && loss.asks;
  const lossKey = loss ? [loss.message, ...(loss.reads ?? [])].join('\n') : '';
  const asking = losing && confirming === lossKey;
  const builtIn = edit?.builtIn;
  // The tile it answers to by name: a variant's while its option is on (Several People), else its kind's.
  const kindLabel = PICK_KIND_LABELS[pickOf(field)];
  const name = field.label.trim();
  // A built-in renamed needs only its name: its values and rules are its own.
  const missing = builtIn ? (name ? null : 'name') : kindReadiness(field);
  const set = (patch: Partial<NewField>) => onChange({ ...field, ...patch });

  return (
    <form
      aria-label={edit ? `Edit ${kindLabel} field` : `New ${kindLabel} field`}
      className="flex flex-col motion-safe:animate-card-rise"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canAddCustom || missing) return;
        if (losing && !asking) setConfirming(lossKey);
        else onAdd(addedField(field));
      }}
    >
      <div className="px-2 pt-2">
        <BackBar label="All kinds" current={kindLabel} onClick={onBack} gap="tight" />
      </div>
      {ready.length > 0 ? (
        <ReadyToUse
          ready={ready}
          own={canAddCustom}
          headingId={`${ids}-ready`}
          onAdd={onAddBuiltIn}
        />
      ) : null}
      {builtIn ? (
        <BuiltInShape ids={ids} field={field} set={set} of={builtIn} />
      ) : canAddCustom ? (
        <ShapeOwn
          ids={ids}
          field={field}
          set={set}
          onChange={onChange}
          types={types}
          formulaDraft={formulaDraft}
        />
      ) : null}
      {canAddCustom ? (
        <div className="sticky bottom-0 flex flex-col gap-1.5 border-t border-slate-100 bg-white px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900">
          {loss ? (
            <div
              id={`${ids}-loss`}
              role="status"
              className={`rounded-lg px-2.5 py-1.5 text-[12px] leading-snug ${
                losing
                  ? 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-500/30'
                  : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {loss.message || asking ? (
                <p>
                  {loss.message} {asking ? 'Change them? Undo puts them back.' : null}
                </p>
              ) : null}
              {loss.reads?.length ? <StopsReading ids={ids} reads={loss.reads} /> : null}
            </div>
          ) : null}
          {edit ? (
            <div className="flex gap-2">
              {asking ? (
                <Button
                  variant="secondary"
                  className="flex-1 justify-center pointer-coarse:min-h-11"
                  onClick={() => setConfirming(null)}
                >
                  Keep Editing
                </Button>
              ) : null}
              <Button
                type="submit"
                disabled={missing !== null}
                aria-describedby={missing ? `${ids}-hint` : loss ? `${ids}-loss` : undefined}
                className="flex-1 justify-center pointer-coarse:min-h-11"
              >
                <CheckIcon size={13} />
                {asking ? 'Change Values' : 'Save'}
              </Button>
            </div>
          ) : (
            <Button
              type="submit"
              disabled={missing !== null}
              aria-describedby={missing ? `${ids}-hint` : undefined}
              className="w-full justify-center pointer-coarse:min-h-11"
            >
              <PlusIcon size={13} />
              <span className="truncate">{name ? `Add ${name}` : `Add ${kindLabel} Field`}</span>
            </Button>
          )}
          {missing ? (
            <p
              id={`${ids}-hint`}
              className="text-center text-[11px] text-slate-500 dark:text-slate-400"
            >
              {edit && missing === 'name' ? 'Name the field to save it.' : READINESS_HINT[missing]}
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

// The built-in fields of the kind the type lacks: one press adds one, keeping its id, so the features that use its
// role (the Gantt chart, Workload, notifications) find it. "Or make your own" follows while a field of the type's own
// can still be made.
function ReadyToUse({
  ready,
  own,
  headingId,
  onAdd,
}: {
  ready: readonly ItemFieldId[];
  own: boolean;
  headingId: string;
  onAdd: (id: ItemFieldId) => void;
}) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1.5 px-3.5 pt-3">
      <h3 id={headingId} className={LABEL}>
        Ready to use
      </h3>
      <ul className="flex flex-col gap-1">
        {ready.map((id) => (
          <li key={id}>
            <button
              type="button"
              autoFocus={!own}
              onClick={() => onAdd(id)}
              aria-describedby={`${headingId}-${id}`}
              className="group flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left transition hover:border-brand-300 hover:bg-brand-50/60 focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 motion-reduce:transition-none pointer-coarse:min-h-11 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10"
            >
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30"
              >
                {fieldIconOf(id, undefined).node}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-50">
                  {BUILT_IN_FIELD_LABELS[id]}
                </span>
                <span
                  id={`${headingId}-${id}`}
                  className="block truncate text-[11px] text-slate-500 dark:text-slate-400"
                >
                  {BUILT_IN_ROLES[id]}
                </span>
              </span>
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition group-hover:bg-brand-700 group-hover:text-white motion-reduce:transition-none"
              >
                <PlusIcon size={12} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {own ? (
        <div className="mt-1.5 flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <span aria-hidden className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          Or make your own
          <span aria-hidden className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>
      ) : null}
    </section>
  );
}

// What in the plan stops reading a built-in made another type (item-types.md "Edit Field": What stops reading it).
function StopsReading({ ids, reads }: { ids: string; reads: readonly string[] }) {
  return (
    <div className="mt-1 flex flex-col gap-0.5">
      <p id={`${ids}-reads`} className="font-medium">
        What stops reading it
      </p>
      <ul aria-labelledby={`${ids}-reads`} className="list-disc pl-4">
        {reads.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

// A built-in field on its own tile: what Shape says of it.
export type BuiltInShapeOf = {
  // Its built-in name, the Name's placeholder (a blank name reads as it again).
  placeholder: string;
  // The line Ready to use gives it, or Status's.
  role: string;
  // The Assignee: Notifies, as a Person field's.
  notifies: boolean;
};

// A built-in field renamed (item-types.md "Edit Field": Built-in fields): its Name, its role, and only the settings it
// really has (the Assignee's Notifies). No Options, Required or Try It: its values and rules are its own.
function BuiltInShape({
  ids,
  field,
  set,
  of,
}: {
  ids: string;
  field: NewField;
  set: (patch: Partial<NewField>) => void;
  of: BuiltInShapeOf;
}) {
  return (
    <div className="flex flex-col gap-3.5 px-3.5 pb-3 pt-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${ids}-name`} className={LABEL}>
          Name
        </label>
        <TextInput
          id={`${ids}-name`}
          autoFocus
          autoComplete="off"
          placeholder={of.placeholder}
          value={field.label}
          maxLength={CUSTOM_FIELD_LABEL_MAX}
          aria-describedby={`${ids}-role`}
          onChange={(e) => set({ label: e.target.value })}
          className="pointer-coarse:min-h-11"
        />
        <p id={`${ids}-role`} className="text-[11px] text-slate-500 dark:text-slate-400">
          {of.role}
        </p>
      </div>
      {of.notifies ? (
        <FieldSwitches field={{ kind: 'person', notifies: field.notifies }} onChange={set} />
      ) : null}
    </div>
  );
}

// A field of the type's own: its Name, its kind's settings, Required, Notifies (a Person field) and the preview.
function ShapeOwn({
  ids,
  field,
  set,
  onChange,
  types,
  formulaDraft,
}: {
  ids: string;
  field: NewField;
  set: (patch: Partial<NewField>) => void;
  onChange: (next: NewField) => void;
  types: readonly ItemTypeDef[];
  formulaDraft: FormulaDraft | undefined;
}) {
  const kind = field.kind;
  const formula = isFormulaField(field);
  return (
    <div className="flex flex-col gap-3.5 px-3.5 pb-3 pt-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${ids}-name`} className={LABEL}>
          Name
        </label>
        <TextInput
          id={`${ids}-name`}
          autoFocus
          autoComplete="off"
          placeholder="Field name"
          value={field.label}
          maxLength={CUSTOM_FIELD_LABEL_MAX}
          onChange={(e) => set({ label: e.target.value })}
          className="pointer-coarse:min-h-11"
        />
      </div>
      {hasOptions(kind) ? (
        <div role="group" aria-labelledby={`${ids}-options`} className="flex flex-col gap-1">
          <span id={`${ids}-options`} className={LABEL}>
            Options
          </span>
          <ChoiceOptionsEditor initial={field.options} onChange={(options) => set({ options })} />
        </div>
      ) : null}
      {kind === 'rating' ? (
        <div className="flex flex-col gap-1">
          <span className={LABEL}>Scale</span>
          <RatingScaleSelect value={field.scale} onChange={(scale) => set({ scale })} />
        </div>
      ) : null}
      {kind === 'currency' ? (
        <div className="flex flex-col gap-1">
          <span className={LABEL}>Currency</span>
          <CurrencySelect value={field.currency} onChange={(currency) => set({ currency })} />
        </div>
      ) : null}
      {kind === 'card' ? (
        <div className="flex flex-col gap-1">
          <span className={LABEL}>Links To</span>
          <LinksToPicker
            value={linkTypesOf(field)}
            onChange={(next) => onChange(withLinkTypes(field, next))}
          />
        </div>
      ) : null}
      {pickOf(field) === 'calculated' ? (
        <div className="flex flex-col gap-1">
          <span className={LABEL}>Calculation</span>
          <CalculationSelect
            value={field.calculation}
            onChange={(calculation) => set(calculationPatch(calculation))}
          />
        </div>
      ) : null}
      {formula ? (
        <FormulaEditor
          field={field}
          draft={formulaDraft ?? { fields: [], custom: [] }}
          keepLastWorking={false}
          onChange={set}
          currencySelect={
            <CurrencySelect value={field.currency} onChange={(currency) => set({ currency })} />
          }
        />
      ) : null}
      {isRollupField(field) || isLookupField(field) ? (
        <RollupEditor
          field={field}
          draft={formulaDraft ?? { fields: [], custom: [] }}
          onChange={set}
        />
      ) : null}
      <FieldSwitches field={field} onChange={set} />
      {/* A Formula, Rollup or Lookup previews on a real card, in its editor. */}
      {hasResult(field) ? null : (
        <AddFieldTryIt
          field={field}
          linkLabel={
            linkTypeNames(
              linkTypesOf(field).map((id) => types.find((t) => t.id === id)?.label ?? id),
            ) || undefined
          }
          required={field.required === true && canBeRequired(field.kind)}
        />
      )}
    </div>
  );
}
