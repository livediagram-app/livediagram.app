'use client';

import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { useTokens } from '@/hooks/persistence/useTokens';
import { SettingsRowShell } from './SettingsRowShell';
import type { SettingsTokensRowSpec } from './settings-catalogue';

// API tokens (spec/61) in the AI category: the same account feature the MCP
// server authenticates with, so a reader who has just switched the AI
// assistant on is one row away from the credential an external tool needs.
//
// Read-only here on purpose. Minting a token shows a one-time secret and
// revoking one breaks whatever is using it; both want the room and the
// confirmation the Explorer's page gives them, so this lists what exists and
// links out rather than growing a second, cramped management UI.
export function SettingsTokensRow({ row }: { row: SettingsTokensRowSpec }) {
  const { authLoaded, clerkUserId, isSignedIn } = useClerkApiBootstrap();
  const enabled = Boolean(isSignedIn && clerkUserId);
  const { list } = useTokens(clerkUserId ?? null, { enabled });

  return (
    <SettingsRowShell
      row={row}
      wrapper={() => (
        <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
              {row.label}
            </span>
            {enabled ? (
              <a
                href="/explorer/tokens"
                className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-600 dark:text-slate-200 dark:hover:border-brand-500/60"
              >
                Manage
              </a>
            ) : null}
          </div>
          {!authLoaded ? null : !enabled ? (
            // Tokens are Clerk-only (spec/61), so a guest gets the reason
            // rather than an empty list that looks like a loading failure.
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sign in to create API tokens.
            </p>
          ) : list === null ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">Loading…</p>
          ) : list.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No tokens yet.{' '}
              <a href="/explorer/tokens" className="font-medium text-blue-600 dark:text-blue-400">
                Create one
              </a>
              .
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700">
              {list.map((token) => (
                <li key={token.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="min-w-0 truncate text-xs text-slate-700 dark:text-slate-200">
                    {token.name ?? 'Untitled token'}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {token.readOnly ? (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                        Read-only
                      </span>
                    ) : null}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {token.lastUsedAt ? `Used ${shortDate(token.lastUsedAt)}` : 'Never used'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    />
  );
}

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
