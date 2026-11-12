'use client';

// Create a Card (docs/specs/026-plan/automations.md "Actions"): its card type, title (values allowed), column, what
// it copies from the triggering card, and a Card field on the new card that points back at it.

import type { AutomationAction } from '@liveplanner/items';
import { outlineFields, type AutomationOutline } from '../automation-outline';
import { ValueTextField } from '../ValueInsert';
import { ChipToggles, PanelField, PanelSelect } from './panel-parts';

type CreateCard = AutomationAction & { kind: 'create_card' };
type Copy = NonNullable<CreateCard['copy']>[number];

const COPIES: readonly { value: Copy; label: string }[] = [
  { value: 'assignee', label: 'Assignee' },
  { value: 'labels', label: 'Labels' },
  { value: 'due', label: 'Due Date' },
];

export function CreateCardPanel({
  action,
  onChange,
  outline,
  invalid,
}: {
  action: CreateCard;
  onChange: (next: AutomationAction) => void;
  outline: AutomationOutline;
  invalid: boolean;
}) {
  const fields = outlineFields(outline.types);
  const type = outline.types.find((t) => t.id === action.type);
  const cardFields = (type?.custom ?? []).filter((f) => f.kind === 'card');
  const { status: _s, ...noStatus } = action;
  const { linkField: _l, ...noLink } = action;
  return (
    <div className="flex flex-col gap-4">
      <PanelField label="Card Type">
        {(id) => (
          <PanelSelect
            id={id}
            value={action.type}
            onChange={(e) => onChange({ ...noLink, type: e.target.value })}
          >
            {type ? null : <option value={action.type}>A card type no longer here</option>}
            {outline.types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </PanelSelect>
        )}
      </PanelField>
      <ValueTextField
        label="Title"
        multiline={false}
        maxLength={200}
        value={action.title}
        fields={fields}
        invalid={invalid}
        onChange={(title) => onChange({ ...action, title })}
      />
      <PanelField label="Column">
        {(id) => (
          <PanelSelect
            id={id}
            value={action.status ?? ''}
            onChange={(e) =>
              onChange(e.target.value ? { ...action, status: e.target.value } : noStatus)
            }
          >
            <option value="">The Same Column</option>
            {action.status && !outline.columns.some((c) => c.status === action.status) ? (
              <option value={action.status}>A column no longer here</option>
            ) : null}
            {outline.columns.map((c) => (
              <option key={c.status} value={c.status}>
                {c.name}
              </option>
            ))}
          </PanelSelect>
        )}
      </PanelField>
      <ChipToggles
        label="Copy From This Card"
        options={COPIES}
        value={action.copy ?? []}
        onChange={(copy) => onChange({ ...action, copy: copy as Copy[] })}
      />
      {cardFields.length > 0 ? (
        <PanelField
          label="Link Back In"
          hint="A Card field on the new card that points at this one."
        >
          {(id) => (
            <PanelSelect
              id={id}
              value={action.linkField ?? ''}
              onChange={(e) =>
                onChange(e.target.value ? { ...action, linkField: e.target.value } : noLink)
              }
            >
              <option value="">No Link</option>
              {cardFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </PanelSelect>
          )}
        </PanelField>
      ) : null}
    </div>
  );
}
