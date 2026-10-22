'use client';

// The confirmation after Submit (docs/specs/030-forms/forms.md "Filling in a form"): a check mark drawn in (still
// under reduced motion), the form's heading, its message and Submit Another Response. A form that closed while it was
// being filled in says so instead, without the check mark.
import { useEffect, useRef } from 'react';

export function FormConfirmation({
  heading,
  message,
  closed = false,
  onAgain,
}: {
  heading: string;
  message: string;
  closed?: boolean;
  onAgain?: (() => void) | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Focus moves to the confirmation, so a screen reader hears it.
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="flex flex-col items-center px-6 py-10 text-center outline-none"
    >
      {closed ? null : (
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden className="form-check mb-4">
          <circle
            cx="32"
            cy="32"
            r="29"
            fill="none"
            stroke="var(--form-accent)"
            strokeWidth="3"
            className="form-check-ring"
          />
          <path
            d="M20 33.5l8 8 16-17"
            fill="none"
            stroke="var(--form-accent)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="form-check-tick"
          />
        </svg>
      )}
      <h1 className="text-[24px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        {heading}
      </h1>
      <p className="mt-2 max-w-md whitespace-pre-line text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
        {message}
      </p>
      {onAgain ? (
        <button
          type="button"
          onClick={onAgain}
          className="mt-6 cursor-pointer text-[15px] font-medium text-[var(--form-accent)] underline underline-offset-4 hover:no-underline"
        >
          Submit Another Response
        </button>
      ) : null}
    </div>
  );
}
