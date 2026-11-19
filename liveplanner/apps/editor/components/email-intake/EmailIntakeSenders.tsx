'use client';

// Who Can Send (docs/specs/026-plan/email-to-board.md "The dialog"): two choices as full-width option rows, a native radio
// group underneath (arrow keys move between them, the browser's own focus and form semantics), then the warning that
// holds for both.
import { useId } from 'react';
import type { EmailIntakeSenders as Senders } from '@liveplanner/api-schema';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideAtSign, lucideUsers } from '@liveworkspace/icons/lucide';
import { Callout } from '@liveworkspace/ui/callout';

const MembersIcon = lucideGlyph(lucideUsers, 16);
const AnyoneIcon = lucideGlyph(lucideAtSign, 16);

const CHOICES: { value: Senders; label: string; hint: string; Icon: typeof MembersIcon }[] = [
  {
    value: 'members',
    label: 'Plan Members',
    hint: "Only the plan's owner and team, from the address their account uses",
    Icon: MembersIcon,
  },
  {
    value: 'anyone',
    label: 'Anyone with the Address',
    hint: 'Anyone who knows it, so keep it private',
    Icon: AnyoneIcon,
  },
];

export function EmailIntakeSenders({
  value,
  disabled,
  onChange,
}: {
  value: Senders;
  disabled: boolean;
  onChange: (next: Senders) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled} data-email-intake-senders="">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Who Can Send
      </legend>
      {/* One full-width row each (owner, 2026-11-17: there is room for the hint on one line). */}
      <div className="flex flex-col gap-2">
        {CHOICES.map(({ value: v, label, hint, Icon }) => {
          const on = v === value;
          return (
            <label
              key={v}
              className={`group relative flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/40 ${
                on
                  ? 'border-brand-500 bg-brand-50/70 dark:border-brand-400 dark:bg-brand-500/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800/60'
              } ${disabled ? 'cursor-default opacity-60' : ''}`}
            >
              <input
                type="radio"
                name={name}
                value={v}
                checked={on}
                onChange={() => onChange(v)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md ${
                  on
                    ? 'bg-brand-700 text-white dark:bg-brand-600'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                <Icon />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {label}
                </span>
                <span className="text-xs leading-snug text-slate-600 dark:text-slate-400">
                  {hint}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <Callout tone="warning" className="mt-1">
        Anyone who can send from an allowed address can add cards to this board. If the address
        leaks, press New Address.
      </Callout>
    </fieldset>
  );
}
