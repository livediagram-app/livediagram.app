'use client';

// The token manager's composer (docs/specs/015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category).
// Opens in place under the overview: a name, a few chips for the names people
// actually give tokens, and the date this one will stop working, so the
// six-month lifetime is a fact on screen rather than small print. Hands the
// minted secret up; the reveal is its own card (SettingsTokenReveal).
import { useState } from 'react';
import { Button, SOLID_BRAND_DARK_CONTROL } from '@livediagram/ui';
import type { TokensController } from '@/hooks/persistence/useTokens';
import { expiryFrom, formatTokenDate } from './token-status';

const MAX_NAME = 60;
// What a token is usually for. Filling the field is all a chip does.
const NAME_SUGGESTIONS = ['Claude', 'Cursor', 'CI Bot', 'Local Script'];

export function SettingsTokenCreate({
  tokens,
  onCreated,
  onCancel,
}: {
  tokens: TokensController;
  onCreated: (secret: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  // Fixed when the composer opens: the preview is a date, not a ticking clock.
  const [expires] = useState(() => expiryFrom(Date.now()));

  const submit = async () => {
    const secret = await tokens.create(name);
    if (secret) onCreated(secret);
  };

  return (
    <form
      aria-label="New API token"
      className="flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3 dark:border-brand-500/30 dark:bg-brand-500/5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          // Settings closes on Escape too; this one only closes the composer.
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="settings-token-name"
          className="text-xs font-semibold text-slate-700 dark:text-slate-200"
        >
          What Is It For?
        </label>
        <input
          id="settings-token-name"
          value={name}
          maxLength={MAX_NAME}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          placeholder="Name your token"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-500/20"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Suggested names">
          {NAME_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              aria-pressed={name === suggestion}
              onClick={() => setName(suggestion)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                name === suggestion
                  ? `border-brand-500 bg-brand-500 text-white ${SOLID_BRAND_DARK_CONTROL}`
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-500/60 dark:hover:text-brand-300'
              }`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Full read and write access to your documents, until{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {formatTokenDate(expires)}
        </span>
        .
      </p>

      {tokens.error ? (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {tokens.error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button size="xs" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="xs" disabled={tokens.creating || tokens.atCap}>
          {tokens.creating ? 'Creating…' : 'Create Token'}
        </Button>
      </div>
    </form>
  );
}
