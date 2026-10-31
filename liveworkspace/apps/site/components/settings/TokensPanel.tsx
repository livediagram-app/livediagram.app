'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { accountApi, errorMessage, formatDate, type ApiToken } from '@/lib/account-api';
import { BUTTON, ErrorNote, INPUT, Panel } from './account-ui';
import { useAccountData } from './useAccountData';

// The Settings panel's API Tokens (liveworkspace/docs/specs/010-site/site.md "Settings"): making a token, seeing it once,
// and revoking it. A token is the account's, so it works on every app's API and MCP server; the AI
// tools connected in an app show up here too.
export function TokensPanel() {
  const [load, refresh] = useAccountData<{ tokens: ApiToken[] }>('/tokens');
  const [made, setMade] = useState<(ApiToken & { secret: string }) | null>(null);
  // Where the keyboard goes when what held it goes: the name field after Done, the list's heading after a revoke.
  const nameRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  return (
    <div className="space-y-6">
      <CreateToken
        nameRef={nameRef}
        onCreated={async (token) => {
          setMade(token);
          await refresh();
        }}
      />
      {made && (
        <Reveal
          token={made}
          onDone={() => {
            setMade(null);
            nameRef.current?.focus();
          }}
        />
      )}

      <section aria-labelledby="your-tokens">
        <h2
          id="your-tokens"
          ref={headingRef}
          tabIndex={-1}
          className="text-base font-semibold text-slate-900 outline-none dark:text-white"
        >
          Your tokens
        </h2>
        {load.state === 'loading' && (
          <div
            aria-busy
            className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70"
          />
        )}
        {load.state === 'error' && <ErrorNote>{errorMessage(load.error)}</ErrorNote>}
        {load.state === 'ready' &&
          (load.data.tokens.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-300 px-6 py-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">
              No tokens yet. Make one above, or connect an AI tool from any app.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {load.data.tokens.map((token) => (
                <TokenRow
                  key={token.id}
                  token={token}
                  onRevoked={async () => {
                    await refresh();
                    headingRef.current?.focus();
                  }}
                />
              ))}
            </ul>
          ))}
      </section>
    </div>
  );
}

function CreateToken({
  nameRef,
  onCreated,
}: {
  nameRef: RefObject<HTMLInputElement | null>;
  onCreated: (token: ApiToken & { secret: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await accountApi<ApiToken & { secret: string }>('/tokens', 'POST', {
      name,
      readOnly,
    });
    if (result.ok) {
      setName('');
      setReadOnly(false);
      await onCreated(result.data);
    } else setError(result.error);
    setBusy(false);
  }

  return (
    <Panel>
      <form onSubmit={(event) => void submit(event)}>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Make a token</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          For your own scripts and tools. It acts as you in every app, for six months.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            ref={nameRef}
            aria-label="Token name"
            className={INPUT}
            placeholder="What it’s for, like “Weekly report script”"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className={`${BUTTON.primary} shrink-0`} disabled={busy}>
            Make token
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={readOnly}
            onChange={(event) => setReadOnly(event.target.checked)}
            className="size-4 rounded border-slate-300"
          />
          Read only: it can look, but never change anything
        </label>
        {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
      </form>
    </Panel>
  );
}

function Reveal({ token, onDone }: { token: ApiToken & { secret: string }; onDone: () => void }) {
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  const secretRef = useRef<HTMLElement>(null);

  // The browser can refuse the clipboard (no permission, an insecure page): say so, and select the token so it can
  // be copied by hand.
  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(token.secret);
      setCopied('yes');
    } catch {
      setCopied('failed');
      const code = secretRef.current;
      if (code) window.getSelection()?.selectAllChildren(code);
    }
  }

  return (
    <Panel className="border-emerald-300 bg-emerald-50/70 dark:border-emerald-500/40 dark:bg-emerald-500/5">
      <p role="status" className="font-semibold text-slate-900 dark:text-white">
        Here’s {token.name}. Copy it now: it won’t be shown again.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <code
          ref={secretRef}
          className="block min-w-0 flex-1 overflow-x-auto rounded-xl bg-white px-3 py-2 font-mono text-sm text-slate-900 ring-1 ring-emerald-200 dark:bg-slate-950 dark:text-white dark:ring-emerald-500/30"
        >
          {token.secret}
        </code>
        <button
          type="button"
          className={`${BUTTON.secondary} shrink-0`}
          onClick={() => void copy()}
        >
          {copied === 'yes' ? 'Copied' : 'Copy'}
        </button>
        <button type="button" className={`${BUTTON.primary} shrink-0`} onClick={onDone}>
          Done
        </button>
      </div>
      {copied === 'failed' && (
        <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">
          This browser didn’t let us copy it. It’s selected: copy it with your keyboard or menu.
        </p>
      )}
    </Panel>
  );
}

function TokenRow({ token, onRevoked }: { token: ApiToken; onRevoked: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revokeRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  // The button pressed is swapped for the next step's, so the keyboard follows it: to Keep (the safe answer) when
  // asked, back to Revoke when kept. Not on the first render, where nothing here had focus.
  const asked = useRef(false);
  useEffect(() => {
    if (!asked.current) return;
    (confirming ? keepRef : revokeRef).current?.focus();
  }, [confirming]);
  const ask = (next: boolean) => {
    asked.current = true;
    setConfirming(next);
  };

  async function revoke() {
    const result = await accountApi(`/tokens/${token.id}`, 'DELETE');
    if (result.ok) await onRevoked();
    else setError(result.error);
  }

  return (
    <li>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900 dark:text-white">
              {token.name}
              {token.readOnly && (
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Read only
                </span>
              )}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Made {formatDate(token.createdAt)} ·{' '}
              {token.lastUsedAt ? `Last used ${formatDate(token.lastUsedAt)}` : 'Not used yet'} ·
              Expires {formatDate(token.expiresAt)}
            </p>
          </div>
          {confirming ? (
            <span className="flex gap-1">
              <button type="button" className={BUTTON.danger} onClick={() => void revoke()}>
                Revoke now
              </button>
              <button
                ref={keepRef}
                type="button"
                className={BUTTON.secondary}
                onClick={() => ask(false)}
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              ref={revokeRef}
              type="button"
              className={BUTTON.danger}
              onClick={() => ask(true)}
            >
              Revoke
            </button>
          )}
        </div>
        {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
      </Panel>
    </li>
  );
}
