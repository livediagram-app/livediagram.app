'use client';

// A custom field's editor in the item panel (docs/specs/026-plan/item-types.md "An item type"), by
// its kind. Every value is a plain string, number or true/false under the field's id; clearing a
// field removes its value. A value of the wrong kind (the field's kind changed) shows empty and is
// replaced by the next edit.
import { Select, TextInput } from '@livediagram/ui';
import {
  CURRENCY_DEFAULT,
  EMAIL_MAX,
  ITEM_UNKNOWN_STRING_MAX,
  isEmailAddress,
  type CustomFieldDef,
  type ItemFieldValue,
} from '@livediagram/items';
import { DateField, DebouncedText } from './item-field-editors';
import { PlanTypeGlyph } from './plan-type-glyph';

type Save = (value: ItemFieldValue | undefined) => void | boolean | Promise<boolean>;

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
          maxLength={ITEM_UNKNOWN_STRING_MAX}
          placeholder={`Add ${field.label.toLowerCase()}`}
          disabled={disabled}
          onSave={onSave}
        />
      );
    case 'link':
      return (
        <TextInput
          id={id}
          type="url"
          inputMode="url"
          placeholder="https://"
          disabled={disabled}
          compact
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
        <TextInput
          id={id}
          type="number"
          step="any"
          disabled={disabled}
          compact
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
    case 'currency': {
      // The amount, its currency's code beside it; kept to the penny.
      const code = field.currency ?? CURRENCY_DEFAULT;
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{code}</span>
          <TextInput
            id={id}
            type="number"
            step="0.01"
            inputMode="decimal"
            disabled={disabled}
            compact
            defaultValue={typeof value === 'number' ? value : ''}
            key={typeof value === 'number' ? value : 'none'}
            onBlur={(e) => {
              const raw = e.target.value.trim();
              const n = Math.round(Number(raw) * 100) / 100;
              if (raw === '') onSave(undefined);
              else if (Number.isFinite(n) && n !== value) onSave(n);
            }}
          />
        </div>
      );
    }
    case 'email':
      return (
        <div className="flex items-center gap-1.5">
          <TextInput
            id={id}
            type="email"
            inputMode="email"
            placeholder="name@example.com"
            maxLength={EMAIL_MAX}
            disabled={disabled}
            compact
            defaultValue={text}
            key={text}
            onBlur={(e) => {
              const raw = e.target.value.trim();
              if (raw === text) return;
              if (raw === '') onSave(undefined);
              else if (isEmailAddress(raw)) onSave(raw);
              else e.target.value = text;
            }}
          />
          {isEmailAddress(text) ? (
            // The address opens in the person's mail app, for anyone who can see the card.
            <a
              href={`mailto:${text}`}
              aria-label={`Email ${text}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              <PlanTypeGlyph glyph="mail" size={14} />
            </a>
          ) : null}
        </div>
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
    // A Card field is drawn by LinkedCardField (ItemFieldEditor), never here.
    case 'card':
      return null;
  }
}
