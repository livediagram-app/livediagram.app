'use client';

// "New token" header action (spec/61): a button that sits in the Explorer
// pane header (right of the help button) and opens a popover to create a
// token, so the creation form is NOT an inline screen in the list. The popover
// has two states — the name form, then the one-time secret reveal (Copy + Done
// side by side) once the token is minted. Reads/writes through the shared
// TokensController so the list + sidebar badge update on create.
import { useRef, useState } from 'react';
import { PortalMenu } from '@/components/primitives/PortalMenu';
import type { TokensController } from '@/hooks/persistence/useTokens';

const MAX_NAME = 60;

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" aria-hidden>
      <path d="M6 1.5v9M1.5 6h9" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function NewTokenButton({ tokens }: { tokens: TokensController }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => {
    setOpen(false);
    setSecret(null);
    setCopied(false);
    setName('');
  };

  const submit = async () => {
    const token = await tokens.create(name);
    if (token) setSecret(token);
  };

  // At the cap there's nothing to create — keep the button visible but inert
  // (the list explains why), unless a freshly minted secret is still showing.
  const disabled = tokens.atCap && !secret && !open;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PlusIcon />
        New token
      </button>
      {open ? (
        <PortalMenu anchor={btnRef.current} placement="below" onClose={close}>
          <div className="px-3 py-2">
            {secret ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  Copy your token now. For your security it won&apos;t be shown again.
                </p>
                <code className="block break-all rounded bg-slate-100 px-2 py-1.5 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {secret}
                </code>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(secret);
                      setCopied(true);
                    }}
                    className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-emerald-500"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Token name
                </label>
                <input
                  value={name}
                  maxLength={MAX_NAME}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submit();
                  }}
                  placeholder="e.g. CI bot"
                  className="rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
                {tokens.error ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400">{tokens.error}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={tokens.creating}
                  className="rounded-md bg-brand-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
                >
                  {tokens.creating ? 'Creating…' : 'Create token'}
                </button>
                <p className="text-[11px] text-slate-400">Tokens last 6 months.</p>
              </div>
            )}
          </div>
        </PortalMenu>
      ) : null}
    </>
  );
}
