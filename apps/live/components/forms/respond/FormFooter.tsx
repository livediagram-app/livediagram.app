'use client';

// Under a form on its page (docs/specs/030-forms/forms.md "Filling in a form"): "Made with livediagram" and Report
// This Form, which opens a short report in place: a reason, an optional note, Send. One report per browser per form,
// the browser named by a random id kept in local storage (never the editor's identity).
import { useId, useState } from 'react';
import { MadeWithLivediagram } from './MadeWithLivediagram';
import {
  FORM_REPORT_NOTE_MAX,
  FORM_REPORT_REASONS,
  FORM_REPORT_REASON_LABELS,
  type FormReportReason,
} from '@livediagram/api-schema';
import { reportForm } from '@/lib/api/forms-public';

const BROWSER_KEY = 'livediagram:form-browser';

function browserId(): string {
  try {
    const known = localStorage.getItem(BROWSER_KEY);
    if (known) return known;
    const id = crypto.randomUUID();
    localStorage.setItem(BROWSER_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function FormFooter({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FormReportReason | null>(null);
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const name = useId();
  return (
    <footer className="flex flex-col items-center gap-3 pt-4 text-[13px] text-slate-500 dark:text-slate-400">
      <div className="flex items-center gap-3">
        <MadeWithLivediagram />
        <span aria-hidden>·</span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="cursor-pointer underline-offset-2 hover:underline"
        >
          Report This Form
        </button>
      </div>
      {open ? (
        <section
          aria-label="Report this form"
          className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left text-[14px] text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {state === 'sent' ? (
            <p role="status">Thanks. We’ve recorded your report.</p>
          ) : (
            <>
              <fieldset>
                <legend className="mb-2 font-semibold">What’s wrong with this form?</legend>
                <div className="flex flex-col gap-1.5">
                  {FORM_REPORT_REASONS.map((r) => (
                    <label key={r} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name={name}
                        className="h-4 w-4 cursor-pointer accent-red-600"
                        checked={reason === r}
                        onChange={() => setReason(r)}
                      />
                      {FORM_REPORT_REASON_LABELS[r]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="mt-3 block">
                <span className="mb-1 block text-[13px] text-slate-500 dark:text-slate-400">
                  Anything else? (optional)
                </span>
                <textarea
                  value={note}
                  maxLength={FORM_REPORT_NOTE_MAX}
                  rows={2}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              {state === 'failed' ? (
                <p role="alert" className="mt-2 text-red-700 dark:text-red-400">
                  We couldn’t send your report. Try again.
                </p>
              ) : null}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 cursor-pointer rounded-lg px-3 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!reason || state === 'sending'}
                  onClick={async () => {
                    if (!reason) return;
                    setState('sending');
                    const ok = await reportForm(code, {
                      reason,
                      note: note.trim(),
                      browser: browserId(),
                    });
                    setState(ok ? 'sent' : 'failed');
                  }}
                  className="h-9 cursor-pointer rounded-lg bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {state === 'sending' ? 'Sending…' : 'Send Report'}
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}
    </footer>
  );
}
