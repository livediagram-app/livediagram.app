'use client';

// The form as a respondent fills it in (docs/specs/030-forms/forms.md "Filling in a form"): the cover, the heading
// card (a later section's title), a progress bar past one section, the section's questions, an error summary on Next
// or Submit, Back / Next / Submit, and then the confirmation. The form link's page and the builder's Preview both draw
// it; only what Submit does differs.
import { useEffect, useRef } from 'react';
import { answerErrorMessage, promptOf, type PublicForm } from '@livepages/forms';
import { FormCoverBand } from '../FormCoverBand';
import { LinkedText } from '../LinkedText';
import { QuestionView } from '../QuestionView';
import { FormConfirmation } from './FormConfirmation';
import { useFormFill, type FillState, type SubmitOutcome } from './useFormFill';

// The form's colour, as its look (form-look.ts) sets it on an ancestor: the builder's page or the form link's.
export const FORM_ACCENT = 'var(--form-accent)';

export function FormFill({
  form,
  submit,
  draftKey,
  footer,
  preview = false,
  previewNote = 'This is a preview: nothing was sent.',
}: {
  form: PublicForm;
  submit: (state: FillState & { website: string }) => Promise<SubmitOutcome>;
  draftKey: string | null;
  // Below the card: the made-with line and Report This Form on the form page.
  footer?: React.ReactNode;
  // In the builder's Preview: the confirmation says what Submit did (an Editor's preview makes a card; a Viewer's
  // sends nothing).
  preview?: boolean;
  previewNote?: string;
}) {
  const honeypot = useRef<HTMLInputElement>(null);
  const fill = useFormFill(
    form,
    (state) => submit({ ...state, website: honeypot.current?.value ?? '' }),
    draftKey,
  );
  const summaryRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  // The error summary takes focus when it appears, so a screen reader hears it and the keyboard starts there.
  const summaryKey = fill.summary.join(',');
  useEffect(() => {
    if (summaryKey) summaryRef.current?.focus();
  }, [summaryKey]);
  // A new section starts at its top (not the first: the page above it, a status bar, stays in view).
  const shownSection = useRef(fill.section);
  useEffect(() => {
    if (shownSection.current === fill.section) return;
    shownSection.current = fill.section;
    topRef.current?.scrollIntoView?.({ block: 'start' });
  }, [fill.section]);

  if (fill.status === 'sent' || fill.status === 'closed') {
    return (
      <div className="flex flex-col gap-3">
        <div className="form-box form-ink overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
          <FormCoverBand cover={form.cover} accent={FORM_ACCENT} />
          <FormConfirmation
            heading={form.heading}
            message={
              fill.status === 'closed'
                ? 'This form has just closed, so your response wasn’t recorded.'
                : preview
                  ? `${form.confirmation} (${previewNote})`
                  : form.confirmation
            }
            closed={fill.status === 'closed'}
            onAgain={fill.status === 'sent' ? fill.again : undefined}
          />
        </div>
        {footer}
      </div>
    );
  }

  const sections = fill.count;
  const first = fill.section === 0;
  const lastSection = fill.section === fill.last;
  const questions = fill.current.questions;
  const cardId = (id: string) => `form-q-${id}`;
  return (
    <div ref={topRef} className="flex scroll-mt-4 flex-col gap-3">
      <div className="form-box form-ink overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
        <FormCoverBand cover={form.cover} accent={FORM_ACCENT} />
        <div
          className="border-t-[6px] border-[var(--form-accent)] px-6 pb-5 pt-5 max-sm:px-4"
          style={form.cover ? { borderTopWidth: 0 } : undefined}
        >
          {sections > 1 ? (
            <div className="mb-4">
              <div className="mb-1.5 flex justify-between text-[13px] font-medium text-slate-500 dark:text-slate-400">
                <span>
                  Section {fill.position + 1} of {sections}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Progress"
                aria-valuemin={1}
                aria-valuemax={sections}
                aria-valuenow={fill.position + 1}
                className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
              >
                <div
                  className="h-full rounded-full bg-[var(--form-accent)] transition-[width] duration-200 motion-reduce:transition-none"
                  style={{ width: `${((fill.position + 1) / sections) * 100}%` }}
                />
              </div>
            </div>
          ) : null}
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-slate-900 max-sm:text-[24px] dark:text-slate-50">
            {first ? form.heading : fill.current.title || `Section ${fill.section + 1}`}
          </h1>
          {first && form.description ? (
            <LinkedText
              text={form.description}
              className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300"
            />
          ) : null}
          {!first && fill.current.description ? (
            <LinkedText
              text={fill.current.description}
              className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300"
            />
          ) : null}
          {questions.some((q) => q.required) ? (
            <p className="mt-3 text-[13px] text-red-600 dark:text-red-400">* Required</p>
          ) : null}
        </div>
      </div>

      {fill.summary.length ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="form-box rounded-xl border-2 border-red-500 bg-red-50 p-4 outline-none dark:border-red-500/70 dark:bg-red-950/40"
        >
          <p className="text-[15px] font-semibold text-red-800 dark:text-red-200">
            {fill.summary.length === 1
              ? 'One answer needs a look'
              : `${fill.summary.length} answers need a look`}
          </p>
          <ul className="mt-1.5 list-disc pl-5 text-[14px] text-red-800 dark:text-red-200">
            {fill.summary.map((id) => {
              const q = questions.find((x) => x.id === id);
              if (!q) return null;
              return (
                <li key={id}>
                  <a
                    href={`#${cardId(id)}`}
                    className="underline underline-offset-2"
                    onClick={(e) => {
                      e.preventDefault();
                      const card = document.getElementById(cardId(id));
                      card?.scrollIntoView({ block: 'center' });
                      card?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
                    }}
                  >
                    {/[?!.:]$/.test(promptOf(q)) ? promptOf(q) : `${promptOf(q)}:`}{' '}
                    {answerErrorMessage(q, fill.errors[id]!)}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {questions.map((q) => (
        <QuestionView
          key={q.id}
          domId={cardId(q.id)}
          question={q}
          value={fill.state.answers[q.id]}
          other={fill.state.other[q.id] ?? ''}
          error={fill.errors[q.id]}
          onChange={(v) => fill.setAnswer(q.id, v)}
          onOther={(t) => fill.setOther(q.id, t)}
          onBlur={() => fill.blur(q.id)}
          disabled={fill.status === 'sending'}
        />
      ))}

      {/* The hidden field (blueprint DEFAULTS D4): a person never sees or fills it; a bot that does is dropped. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input
            ref={honeypot}
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
      </div>

      {fill.failure ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-[14px] text-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          {fill.failure}
        </p>
      ) : null}

      {/* Back and Next / Submit at the bottom right; the note sits to their left (first on a phone, its own line). */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        {!first ? (
          <button
            type="button"
            onClick={fill.back}
            className="form-box form-ink h-11 cursor-pointer rounded-lg border border-slate-300 bg-white px-5 text-[15px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Back
          </button>
        ) : null}
        {lastSection ? (
          <button
            type="button"
            onClick={() => void fill.send()}
            disabled={fill.status === 'sending'}
            className="flex h-11 cursor-pointer items-center gap-2 form-box rounded-lg bg-[var(--form-accent)] px-6 text-[15px] font-semibold text-[var(--form-on-accent)] shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--form-accent)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-80 dark:focus-visible:ring-offset-slate-950"
          >
            {fill.status === 'sending' ? (
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-current/40 border-t-current motion-reduce:animate-none"
              />
            ) : null}
            {fill.status === 'sending' ? 'Sending…' : 'Submit'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => fill.next()}
            className="h-11 cursor-pointer form-box rounded-lg bg-[var(--form-accent)] px-6 text-[15px] font-semibold text-[var(--form-on-accent)] shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--form-accent)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
          >
            Next
          </button>
        )}
        <span className="order-first mr-auto basis-full text-[12px] text-slate-500 sm:basis-auto dark:text-slate-400">
          Never submit passwords through livepages forms.
        </span>
      </div>
      {footer}
    </div>
  );
}
