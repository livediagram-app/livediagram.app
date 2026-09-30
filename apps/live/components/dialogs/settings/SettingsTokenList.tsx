'use client';

// The token manager's list (docs/specs/015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category).
// Signed-in only. Creation is the form above it (SettingsTokenCreate); this is
// the list of existing tokens with a per-row revoke that confirms in a popover
// first. One column, because it sits in the Settings pane, not a full page.
import { useState } from 'react';
import type { ApiToken } from '@livediagram/api-schema';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { Tooltip, Glyph } from '@livediagram/ui';
import { TOKEN_REVOKE_MESSAGE } from './token-copy';
import { useRelativeNow } from '@/lib/relative-time';

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

export function SettingsTokenList({
  tokens,
  onRevoke,
}: {
  tokens: ApiToken[] | null;
  onRevoke: (id: string) => void;
}) {
  const now = useRelativeNow();
  const [confirm, setConfirm] = useState<{ id: string; anchor: HTMLElement } | null>(null);

  return (
    <>
      {tokens === null ? (
        <p className="text-xs text-slate-400 dark:text-slate-400">Loading…</p>
      ) : tokens.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          No API tokens yet. Create one above to call the livediagram API from your own scripts or
          AI tools.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {tokens.map((t) => {
            const status = tokenStatus(t);
            const expired = t.expiresAt - now <= 0;
            const rows: [string, string][] = [
              ['Created', fmtDate(t.createdAt)],
              ['Last used', t.lastUsedAt ? relative(t.lastUsedAt) : 'Never'],
              [
                expired ? 'Expired' : 'Expires',
                expired ? fmtDate(t.expiresAt) : relative(t.expiresAt),
              ],
            ];
            return (
              <li
                key={t.id}
                className="flex flex-col rounded-lg border border-slate-200 p-3 dark:border-slate-700"
              >
                <div className="flex items-start gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                    <KeyIcon />
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* The name truncates; the Tooltip gives it whole. */}
                    <Tooltip label={t.name || 'Untitled token'}>
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {t.name || 'Untitled token'}
                      </p>
                    </Tooltip>
                    <span className="mt-1 inline-flex flex-wrap items-center gap-1">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                      {t.readOnly ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          Read-only
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>
                <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs dark:border-slate-700/60">
                  {rows.map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-2">
                      <dt className="text-slate-400">{label}</dt>
                      <dd className="truncate font-medium text-slate-600 dark:text-slate-300">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <button
                  type="button"
                  onClick={(e) => setConfirm({ id: t.id, anchor: e.currentTarget })}
                  aria-label={`Revoke ${t.name || 'Untitled token'}`}
                  className="mt-2 self-end rounded-md px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
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
          message={TOKEN_REVOKE_MESSAGE}
          confirmLabel="Revoke"
          onConfirm={() => {
            onRevoke(confirm.id);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </>
  );
}

function KeyIcon() {
  return (
    <Glyph size={16} units={16}>
      <circle cx="5.5" cy="5.5" r="3" />
      <path d="M7.6 7.6 L13 13 M11 11l1.5-1.5M10 13l1.5-1.5" />
    </Glyph>
  );
}
