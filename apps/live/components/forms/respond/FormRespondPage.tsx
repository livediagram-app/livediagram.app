'use client';

// A form link's page (docs/specs/030-forms/forms.md "Filling in a form"): the form, on its tab theme's backdrop, with
// nothing of the editor around it: no sign-in, no document, no Explorer. Loading, not found, closed and the form
// itself are the page's four states; the form's own flow is FormFill.
import { useEffect, useState, type CSSProperties } from 'react';
import type { PublicFormResponse } from '@livediagram/api-schema';
import { formCodeFromPath } from '@/lib/form-path';
import { loadPublicForm, sendFormResponse } from '@/lib/api/forms-public';
import { FormCoverBand } from '../FormCoverBand';
import { FORM_BRAND, FormFill, formAccentStyle } from './FormFill';
import type { SubmitOutcome } from './useFormFill';
import { FormFooter } from './FormFooter';

type PageState =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'error' }
  | { kind: 'ready'; code: string; data: PublicFormResponse };

export function FormRespondPage() {
  const [page, setPage] = useState<PageState>({ kind: 'loading' });
  // Loads the form named by the address; every state is set once the answer is in.
  const load = () => {
    const code = formCodeFromPath(window.location.pathname);
    void (code ? loadPublicForm(code) : Promise.resolve({ kind: 'not_found' as const })).then((r) =>
      setPage(
        r.kind === 'ok' && code
          ? { kind: 'ready', code, data: r.data }
          : r.kind === 'ok'
            ? { kind: 'not_found' }
            : r,
      ),
    );
  };
  const retry = () => {
    setPage({ kind: 'loading' });
    load();
  };
  useEffect(load, []);
  const heading =
    page.kind === 'ready'
      ? page.data.state === 'open'
        ? page.data.form.heading
        : page.data.heading
      : null;
  useEffect(() => {
    if (heading) document.title = `${heading} | livediagram`;
  }, [heading]);

  const backdrop =
    page.kind === 'ready'
      ? ({
          '--bd-light': page.data.backdrop.light,
          '--bd-dark': page.data.backdrop.dark,
        } as CSSProperties)
      : undefined;
  return (
    <main
      style={backdrop}
      className={`min-h-dvh px-4 pb-16 pt-6 sm:pt-10 ${
        backdrop ? 'bg-[var(--bd-light)] dark:bg-[var(--bd-dark)]' : 'bg-slate-50 dark:bg-slate-950'
      }`}
    >
      <div className="mx-auto w-full max-w-[640px]">
        {page.kind === 'loading' ? <Skeleton /> : null}
        {page.kind === 'not_found' ? (
          <Notice
            title="This form isn’t available"
            body="It may have been deleted, or the link may be wrong."
          />
        ) : null}
        {page.kind === 'error' ? (
          <Notice
            title="We couldn’t load this form"
            body="Check your connection and try again."
            action={{ label: 'Try Again', run: retry }}
          />
        ) : null}
        {page.kind === 'ready' && page.data.state === 'closed' ? (
          <div style={formAccentStyle(page.data.accent)} className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
              <FormCoverBand cover={undefined} accent={page.data.accent ?? FORM_BRAND} />
              <div className="px-6 py-8 max-sm:px-4">
                <h1 className="text-[26px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  {page.data.heading}
                </h1>
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {page.data.message}
                </p>
              </div>
            </div>
            <FormFooter code={page.code} />
          </div>
        ) : null}
        {page.kind === 'ready' && page.data.state === 'open' ? (
          <FormFill
            form={page.data.form}
            draftKey={`livediagram:form:${page.code}`}
            footer={<FormFooter code={page.code} />}
            submit={async (state): Promise<SubmitOutcome> => {
              const r = await sendFormResponse(page.code, state);
              if (r.kind === 'sent') return { kind: 'sent' };
              if (r.kind === 'offline')
                return {
                  kind: 'failed',
                  message: 'We couldn’t send your response. Check your connection and try again.',
                };
              switch (r.refusal.error) {
                case 'invalid_answers':
                  return { kind: 'invalid', errors: r.refusal.errors };
                case 'form_closed':
                case 'form_full':
                case 'form_not_found':
                  return { kind: 'closed' };
                case 'form_busy':
                  return {
                    kind: 'failed',
                    message: 'This form is busy. Try again in a few minutes.',
                  };
                case 'rate_limited':
                  return {
                    kind: 'failed',
                    message: 'You’ve sent a lot of responses. Wait a minute and try again.',
                  };
              }
            }}
          />
        ) : null}
      </div>
    </main>
  );
}

function Skeleton() {
  return (
    <div aria-busy className="flex flex-col gap-3" aria-label="Loading the form">
      <div className="h-44 animate-pulse rounded-xl bg-white/70 motion-reduce:animate-none dark:bg-slate-900/70" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-xl bg-white/70 motion-reduce:animate-none dark:bg-slate-900/70"
        />
      ))}
    </div>
  );
}

function Notice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; run: () => void };
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
      <h1 className="text-[22px] font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
      <p className="mt-2 text-[15px] text-slate-600 dark:text-slate-300">{body}</p>
      {action ? (
        <button
          type="button"
          onClick={action.run}
          className="mt-5 h-10 cursor-pointer rounded-lg bg-brand-600 px-5 text-[14px] font-semibold text-white hover:bg-brand-700"
        >
          {action.label}
        </button>
      ) : null}
      <p className="mt-8 text-[13px] text-slate-500 dark:text-slate-400">
        <a href="/" className="underline underline-offset-2">
          Made with livediagram
        </a>
      </p>
    </div>
  );
}
