'use client';

// A form link's page (docs/specs/030-forms/forms.md "Filling in a form"): the form, on its tab theme's backdrop and
// canvas style, with nothing of the editor around it: no sign-in, no project, no Explorer. Loading, not found, closed
// and the form itself are the page's four states; the form's own flow is FormFill.
import { useEffect, useState, type CSSProperties } from 'react';
import { useBrowserTabTitle } from '@/hooks/ui/useBrowserTabTitle';
import dynamic from 'next/dynamic';
import type { PublicFormResponse } from '@liveplanner/api-schema';
import { formCodeFromPath } from '@/lib/form-path';
import { loadPublicForm, sendFormResponse } from '@/lib/api/forms-public';
import { FormCoverBand } from '../FormCoverBand';
import { formLookProps } from '../form-look';
import { FORM_ACCENT, FormFill } from './FormFill';
import type { SubmitOutcome } from './useFormFill';
import { FormFooter } from './FormFooter';
import { MadeWithLiveplanner } from './MadeWithLiveplanner';

// The tab's canvas style behind the form, fetched only for a form that has one (most keep a plain backdrop).
const FormCanvasLayer = dynamic(() => import('./FormCanvasLayer').then((m) => m.FormCanvasLayer), {
  ssr: false,
});

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
  useBrowserTabTitle(heading ? `${heading} | liveplanner` : null);

  // The form's look (its tab's theme, finish and font) dresses the whole page, the backdrop included.
  const look = page.kind === 'ready' ? formLookProps(page.data.look) : null;
  return (
    <main
      {...look}
      style={
        look
          ? ({
              ...look.style,
              '--bd-light': page.kind === 'ready' ? page.data.look.backdrop.light : undefined,
              '--bd-dark': page.kind === 'ready' ? page.data.look.backdrop.dark : undefined,
            } as CSSProperties)
          : undefined
      }
      className={`min-h-dvh px-4 pb-16 pt-6 sm:pt-10 ${
        look ? 'bg-[var(--bd-light)] dark:bg-[var(--bd-dark)]' : 'bg-slate-50 dark:bg-slate-950'
      }`}
    >
      {page.kind === 'ready' && page.data.look.canvas ? (
        <FormCanvasLayer canvas={page.data.look.canvas} />
      ) : null}
      <div className="relative mx-auto w-full max-w-[640px]">
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
          <div className="flex flex-col gap-3">
            <div className="form-box form-ink overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
              <FormCoverBand cover={undefined} accent={FORM_ACCENT} />
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
            draftKey={`liveplanner:form:${page.code}`}
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
                default:
                  // Anything else the api answers (a fault on its side): said as a failed send, answers kept.
                  return {
                    kind: 'failed',
                    message: 'We couldn’t send your response. Check your connection and try again.',
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
    <div role="status" aria-busy className="flex flex-col gap-3" aria-label="Loading the form">
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
          className="mt-5 h-10 cursor-pointer rounded-lg bg-brand-700 px-5 text-[14px] font-semibold text-white hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700"
        >
          {action.label}
        </button>
      ) : null}
      <p className="mt-8">
        <MadeWithLiveplanner />
      </p>
    </div>
  );
}
