'use client';

// A field a newer liveplanner made, in the card panel (docs/specs/026-plan/item-types.md "Fields from a newer
// version"): read-only, never an input. Its value reads as plain text when it is one word, number or line of text
// (true and false as Yes and No); anything else this build cannot read is left out. A line under it says why it
// cannot be edited, and what does it.
import { LockIcon } from '@liveplanner/ui';
import type { ItemFieldValue } from '@liveplanner/items';

export const NEWER_FIELD_LINE = 'Made in a newer version of liveplanner. Reload to edit it.';

function plainText(value: ItemFieldValue | undefined): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return null;
}

export function NewerFieldValue({ id, value }: { id: string; value: ItemFieldValue | undefined }) {
  const text = plainText(value);
  return (
    <output id={id} className="flex min-h-7 flex-col justify-center gap-0.5 py-1">
      {text ? (
        <span className="line-clamp-3 text-[13px] leading-snug break-words text-slate-700 dark:text-slate-200">
          {text}
        </span>
      ) : null}
      <span className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        <span className="mt-px flex shrink-0" aria-hidden>
          <LockIcon size={11} />
        </span>
        <span className="min-w-0">{NEWER_FIELD_LINE}</span>
      </span>
    </output>
  );
}
