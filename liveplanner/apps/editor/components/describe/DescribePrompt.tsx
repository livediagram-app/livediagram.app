'use client';

// The words step of an AI draft (Describe a Plan, docs/specs/026-plan/describe-a-plan.md "Where it starts"; Describe a
// Form, docs/specs/030-forms/describe-a-form.md "The dialog"): the text box with its count, the example chips that
// fill it, a refusal said under it, and the AI line; and the sign-in nudge a guest sees in its place. Shared, so the
// two dialogs ask alike.

import { forwardRef, useId, type ReactNode } from 'react';
import { Button, SparkleIcon, TextArea } from '@liveplanner/ui';
import { AiNote } from '@/components/automations/step-panels/AiStepPanel';

export type DescribeExample = { label: string; text: string };

export const DescribePrompt = forwardRef<
  HTMLTextAreaElement,
  {
    // The box's accessible name ("Describe the plan").
    label: string;
    text: string;
    onText: (text: string) => void;
    max: number;
    placeholder: string;
    examples: readonly DescribeExample[];
    busy: boolean;
    // A refusal, in the api's fixed words or the dialog's own.
    said: string | null;
    // The AI line ("Uses AI: ...").
    note: ReactNode;
    onSubmit: () => void;
    // The wrapper's data attribute, for tests and shots ("data-describe-plan").
    dataAttr: string;
  }
>(function DescribePrompt(
  { label, text, onText, max, placeholder, examples, busy, said, note, onSubmit, dataAttr },
  ref,
) {
  const noteId = useId();
  const saidId = useId();
  const examplesId = useId();
  const focus = () => (ref && typeof ref === 'object' ? ref.current?.focus() : undefined);
  return (
    <div {...{ [dataAttr]: '' }} className="flex flex-col gap-3 px-6 py-5 max-sm:px-4">
      <TextArea
        ref={ref}
        aria-label={label}
        aria-describedby={said ? `${saidId} ${noteId}` : noteId}
        aria-invalid={said ? true : undefined}
        rows={4}
        maxLength={max}
        value={text}
        readOnly={busy}
        placeholder={placeholder}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        className="resize-none"
      />
      <div className="-mt-1 flex justify-end">
        <span
          aria-live="polite"
          className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400"
        >
          {text.length} / {max}
        </span>
      </div>
      <div role="group" aria-labelledby={examplesId} className="flex flex-col gap-2">
        <span
          id={examplesId}
          className="text-[12px] font-medium text-slate-500 dark:text-slate-400"
        >
          Try an Example
        </span>
        <div className="flex flex-wrap gap-2">
          {examples.map((e) => (
            <Button
              key={e.label}
              variant="secondary"
              size="xs"
              disabled={busy}
              title={e.text}
              onClick={() => {
                onText(e.text);
                focus();
              }}
            >
              {e.label}
            </Button>
          ))}
        </div>
      </div>
      {said ? (
        <p
          id={saidId}
          role="alert"
          className="rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
        >
          {said}
        </p>
      ) : null}
      <AiNote id={noteId}>{note}</AiNote>
    </div>
  );
});

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
