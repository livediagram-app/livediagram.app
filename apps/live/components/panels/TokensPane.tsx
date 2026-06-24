'use client';

// Explorer "API tokens" list (spec/61). Signed-in only. Creation lives in the
// header's New-token popover (NewTokenButton); this pane is just the list of
// existing tokens with a per-row revoke that confirms in a popover first.
import { useState } from 'react';
import type { ApiToken } from '@livediagram/api-schema';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function TokensPane({
  tokens,
  error,
  onRevoke,
}: {
  tokens: ApiToken[] | null;
  error: string | null;
  onRevoke: (id: string) => void;
}) {
  const [confirm, setConfirm] = useState<{ id: string; anchor: HTMLElement } | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        API tokens let your own scripts call the livediagram API as you. Treat a token like a
        password: it has full read + write access to your diagrams. Each token lasts 6 months, then
        you create a new one with the New token button above.
      </p>

      {error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}

      {tokens === null ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : tokens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            No API tokens yet.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Use the New token button above to create one.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {tokens.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t.name || 'Untitled token'}
                </p>
                <p className="text-[11px] text-slate-400">
                  Created {fmtDate(t.createdAt)} · Expires {fmtDate(t.expiresAt)} ·{' '}
                  {t.lastUsedAt ? `Last used ${fmtDate(t.lastUsedAt)}` : 'Never used'}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => setConfirm({ id: t.id, anchor: e.currentTarget })}
                className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}

      {confirm ? (
        <ConfirmPopover
          anchor={confirm.anchor}
          message="Revoke this token? Any script using it stops working immediately."
          confirmLabel="Revoke"
          onConfirm={() => {
            onRevoke(confirm.id);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}
