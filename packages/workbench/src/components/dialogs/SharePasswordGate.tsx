'use client';

import { useState } from 'react';
import { Button, TextInput, Glyph } from '@liveworkspace/ui';

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export type SharePasswordGateProps = {
  // The product's word for what the link opens, in lower case ('design', 'plan'): "This design is
  // password-protected", "Open design".
  noun: string;
  // True when the visitor already submitted a wrong password (vs the
  // first prompt), so we show an error line.
  invalid: boolean;
  // The owner's display name, for context ("X's design"), or
  // null when we don't know it yet.
  ownerName: string | null;
  onSubmit: (password: string) => void;
};

// Full-screen gate shown when a visitor opens a password-protected
// file's share link (docs/specs/013-workspace/share-password.md) and hasn't supplied a valid password.
// Submitting hands the password up; the editor stashes it on the
// session and re-runs the bootstrap, which either hydrates or re-shows
// this gate with `invalid` set. Each editor binds its noun once, in its own
// components/dialogs/SharePasswordGate.tsx.
export function SharePasswordGate({ noun, invalid, ownerName, onSubmit }: SharePasswordGateProps) {
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
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          <LockIcon />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {`This ${noun} is password-protected`}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {ownerName
              ? `Enter the password ${ownerName} set to open this ${noun}.`
              : `Enter the password the owner set to open this ${noun}.`}
          </p>
        </div>
        <TextInput
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Password"
          aria-label={`${capitalised(noun)} password`}
          aria-invalid={invalid}
        />
        {invalid ? (
          <p className="-mt-2 text-xs font-medium text-rose-600">
            That password didn&apos;t match. Try again.
          </p>
        ) : null}
        <Button type="submit" size="md" disabled={!value.trim()} className="w-full shadow-sm">
          {`Open ${noun}`}
        </Button>
      </form>
    </div>
  );
}

function LockIcon() {
  return (
    <Glyph size={22} units={16} strokeLinecap="butt" strokeLinejoin="miter">
      <rect x="3" y="7" width="10" height="7" rx="1.8" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" strokeLinecap="round" />
    </Glyph>
  );
}
