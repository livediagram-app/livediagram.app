'use client';

// Explorer "API tokens" list (spec/61). Signed-in only. Creation lives in the
// header's New-token popover (NewTokenButton); this pane is just the list of
// existing tokens with a per-row revoke that confirms in a popover first.
import { useState } from 'react';
import type { ApiToken } from '@livediagram/api-schema';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';

const DAY = 86_400_000;
const EXPIRES_SOON = 14 * DAY;

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Compact relative time: "2 days ago" (past) / "in 5 months" (future).
function relative(ms: number): string {
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [365 * DAY, 'year'],
    [30 * DAY, 'month'],
    [7 * DAY, 'week'],
    [DAY, 'day'],
    [3_600_000, 'hour'],
    [60_000, 'minute'],
  ];
  for (const [size, name] of units) {
    if (abs >= size) {
      const n = Math.round(abs / size);
      const label = `${n} ${name}${n !== 1 ? 's' : ''}`;
      return diff < 0 ? `${label} ago` : `in ${label}`;
    }
  }
  return diff < 0 ? 'just now' : 'in a moment';
}

type Status = { label: string; className: string };
function tokenStatus(t: ApiToken): Status {
  const left = t.expiresAt - Date.now();
  if (left <= 0)
    return {
      label: 'Expired',
      className: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
    };
  if (left < EXPIRES_SOON)
    return {
      label: 'Expires soon',
      className: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    };
  return {
    label: 'Active',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  };
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
        API tokens let your own scripts or AI agents call the livediagram API as you. Treat a token
        like a password: it has full read + write access to your diagrams. Each token lasts 6
        months, then you create a new one with the New token button above.
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
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tokens.map((t) => {
            const status = tokenStatus(t);
            const expired = t.expiresAt - Date.now() <= 0;
            const meta = [
              `Created ${fmtDate(t.createdAt)}`,
              t.lastUsedAt ? `last used ${relative(t.lastUsedAt)}` : 'never used',
              ...(expired ? [] : [`expires ${relative(t.expiresAt)}`]),
            ];
            return (
              <li
                key={t.id}
                className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-600"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                    <KeyIcon />
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {t.name || 'Untitled token'}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                  {meta.join(' · ')}
                </p>
                <button
                  type="button"
                  onClick={(e) => setConfirm({ id: t.id, anchor: e.currentTarget })}
                  className="mt-auto self-end rounded-md border border-transparent px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                >
                  Revoke
                </button>
              </li>
            );
          })}
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

function KeyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="5.5" cy="5.5" r="3" />
      <path d="M7.6 7.6 L13 13 M11 11l1.5-1.5M10 13l1.5-1.5" />
    </svg>
  );
}
