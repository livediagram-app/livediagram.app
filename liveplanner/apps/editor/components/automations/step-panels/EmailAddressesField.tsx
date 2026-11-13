'use client';

// Send Email's typed-in addresses (docs/specs/026-plan/automations.md "Typed-in addresses"): the shared ChipField. Enter,
// a comma, a semicolon or a space after an address makes it a chip, and a paste of several (on one line or many)
// splits into chips at once; leaving the field adds what is typed. An address that is not one stays as a rose chip, named by a screen
// reader and under the field, for its remove button to take out. Up to 10, each once; the field stops taking more
// at 10.

import { useId, useRef, useState } from 'react';
import { ChipField, type ChipFieldHandle } from '@liveworkspace/community-ui/chip-field';
import {
  AUTOMATION_ADDRESS_EMAILS_PER_DAY,
  AUTOMATION_EMAIL_ADDRESSES_MAX,
  automationAddress,
  splitAddresses,
} from '@liveplanner/items';

const SEPARATOR = /[\s,;]/;

// The chips a draft's addresses make, after `chips`: a good one as kept (lower case), a bad one as typed, each
// once, up to the step's 10.
function added(chips: readonly string[], parts: readonly string[]): string[] {
  const out = [...chips];
  for (const part of parts) {
    if (out.length >= AUTOMATION_EMAIL_ADDRESSES_MAX) break;
    const chip = automationAddress(part) ?? part;
    if (!out.includes(chip)) out.push(chip);
  }
  return out;
}

const isBad = (chip: string) => automationAddress(chip) === null;

export function EmailAddressesField({
  addresses,
  onChange,
  invalid,
}: {
  addresses: readonly string[];
  onChange: (next: string[]) => void;
  // The save refused the list or one of its addresses.
  invalid: boolean;
}) {
  const [draft, setDraft] = useState('');
  const field = useRef<ChipFieldHandle>(null);
  const id = useId();
  const hintId = useId();
  const problemId = useId();
  const full = addresses.length >= AUTOMATION_EMAIL_ADDRESSES_MAX;
  const bad = addresses.filter(isBad);

  const commit = (text: string, keep: string) => {
    const next = added(addresses, splitAddresses(text));
    if (next.length !== addresses.length) onChange(next);
    setDraft(keep);
  };

  const problem = bad.length
    ? bad.length === 1
      ? `${bad[0]} isn’t an email address.`
      : `${bad.length} of these aren’t email addresses.`
    : null;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
        Addresses
      </label>
      <ChipField
        ref={field}
        id={id}
        chips={addresses}
        removeLabel={(chip) => `Remove ${chip}`}
        invalidChip={isBad}
        invalidChipNote="not an email address"
        draft={draft}
        onDraftChange={(value) => {
          if (!SEPARATOR.test(value)) return setDraft(value);
          // Everything before the last separator is done; what follows it is still being typed.
          const cut = value.search(/[^\s,;]*$/);
          commit(value.slice(0, cut), value.slice(cut));
        }}
        onPaste={(e) => {
          // A pasted list, read before the input drops its line breaks: every address in it a chip at once.
          const text = e.clipboardData.getData('text');
          if (!SEPARATOR.test(text.trim())) return;
          e.preventDefault();
          commit(`${draft} ${text}`, '');
        }}
        onCommit={() => {
          field.current?.refocus();
          commit(draft, '');
        }}
        onRemove={(chip) => onChange(addresses.filter((a) => a !== chip))}
        onBlur={() => {
          if (draft.trim()) commit(draft, '');
        }}
        inputDisabled={full}
        invalid={invalid || bad.length > 0}
        placeholder={
          full
            ? `That is all ${AUTOMATION_EMAIL_ADDRESSES_MAX}`
            : addresses.length
              ? 'Add another'
              : 'name@example.com'
        }
        ariaDescribedBy={`${problemId} ${hintId}`}
      />
      {/* Always there, so a screen reader hears the problem the moment it appears. */}
      <p
        id={problemId}
        aria-live="polite"
        className="text-[12px] text-rose-600 empty:hidden dark:text-rose-400"
      >
        {problem}
      </p>
      <p id={hintId} className="text-[12px] text-slate-500 dark:text-slate-400">
        Press Enter or a comma after each, up to {AUTOMATION_EMAIL_ADDRESSES_MAX}. Each email says
        which plan and rule sent it, with a link to unsubscribe; the plan sends at most{' '}
        {AUTOMATION_ADDRESS_EMAILS_PER_DAY} a day to typed-in addresses.
      </p>
    </div>
  );
}
