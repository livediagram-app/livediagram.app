'use client';

// The token manager's create form (docs/specs/015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category).
// Inline rather than a popover: the Settings pane has the room, and a popover
// inside a dialog is one layer too many. Two states: the name form, then the
// one-time secret reveal (Copy + Done) once the token is minted. Reads and
// writes through the shared TokensController so the list below updates on
// create.
import { useState } from 'react';
import { Button, useCopiedFlash } from '@livediagram/ui';
import type { TokensController } from '@/hooks/persistence/useTokens';

const MAX_NAME = 60;

export function SettingsTokenCreate({ tokens }: { tokens: TokensController }) {
  const [name, setName] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const { copied, flash, reset: resetCopied } = useCopiedFlash(1500);

  const done = () => {
    setSecret(null);
    resetCopied();
    setName('');
  };

  const submit = async () => {
    const token = await tokens.create(name);
    if (token) setSecret(token);
  };

  if (secret) {
    return (
      <div
        role="status"
        className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10"
      >
        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          Copy your token now. For your security it won&apos;t be shown again.
        </p>
        <code className="block break-all rounded bg-white px-2 py-1.5 text-[11px] text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {secret}
        </code>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              // Flash only after the write RESOLVES, so a blocked clipboard
              // never says "Copied".
              void navigator.clipboard
                ?.writeText(secret)
                .then(() => flash())
                .catch(() => {});
            }}
            className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-emerald-500"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={done}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label
        htmlFor="settings-token-name"
        className="text-xs font-medium text-slate-600 dark:text-slate-300"
      >
        New Token
      </label>
      <div className="flex items-center gap-2">
        <input
          id="settings-token-name"
          value={name}
          maxLength={MAX_NAME}
          disabled={tokens.atCap}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. CI bot"
          className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-brand-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        />
        <Button type="submit" size="xs" disabled={tokens.creating || tokens.atCap}>
          {tokens.creating ? 'Creating…' : 'Create Token'}
        </Button>
      </div>
      {tokens.atCap ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          You have the maximum of {tokens.max} tokens. Revoke one to create another.
        </p>
      ) : null}
      {tokens.error ? (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {tokens.error}
        </p>
      ) : null}
    </form>
  );
}
