'use client';

// The one-time reveal (docs/specs/015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category).
// A credential card in the current theme: an emerald-edged "done" card with
// the secret and command in monospace fields. Under it, a Try It command with the new
// token already filled in: the fastest proof that it works is running it.
import { useState } from 'react';
import { Button, CheckIcon, CopyIcon, Tooltip, useCopiedFlash } from '@livediagram/ui';
import { API_BASE } from '@/lib/api/core';
import { tryItCommand } from './token-status';

const SECRET_PREFIX = 'lvd_';

export function SettingsTokenReveal({ secret, onDone }: { secret: string; onDone: () => void }) {
  // Outlives each 1.5s "Copied" flash: once the secret is safe, Done leads.
  const [secretCopied, setSecretCopied] = useState(false);
  const command = tryItCommand(
    secret,
    API_BASE,
    typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
  );
  const hasPrefix = secret.startsWith(SECRET_PREFIX);

  return (
    <div
      role="status"
      aria-label="New token created"
      className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-3 text-slate-800 shadow-sm dark:border-emerald-500/30 dark:from-emerald-500/10 dark:to-slate-900 dark:text-slate-100"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950">
          <CheckIcon />
        </span>
        <span className="text-sm font-semibold">Token Created</span>
        <span className="ml-auto rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300">
          Shown Once
        </span>
      </div>

      <CopyField label="Copy token" onCopied={() => setSecretCopied(true)} value={secret}>
        {hasPrefix ? (
          <>
            <span className="text-emerald-600 dark:text-emerald-400">{SECRET_PREFIX}</span>
            {secret.slice(SECRET_PREFIX.length)}
          </>
        ) : (
          secret
        )}
      </CopyField>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Try It
        </span>
        <CopyField label="Copy command" value={command} multiline>
          <span className="text-slate-400">$ </span>
          {command}
        </CopyField>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          Store it somewhere safe. We keep only a fingerprint, so it can&apos;t be shown again.
        </p>
        <Button
          size="xs"
          variant={secretCopied ? 'primary' : 'secondary'}
          onClick={onDone}
          className="shrink-0"
        >
          Done
        </Button>
      </div>
    </div>
  );
}

// A value with its copy button inside the field's right edge, the way the
// Share dialog's pass link does it: the field IS the thing being copied, so
// the action lives in it. "Copied" only once the clipboard write resolves, so
// a blocked clipboard never claims success.
function CopyField({
  value,
  label,
  multiline = false,
  onCopied,
  children,
}: {
  value: string;
  label: string;
  multiline?: boolean;
  onCopied?: () => void;
  children: React.ReactNode;
}) {
  const { copied, flash } = useCopiedFlash(1500);
  const copy = () => {
    void navigator.clipboard
      ?.writeText(value)
      .then(() => {
        flash();
        onCopied?.();
      })
      .catch(() => {});
  };
  return (
    <div className="relative">
      <code
        className={`block select-all rounded-lg border border-slate-200 bg-slate-50 py-2 pr-10 pl-3 font-mono text-[11px] leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 ${
          // A command keeps its own line breaks and scrolls sideways, as it
          // would in a terminal, rather than wrapping mid-flag.
          multiline ? 'overflow-x-auto whitespace-pre' : 'break-all'
        }`}
      >
        {children}
      </code>
      <Tooltip label={copied ? 'Copied' : label}>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : label}
          className={`absolute right-1 flex h-7 w-7 items-center justify-center rounded-md transition ${
            multiline ? 'top-1' : 'top-1/2 -translate-y-1/2'
          } ${
            copied
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-400 hover:bg-slate-200/70 hover:text-brand-600 dark:hover:bg-slate-700 dark:hover:text-brand-300'
          }`}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </Tooltip>
    </div>
  );
}
