'use client';

// The words step of every Describe with AI dialog (Describe a Rule, liveworkspace/docs/specs/018-automations/
// automations.md "AI"; liveplanner's Describe a Plan and Describe a Form): Try an Example first, its chips filling the
// box and putting the cursor in it (owner, 2026-11-22: "the try an example bits in the describe with AI screens should
// be above the textbox, not below it"), then the box with its count, a refusal said under it, and the source line
// (WorkbenchAiSource). One copy, so every dialog asks alike.

import { forwardRef, useId, type ReactNode } from 'react';
import { Button, TextArea } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';

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
    // The source line already shows the refusal (a key that failed says so on it, with Fix Key): the alert is then
    // heard, not drawn twice.
    saidOnSource?: boolean;
    // The source line: which AI drafts it, given the id the box is described by.
    source: (id: string) => ReactNode;
    onSubmit: () => void;
    // The wrapper's data attribute, for tests and shots ("data-describe-plan").
    dataAttr: string;
  }
>(function DescribePrompt(
  {
    label,
    text,
    onText,
    max,
    placeholder,
    examples,
    busy,
    said,
    saidOnSource = false,
    source,
    onSubmit,
    dataAttr,
  },
  ref,
) {
  const sourceId = useId();
  const saidId = useId();
  const examplesId = useId();
  const focus = () => (ref && typeof ref === 'object' ? ref.current?.focus() : undefined);
  return (
    <div {...{ [dataAttr]: '' }} className="flex flex-col gap-3 px-6 py-5 max-sm:px-4">
      {examples.length > 0 ? (
        <div role="group" aria-labelledby={examplesId} className="flex flex-col gap-2">
          <span
            id={examplesId}
            className="text-[12px] font-medium text-slate-600 dark:text-slate-300"
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
      ) : null}
      <div className="flex flex-col gap-1">
        <TextArea
          ref={ref}
          aria-label={label}
          aria-describedby={said ? `${saidId} ${sourceId}` : sourceId}
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
        <div className="flex justify-end">
          <span
            aria-live="polite"
            className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400"
          >
            {text.length} / {max}
          </span>
        </div>
      </div>
      {said && saidOnSource ? (
        <span role="alert" id={saidId} className="sr-only">
          {said}
        </span>
      ) : said ? (
        <Callout tone="warning" size="md" role="alert">
          <span id={saidId}>{said}</span>
        </Callout>
      ) : null}
      {source(sourceId)}
    </div>
  );
});
