'use client';

// A custom field's editor in the item panel (docs/specs/026-plan/item-types.md "An item type"), by
// its kind. Every value is a plain string, number or true/false under the field's id; clearing a
// field removes its value. A value of the wrong kind (the field's kind changed) shows empty and is
// replaced by the next edit.
import { Select } from '@livediagram/ui';
import type { CustomFieldDef, ItemFieldValue } from '@livediagram/items';
import { FIELD_CLASS } from './PlanModal';
import { DateField, DebouncedText } from './item-field-editors';

type Save = (value: ItemFieldValue | undefined) => void;

const LINK = /^https:\/\/\S+$/i;

export function CustomFieldEditor({
  id,
  field,
  value,
  disabled,
  onSave,
}: {
  id: string;
  field: CustomFieldDef;
  value: ItemFieldValue | undefined;
  disabled: boolean;
  onSave: Save;
}) {
  const text = typeof value === 'string' ? value : '';
  switch (field.kind) {
    case 'text':
    case 'longtext':
      return (
        <DebouncedText
          id={id}
          multiline={field.kind === 'longtext'}
          value={text}
          placeholder={`Add ${field.label.toLowerCase()}`}
          disabled={disabled}
          onSave={onSave}
        />
      );
    case 'link':
      return (
        <input
          id={id}
          type="url"
          inputMode="url"
          placeholder="https://"
          disabled={disabled}
          className={FIELD_CLASS}
          defaultValue={text}
          key={text}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            if (raw === text) return;
            if (raw === '') onSave(undefined);
            else if (LINK.test(raw)) onSave(raw);
            else e.target.value = text;
          }}
        />
      );
    case 'number':
      return (
        <input
          id={id}
          type="number"
          step="any"
          disabled={disabled}
          className={FIELD_CLASS}
          defaultValue={typeof value === 'number' ? value : ''}
          key={typeof value === 'number' ? value : 'none'}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const n = Number(raw);
            if (raw === '') onSave(undefined);
            else if (Number.isFinite(n) && n !== value) onSave(n);
          }}
        />
      );
    case 'date':
      return <DateField id={id} value={value} disabled={disabled} onSave={onSave} />;
    case 'checkbox':
      return (
        <input
          id={id}
          type="checkbox"
          disabled={disabled}
          className="h-4 w-4 accent-brand-600 enabled:cursor-pointer"
          checked={value === true}
          onChange={(e) => onSave(e.target.checked ? true : undefined)}
        />
      );
    case 'choice': {
      const options = field.options ?? [];
      return (
        <Select
          id={id}
          className="w-full"
          selectClassName="text-[13px]"
          disabled={disabled}
          value={options.includes(text) ? text : ''}
          onChange={(e) => onSave(e.target.value || undefined)}
        >
          <option value="">None</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      );
    }
  }
}
