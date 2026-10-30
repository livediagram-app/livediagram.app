'use client';

// Add Field's second step, Shape (docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field): All kinds back to
// Pick, the kind as a pill, the built-in fields of the kind the type lacks as Ready to use (one press adds one), then
// "Or make your own": the field's Name, only the settings its kind needs, Required (and Notifies, a Person's), a
// live preview of a card holding it, and one button, "Add {Name}", off until the field is ready (and saying what is missing).
import { useId } from 'react';
import {
  CUSTOM_FIELD_LABEL_MAX,
  canBeRequired,
  linkTypesOf,
  withLinkTypes,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemFieldId,
  type ItemTypeDef,
} from '@liveplanner/items';
import { BackBar, Button, PlusIcon, TextInput } from '@liveplanner/ui';
import { BUILT_IN_ROLES, hasOptions, kindReadiness, READINESS_HINT } from './add-field-kinds';
import { ChoiceOptionsEditor } from './ChoiceOptionsEditor';
import { CustomFieldPreview, fieldIconOf } from './CustomFieldKindParts';
import {
  BUILT_IN_FIELD_LABELS,
  CUSTOM_KIND_LABELS,
  CalculationSelect,
  CurrencySelect,
  NotifiesSwitch,
  RatingScaleSelect,
  RequiredSwitch,
} from './ItemTypeFieldForms';
import { LinksToPicker, linkTypeNames } from './LinksToPicker';

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
    ...(field.kind === 'currency' ? {} : { currency: undefined }),
    ...(field.kind === 'calculated' ? {} : { calculation: undefined }),
    ...(field.required && canBeRequired(field.kind) ? {} : { required: undefined }),
    ...(field.notifies && field.kind === 'person' ? {} : { notifies: undefined }),
  };
}

export function AddFieldShape({
  field,
  onChange,
  types,
  ready,
  canAddCustom,
  onBack,
  onAdd,
  onAddBuiltIn,
}: {
  field: NewField;
  onChange: (next: NewField) => void;
  types: readonly ItemTypeDef[];
  // The built-in fields of this kind the type lacks, offered as Ready to use.
  ready: readonly ItemFieldId[];
  // Whether a field of the type's own can still be made (under ITEM_TYPE_CUSTOM_MAX).
  canAddCustom: boolean;
  onBack: () => void;
  onAdd: (field: NewField) => void;
  onAddBuiltIn: (id: ItemFieldId) => void;
}) {
  const ids = useId();
  const kind: CustomFieldKind = field.kind;
  const kindLabel = CUSTOM_KIND_LABELS[kind];
  const missing = kindReadiness(field);
  const name = field.label.trim();
  const set = (patch: Partial<NewField>) => onChange({ ...field, ...patch });

  return (
    <form
      aria-label={`New ${kindLabel} field`}
      className="flex flex-col motion-safe:animate-card-rise"
      onSubmit={(e) => {
        e.preventDefault();
        if (canAddCustom && !missing) onAdd(addedField(field));
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
      {canAddCustom ? (
        <ShapeOwn ids={ids} field={field} set={set} onChange={onChange} types={types} />
      ) : null}
      {canAddCustom ? (
        <div className="sticky bottom-0 flex flex-col gap-1.5 border-t border-slate-100 bg-white px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900">
          <Button
            type="submit"
            disabled={missing !== null}
            aria-describedby={missing ? `${ids}-hint` : undefined}
            className="w-full justify-center pointer-coarse:min-h-11"
          >
            <PlusIcon size={13} />
            <span className="truncate">{name ? `Add ${name}` : `Add ${kindLabel} Field`}</span>
          </Button>
          {missing ? (
            <p
              id={`${ids}-hint`}
              className="text-center text-[11px] text-slate-500 dark:text-slate-400"
            >
              {READINESS_HINT[missing]}
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

// A field of the type's own: its Name, its kind's settings, Required, Notifies (a Person field) and the preview.
function ShapeOwn({
  ids,
  field,
  set,
  onChange,
  types,
}: {
  ids: string;
  field: NewField;
  set: (patch: Partial<NewField>) => void;
  onChange: (next: NewField) => void;
  types: readonly ItemTypeDef[];
}) {
  const kind = field.kind;
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
      {kind === 'calculated' ? (
        <div className="flex flex-col gap-1">
          <span className={LABEL}>Calculation</span>
          <CalculationSelect
            value={field.calculation}
            onChange={(calculation) => set({ calculation })}
          />
        </div>
      ) : null}
      <RequiredSwitch field={field} onChange={(required) => set({ required })} />
      <NotifiesSwitch field={field} onChange={(notifies) => set({ notifies })} />
      <CustomFieldPreview
        label={field.label}
        kind={kind}
        options={field.options ?? []}
        linkLabel={
          linkTypeNames(
            linkTypesOf(field).map((id) => types.find((t) => t.id === id)?.label ?? id),
          ) || undefined
        }
        currency={field.currency}
        scale={field.scale}
        calculation={field.calculation}
        required={field.required === true && canBeRequired(kind)}
      />
    </div>
  );
}
