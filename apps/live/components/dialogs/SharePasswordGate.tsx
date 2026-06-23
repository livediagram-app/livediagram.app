'use client';

import { useState } from 'react';

type SharePasswordGateProps = {
  // True when the visitor already submitted a wrong password (vs the
  // first prompt), so we show an error line.
  invalid: boolean;
  // The diagram owner's display name, for context ("X's diagram"), or
  // null when we don't know it yet.
  ownerName: string | null;
  onSubmit: (password: string) => void;
};

// Full-screen gate shown when a visitor opens a password-protected
// diagram's share link (spec/24) and hasn't supplied a valid password.
// Submitting hands the password up; the editor stashes it on the
// session and re-runs the bootstrap, which either hydrates or re-shows
// this gate with `invalid` set.
export function SharePasswordGate({ invalid, ownerName, onSubmit }: SharePasswordGateProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex w-[26rem] max-w-full animate-fly-up-in flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          <LockIcon />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            This diagram is password-protected
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {ownerName
              ? `Enter the password ${ownerName} set to open this diagram.`
              : 'Enter the password the owner set to open this diagram.'}
          </p>
        </div>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Password"
          aria-label="Diagram password"
          aria-invalid={invalid}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        {invalid ? (
          <p className="-mt-2 text-xs font-medium text-rose-600">
            That password didn&apos;t match. Try again.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!value.trim()}
          className="w-full rounded-md bg-brand-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
        >
          Open diagram
        </button>
      </form>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="3" y="7" width="10" height="7" rx="1.8" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" strokeLinecap="round" />
    </svg>
  );
}
