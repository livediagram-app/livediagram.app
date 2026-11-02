'use client';

import { useImperativeHandle, useRef, type Ref } from 'react';

// The six boxes an emailed code is typed into: the sign-in page's (liveworkspace/apps/site SignInFlow) and the
// Delete Account dialog's (packages/workbench DeleteAccountDialog), drawn once. Typing a digit moves on to the next box,
// Backspace in an empty box goes back, and a paste (or the phone's one-time-code suggestion, which lands in the first
// box) fills from the first. `onComplete` hears the code once every box holds a digit.

export const CODE_DIGITS = 6;
export const EMPTY_CODE: readonly string[] = Object.freeze(Array<string>(CODE_DIGITS).fill(''));

export interface CodeDigitsHandle {
  // Focuses the first box: when the step opens, and after a wrong code empties them.
  focus: () => void;
}

export interface CodeDigitsProps {
  digits: readonly string[];
  onDigits: (next: string[]) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  // The group's accessible name.
  label?: string;
  // Each box's look; the default is the shared field's, sized for a digit.
  boxClassName?: string;
  invalid?: boolean;
  ref?: Ref<CodeDigitsHandle>;
}

const BOX =
  'h-12 w-10 rounded-md border bg-white p-0 text-center text-lg font-semibold text-slate-900 tabular-nums outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-400';
const BORDER = 'border-slate-200 dark:border-slate-700';
const BORDER_INVALID = 'border-rose-400 dark:border-rose-400/70';

export function CodeDigits({
  digits,
  onDigits,
  onComplete,
  disabled,
  label = 'Verification code',
  boxClassName,
  invalid,
  ref,
}: CodeDigitsProps) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  useImperativeHandle(ref, () => ({ focus: () => boxes.current[0]?.focus() }), []);

  function fill(text: string, from: number) {
    const clean = text.replace(/\D/g, '').slice(0, CODE_DIGITS - from);
    const next = [...digits];
    for (let i = 0; i < clean.length; i++) next[from + i] = clean[i]!;
    onDigits(next);
    boxes.current[Math.min(from + clean.length, CODE_DIGITS - 1)]?.focus();
    const code = next.join('');
    if (code.length === CODE_DIGITS) onComplete?.(code);
  }

  return (
    <div role="group" aria-label={label} className="flex justify-center gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(box) => {
            boxes.current[i] = box;
          }}
          value={digit}
          inputMode="numeric"
          maxLength={1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          onChange={(event) => {
            const typed = event.target.value.replace(/\D/g, '');
            if (typed) return fill(typed, i);
            const next = [...digits];
            next[i] = '';
            onDigits(next);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !digit && i > 0) boxes.current[i - 1]?.focus();
          }}
          onPaste={(event) => {
            event.preventDefault();
            fill(event.clipboardData.getData('text'), 0);
          }}
          className={boxClassName ?? `${BOX} ${invalid ? BORDER_INVALID : BORDER}`}
        />
      ))}
    </div>
  );
}
