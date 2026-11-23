'use client';

// The words step of an AI draft (Describe a Plan, docs/specs/026-plan/describe-a-plan.md "Where it starts"; Describe a
// Form, docs/specs/030-forms/describe-a-form.md "The dialog"): Try an Example above the text box, its count, a refusal
// said under it, and the source line (@liveworkspace/automations-ui's DescribePrompt); and the sign-in nudge a guest
// sees in its place. Shared, so the two dialogs ask alike.

import { forwardRef, type ReactNode } from 'react';
import { SparkleIcon } from '@liveplanner/ui';

// The words step itself is every Describe with AI dialog's, shared with Describe a Rule.
export { DescribePrompt, type DescribeExample } from '@liveworkspace/automations-ui/DescribePrompt';

/** A guest's nudge in the box's place: the sparkle and the words (Sign In is the dialog's footer). */
export function DescribeSignIn({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
        <SparkleIcon size={20} aria-hidden />
      </span>
      <p className="max-w-sm text-[14px] text-slate-700 dark:text-slate-200">{children}</p>
    </div>
  );
}

/** The dialog's title: the sparkle and its words, the words focusable so a step change is heard. */
export const DescribeTitle = forwardRef<HTMLSpanElement, { children: ReactNode }>(
  function DescribeTitle({ children }, ref) {
    return (
      <span className="flex items-center gap-2">
        <SparkleIcon size={16} aria-hidden className="text-brand-700 dark:text-brand-300" />
        <span ref={ref} tabIndex={-1} className="outline-none">
          {children}
        </span>
      </span>
    );
  },
);
