'use client';

// Add Field's second step, Shape (docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field): All kinds back to
// Pick, the kind as a pill, then the field's Name, only the settings its kind needs, Required, a live preview of a
// card holding it, and one button, "Add {Name}", off until the field is ready (and saying what is missing).
import { useId } from 'react';
import {
  CUSTOM_FIELD_LABEL_MAX,
  canBeRequired,
  linkTypesOf,
  withLinkTypes,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemTypeDef,
} from '@liveplanner/items';
import { Button, PlusIcon, TextInput, lucideGlyph } from '@liveplanner/ui';
import { lucideChevronLeft } from '@liveworkspace/icons/lucide';
import { hasOptions, kindReadiness, READINESS_HINT } from './add-field-kinds';
import { ChoiceOptionsEditor } from './ChoiceOptionsEditor';
import { CUSTOM_KIND_ICONS, CustomFieldPreview } from './CustomFieldKindParts';
import {
  CUSTOM_KIND_LABELS,
  CalculationSelect,
  CurrencySelect,
  RatingScaleSelect,
  RequiredSwitch,
} from './ItemTypeFieldForms';
import { LinksToPicker, linkTypeNames } from './LinksToPicker';

const BackIcon = lucideGlyph(lucideChevronLeft, 14);

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
  };
}

export function AddFieldShape({
  field,
  onChange,
  types,
  onBack,
  onAdd,
}: {
  field: NewField;
  onChange: (next: NewField) => void;
  types: readonly ItemTypeDef[];
  onBack: () => void;
  onAdd: (field: NewField) => void;
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
        if (!missing) onAdd(addedField(field));
      }}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-2 dark:border-slate-800">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-8 cursor-pointer items-center gap-1 rounded-md px-1.5 text-[12px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 motion-reduce:transition-none pointer-coarse:min-h-11 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <BackIcon aria-hidden />
          All kinds
        </button>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-0.5 pl-1.5 pr-2.5 text-[12px] font-medium text-brand-800 dark:bg-brand-500/15 dark:text-brand-100">
          <span aria-hidden className="[&_svg]:size-3.5">
            {CUSTOM_KIND_ICONS[kind]}
          </span>
          <span className="sr-only">Kind: </span>
          {kindLabel}
        </span>
      </div>
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
    </form>
  );
}
