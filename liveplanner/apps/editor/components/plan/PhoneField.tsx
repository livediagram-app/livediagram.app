'use client';

// A Phone field in the card panel (docs/specs/026-plan/item-types.md "Phone"): a `tel` box, kept as typed, and a call
// button on its `tel:` link for anyone who can see the card. A number that isn't one goes back to the saved value.
import { TextInput, Tooltip } from '@liveplanner/ui';
import { isPhoneNumber, PHONE_MAX, phoneHref } from '@liveplanner/items';
import { PlanTypeGlyph } from './plan-type-glyph';

export function PhoneField({
  id,
  label,
  value,
  disabled,
  onSave,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onSave: (value: string | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <TextInput
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder="+44 20 7946 0958"
        maxLength={PHONE_MAX}
        disabled={disabled}
        compact
        defaultValue={value}
        key={value}
        onBlur={(e) => {
          const raw = e.target.value.trim();
          if (raw === value) return;
          if (raw === '') onSave(undefined);
          else if (isPhoneNumber(raw)) onSave(raw);
          else e.target.value = value;
        }}
      />
      {isPhoneNumber(value) ? (
        <Tooltip label={`Call ${label}`}>
          <a
            href={phoneHref(value)}
            aria-label={`Call ${value}`}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
          >
            <PlanTypeGlyph glyph="phone" size={14} />
          </a>
        </Tooltip>
      ) : null}
    </div>
  );
}
