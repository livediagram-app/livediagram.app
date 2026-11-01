'use client';

// A custom field's editor in the item panel (docs/specs/026-plan/item-types.md "An item type"), by
// its kind. Every value is a plain string, number or true/false under the field's id; clearing a
// field removes its value. A value of the wrong kind (the field's kind changed) shows empty and is
// replaced by the next edit.
import { CloseIcon, TextInput } from '@liveplanner/ui';
import {
  CURRENCY_DEFAULT,
  EMAIL_MAX,
  dateTimeZones,
  rangeEndOf,
  ITEM_UNKNOWN_STRING_MAX,
  RATING_STARS_ON_CARD,
  durationMinutes,
  isEmailAddress,
  ratingScaleOf,
  type CustomFieldDef,
  type ItemFieldValue,
} from '@liveplanner/items';
import { DateField, DebouncedText } from './item-field-editors';
import { ChoiceField } from './ChoiceField';
import { PlanTypeGlyph } from './plan-type-glyph';
import { RatingInput } from '../forms/RatingInput';
import { PercentSlider } from './PercentSlider';
import { DurationInput } from './time/DurationInput';
import { DateTimeInput } from './DateTimeInput';
import { DateRangeField } from './DateRangeField';
import { PhoneField } from './PhoneField';

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
    // A draggable bar and the number (docs/specs/026-plan/item-types.md "Percent").
    case 'percent':
      return (
        <PercentSlider
          id={id}
          label={field.label}
          value={value}
          disabled={disabled}
          onSave={(v) => void onSave(v)}
        />
      );
    // "2h 30m", stored as whole minutes (docs/specs/026-plan/item-types.md "Duration"); a Time Spent field is drawn by
    // the card panel itself (TimeSpentField).
    case 'duration':
      return (
        <DurationInput
          id={id}
          label={field.label}
          minutes={durationMinutes(field, value)}
          disabled={disabled}
          onSave={(m) => void onSave(m)}
        />
      );
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
    // A phone number as typed, and its call link (docs/specs/026-plan/item-types.md "Phone").
    case 'phone':
      return (
        <PhoneField
          id={id}
          label={field.label}
          value={text}
          disabled={disabled}
          onSave={(v) => void onSave(v)}
        />
      );
    case 'date':
      return <DateField id={id} value={value} disabled={disabled} onSave={onSave} />;
    // A moment in the viewer's zone (docs/specs/026-plan/item-types.md "Date and Time").
    case 'datetime':
      return (
        <div className="flex flex-col gap-0.5">
          <DateTimeInput
            id={id}
            label={field.label}
            value={text || undefined}
            disabled={disabled}
            onCommit={(v) => void onSave(v)}
          />
          <ZoneLine value={text} />
        </div>
      );
    case 'daterange':
      return (
        <div className="flex flex-col gap-0.5">
          <DateRangeField
            id={id}
            field={field}
            value={value}
            disabled={disabled}
            onSave={(v) => void onSave(v)}
          />
          {field.withTime ? <ZoneLine value={rangeEndOf(value, 'start')} /> : null}
        </div>
      );
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
    // Option chips and a list to pick from, one control for both (docs/specs/026-plan/item-types.md "Choice and
    // Multiple Choice in the card panel").
    case 'choice':
    case 'multichoice':
      return (
        <ChoiceField id={id} field={field} value={value} disabled={disabled} onSave={onSave} />
      );
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
    // A Card field is drawn by LinkedCardField and a Calculated field by CalculatedFieldValue (ItemFieldEditor),
    // never here.
    // Drawn by the card panel itself (ItemFieldEditor): a linked card, a worked-out value, a picture, and the built-in
    // fields' kinds, which it edits as their built-in fields. A Comments field's threads and a Votes field's votes
    // are never typed in (item-types.md "Comments and Votes fields").
    case 'card':
    case 'calculated':
    case 'image':
    case 'person':
    case 'labels':
    case 'colour':
    case 'checklist':
    case 'comments':
    case 'votes':
      return null;
  }
}

// Under a moment's box, the zone it reads in and where it was set when that is another (item-types.md "Date and Time"):
// a line rather than a tooltip, so a phone shows it too.
function ZoneLine({ value }: { value: unknown }) {
  const zones = dateTimeZones(value);
  return zones ? (
    <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{zones}</p>
  ) : null;
}
