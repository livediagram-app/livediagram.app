'use client';

import { useRef, useState, type ReactNode } from 'react';
import { BUTTON, Panel } from './account-ui';

// A secret shown once, with Copy and Done: a new API token (TokensPanel), a new webhook's signing secret
// (webhooks/WebhooksPanel). The browser can refuse the clipboard (no permission, an insecure page): it says so, and
// selects the secret so it can be copied by hand.
export function SecretReveal({
  title,
  secret,
  onDone,
  children,
}: {
  // What the green card says first, as a status the screen reader hears.
  title: string;
  secret: string;
  onDone: () => void;
  // A line under the secret (how to use it).
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  const secretRef = useRef<HTMLElement>(null);

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(secret);
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
        {title}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <code
          ref={secretRef}
          className="block min-w-0 flex-1 overflow-x-auto rounded-xl bg-white px-3 py-2 font-mono text-sm text-slate-900 ring-1 ring-emerald-200 dark:bg-slate-950 dark:text-white dark:ring-emerald-500/30"
        >
          {secret}
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
      {children}
      {copied === 'failed' && (
        <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">
          This browser didn’t let us copy it. It’s selected: copy it with your keyboard or menu.
        </p>
      )}
    </Panel>
  );
}
