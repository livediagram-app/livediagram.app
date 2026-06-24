'use client';

// Explorer "API tokens" library section (spec/61). Signed-in only — the
// section is gated on `clerkEnabled` in the sidebar, and the routes reject a
// guest, so this pane assumes an account. Lists the user's tokens with create
// + revoke; a freshly minted token's secret is shown ONCE for copying.
import { useCallback, useEffect, useState } from 'react';
import type { ApiToken } from '@livediagram/api-schema';
import { apiCreateToken, apiListTokens, apiRevokeToken } from '@/lib/api-client';

const MAX_TOKENS = 10;
const MAX_NAME = 60;

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function TokensPane({ ownerId }: { ownerId: string }) {
  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiListTokens(ownerId)
      .then(setTokens)
      .catch(() => setError('Could not load tokens.'));
  }, [ownerId]);
  useEffect(() => {
    load();
  }, [load]);

  const atCap = (tokens?.length ?? 0) >= MAX_TOKENS;

  const create = async () => {
    if (creating || atCap) return;
    setCreating(true);
    setError(null);
    try {
      const res = await apiCreateToken(ownerId, name.trim());
      setSecret(res.token);
      setCopied(false);
      setName('');
      load();
    } catch {
      setError('Could not create token.');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    setError(null);
    try {
      await apiRevokeToken(ownerId, id);
      load();
    } catch {
      setError('Could not revoke token.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        API tokens let your own scripts call the livediagram API as you. Treat a token like a
        password: it has full read + write access to your diagrams. Each token lasts 6 months, then
        you create a new one.
      </p>

      {/* One-time secret reveal — never retrievable again. */}
      {secret ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-500/40 dark:bg-emerald-500/10">
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            Copy your new token now. For your security it won&apos;t be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 text-xs text-slate-700 ring-1 ring-emerald-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-emerald-500/30">
              {secret}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(secret);
                setCopied(true);
              }}
              className="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSecret(null)}
            className="mt-2 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300"
          >
            Done
          </button>
        </div>
      ) : null}

      {/* Create */}
      <div className="flex items-center gap-2">
        <input
          value={name}
          maxLength={MAX_NAME}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void create();
          }}
          placeholder="Token name (e.g. CI bot)"
          className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
        <button
          type="button"
          onClick={() => void create()}
          disabled={creating || atCap}
          className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          New token
        </button>
      </div>
      {atCap ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          You&apos;ve reached the limit of {MAX_TOKENS} tokens. Revoke one to create another.
        </p>
      ) : null}
      {error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}

      {/* List */}
      {tokens === null ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : tokens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            No API tokens yet.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Create one above to call the API from a script.
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
                onClick={() => void revoke(t.id)}
                className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
