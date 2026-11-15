'use client';

// One card template's editor in the type editor's Templates tab (docs/specs/026-plan/item-types.md "Editing a type":
// Templates): its Name, then the card's own fields as the card's panel lays them out, each with the very control the
// panel uses (ItemFieldEditor over a stand-in card), writing into the template instead of a card.
import { useEffect, useId, useMemo, useRef } from 'react';
import {
  ITEM_TITLE_MAX,
  CARD_TEMPLATE_NAME_MAX,
  builtInFieldOfKind,
  customFieldOf,
  labelUsage,
  type CardTemplate,
  type ItemFields,
  type ItemTypeDef,
} from '@liveplanner/items';
import { TextInput } from '@liveplanner/ui';
import { DebouncedText } from './item-field-editors';
import {
  ItemFieldEditor,
  fieldId,
  fieldLabel,
  labelsItsControl,
  type ItemFieldContext,
} from './ItemFieldEditor';
import { ItemDetailsRow, ItemPanelSection } from './ItemPanelLayout';
import { usePlan } from './PlanContext';
import {
  templateFieldsOf,
  templateItem,
  templateNameProblem,
  withFieldValue,
  withPatch,
} from './card-template-draft';

const NO_PEOPLE: ItemFieldContext['people'] = [];
const NO_STATUSES: ItemFieldContext['statuses'] = [];

// A field drawn in the main column, under its name (as the card's panel does): rich text and checklists.
function isMainField(type: ItemTypeDef, f: string): boolean {
  if (f === 'description' || f === 'checklist') return true;
  const kind = customFieldOf(type, f)?.kind;
  return kind === 'longtext' || (kind !== undefined && builtInFieldOfKind(kind) === 'checklist');
}

export function CardTemplateEditor({
  type,
  template,
  templates,
  canEdit,
  fresh,
  onChange,
}: {
  // The type as the editor's draft has it: the fields shown are its fields now.
  type: ItemTypeDef;
  template: CardTemplate;
  // Every template of the type, for the name check.
  templates: readonly CardTemplate[];
  canEdit: boolean;
  // Just added: its Name takes the caret, the name selected to type over.
  fresh: boolean;
  onChange: (next: CardTemplate) => void;
}) {
  const ids = useId();
  const plan = usePlan();
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!fresh) return;
    nameRef.current?.focus();
    nameRef.current?.select();
  }, [fresh, template.id]);
  // The Labels menu's suggestions: the plan's labels with their counts, once per editor open, never per keystroke.
  const planItems = plan?.items;
  const labels = useMemo(() => (planItems ? labelUsage(planItems.values()) : []), [planItems]);
  const item = templateItem(type, template);
  const setFields = (fields: ItemFields) => onChange({ ...template, fields });
  const ctx: ItemFieldContext = {
    item,
    type,
    statuses: NO_STATUSES,
    people: plan?.people ?? NO_PEOPLE,
    canEdit,
    labels,
    onSave: (field, value) => setFields(withFieldValue(template.fields, field, value)),
    onPatch: (patch) => setFields(withPatch(template.fields, patch)),
    onOpenItem: () => {},
  };
  const nameProblem = templateNameProblem(templates, template);
  const shown = templateFieldsOf(type);
  const main = shown.filter((f) => isMainField(type, f));
  const details = shown.filter((f) => !isMainField(type, f));
  const title = template.fields['title'];

  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-6">
        <label
          htmlFor={`${ids}-name`}
          className="mb-1 block text-[13px] font-semibold text-slate-800 dark:text-slate-100"
        >
          Name
        </label>
        <TextInput
          ref={nameRef}
          id={`${ids}-name`}
          compact
          value={template.name}
          maxLength={CARD_TEMPLATE_NAME_MAX}
          disabled={!canEdit}
          invalid={!!nameProblem}
          aria-describedby={nameProblem ? `${ids}-name-problem` : undefined}
          onChange={(e) => onChange({ ...template, name: e.target.value })}
          className="max-w-[20rem]"
        />
        {nameProblem ? (
          <p
            id={`${ids}-name-problem`}
            className="mt-1 text-[12px] text-rose-600 dark:text-rose-400"
          >
            {nameProblem}
          </p>
        ) : null}
      </div>
      <ItemPanelSection heading="Title" htmlFor={fieldId(item, 'title')}>
        <DebouncedText
          id={fieldId(item, 'title')}
          value={typeof title === 'string' ? title : ''}
          wrapLines={3}
          maxLength={ITEM_TITLE_MAX}
          placeholder={type.newTitle}
          disabled={!canEdit}
          onSave={(v) => setFields(withFieldValue(template.fields, 'title', v || undefined))}
        />
      </ItemPanelSection>
      {main.map((f) => (
        <ItemPanelSection
          key={f}
          heading={fieldLabel(type, f)}
          htmlFor={labelsItsControl(type, f) ? fieldId(item, f) : undefined}
        >
          <ItemFieldEditor f={f} ctx={ctx} />
        </ItemPanelSection>
      ))}
      {details.length ? (
        <section aria-labelledby={`${ids}-details`} className="mb-6">
          <h4
            id={`${ids}-details`}
            className="mb-1 text-[13px] font-semibold text-slate-800 dark:text-slate-100"
          >
            Fields
          </h4>
          {details.map((f) => (
            <ItemDetailsRow
              key={f}
              field={f}
              label={fieldLabel(type, f)}
              htmlFor={labelsItsControl(type, f) ? fieldId(item, f) : undefined}
            >
              <ItemFieldEditor f={f} ctx={ctx} />
            </ItemDetailsRow>
          ))}
        </section>
      ) : null}
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        A card started from it takes its state and place from where it is made.
      </p>
    </div>
  );
}
