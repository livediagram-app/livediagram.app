'use client';

// A custom field's editor in the item panel (docs/specs/026-plan/item-types.md "An item type"), by
// its kind. Every value is a plain string, number or true/false under the field's id; clearing a
// field removes its value. A value of the wrong kind (the field's kind changed) shows empty and is
// replaced by the next edit.
import { CloseIcon, Select, TextInput } from '@livediagram/ui';
import {
  CURRENCY_DEFAULT,
  EMAIL_MAX,
  ITEM_UNKNOWN_STRING_MAX,
  RATING_STARS_ON_CARD,
  isEmailAddress,
  ratingScaleOf,
  type CustomFieldDef,
  type ItemFieldValue,
} from '@livediagram/items';
import { DateField, DebouncedText } from './item-field-editors';
import { PlanTypeGlyph } from './plan-type-glyph';
import { RatingInput } from '../forms/RatingInput';

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
            if (raw === '') void onSave(undefined);
            else if (LINK.test(raw)) void onSave(raw);
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
            if (raw === '') void onSave(undefined);
            else if (Number.isFinite(n) && n !== value) void onSave(n);
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
              if (raw === '') void onSave(undefined);
              else if (Number.isFinite(n) && n !== value) void onSave(n);
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
              if (raw === '') void onSave(undefined);
              else if (isEmailAddress(raw)) void onSave(raw);
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
          onChange={(e) => void onSave(e.target.checked ? true : undefined)}
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
          onChange={(e) => void onSave(e.target.value || undefined)}
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
    case 'multichoice': {
      // Checkboxes, one an option; the picks kept in option order (docs/specs/030-forms/forms.md).
      const options = field.options ?? [];
      const picks = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string')
        : [];
      return (
        <div id={id} role="group" aria-label={field.label} className="flex flex-col gap-1">
          {options.map((o) => (
            <label
              key={o}
              className="flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200"
            >
              <input
                type="checkbox"
                disabled={disabled}
                className="h-4 w-4 accent-brand-600 enabled:cursor-pointer"
                checked={picks.includes(o)}
                onChange={(e) => {
                  const next = options.filter((x) =>
                    x === o ? e.target.checked : picks.includes(x),
                  );
                  void onSave(next.length ? next : undefined);
                }}
              />
              {o}
            </label>
          ))}
        </div>
      );
    }
    case 'rating': {
      const scale = ratingScaleOf(field);
      const n = typeof value === 'number' ? value : undefined;
      return (
        <div id={id} className="flex items-center gap-1">
          <RatingInput
            label={field.label}
            value={n}
            scale={scale}
            style={scale > RATING_STARS_ON_CARD ? 'numbers' : 'stars'}
            size="sm"
            disabled={disabled}
            onChange={(v) => void onSave(v)}
          />
          {n !== undefined && !disabled ? (
            <button
              type="button"
              aria-label={`Clear ${field.label}`}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              onClick={() => void onSave(undefined)}
            >
              <CloseIcon size={12} />
            </button>
          ) : null}
        </div>
      );
    }
    // A Card field is drawn by LinkedCardField (ItemFieldEditor), never here.
    case 'card':
      return null;
  }
}
