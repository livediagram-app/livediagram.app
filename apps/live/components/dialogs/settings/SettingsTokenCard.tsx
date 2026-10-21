'use client';

// One token (docs/specs/015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category):
// who it is, whether it is being used, and how much of its six months is
// left, drawn as a bar so the tokens that need rotating stand out from a
// glance down the list, then the workbenches it is paired with.
import type { ApiToken, WorkbenchPairing } from '@livediagram/api-schema';
import { Tooltip } from '@livediagram/ui';
import { KeyIcon, TrashIcon } from '@/components/primitives/explorer-icons';
import { SettingsTokenPairings } from './SettingsTokenPairings';
import {
  STATUS_LABEL,
  formatTokenDate,
  lifetimeElapsed,
  relativeTime,
  tokenStatus,
  usedRecently,
  type TokenStatus,
} from './token-status';

const TILE: Record<TokenStatus, string> = {
  active: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  expiring: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  expired: 'bg-slate-100 text-slate-400 dark:bg-slate-700/60 dark:text-slate-400',
};
const BAR: Record<TokenStatus, string> = {
  active: 'bg-emerald-500',
  expiring: 'bg-amber-500',
  expired: 'bg-slate-300 dark:bg-slate-600',
};
const TEXT: Record<TokenStatus, string> = {
  active: 'text-slate-500 dark:text-slate-400',
  expiring: 'font-semibold text-amber-700 dark:text-amber-400',
  expired: 'font-semibold text-rose-600 dark:text-rose-400',
};

export function SettingsTokenCard({
  token,
  now,
  onRevoke,
  pairings,
  onUnpair,
}: {
  token: ApiToken;
  now: number;
  onRevoke: (anchor: HTMLElement) => void;
  pairings: readonly WorkbenchPairing[];
  onUnpair: (pairingId: string) => void;
}) {
  const status = tokenStatus(token, now);
  const name = token.name || 'Untitled token';
  const elapsed = lifetimeElapsed(token, now);
  const live = usedRecently(token, now);
  const timeLeft =
    status === 'expired'
      ? `Expired ${formatTokenDate(token.expiresAt)}`
      : `Expires ${relativeTime(token.expiresAt, now)}`;

  return (
    <li className="group flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-600">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TILE[status]}`}
        >
          <KeyIcon />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Tooltip label={name}>
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {name}
              </p>
            </Tooltip>
            {token.readOnly ? (
              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                Read-only
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Created {formatTokenDate(token.createdAt)}</span>
            <span aria-hidden>·</span>
            {token.lastUsedAt ? (
              <span className="inline-flex items-center gap-1">
                {live ? (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20"
                  />
                ) : null}
                Used {relativeTime(token.lastUsedAt, now)}
              </span>
            ) : (
              <span>Never used</span>
            )}
          </p>
        </div>
        <Tooltip label="Revoke">
          <button
            type="button"
            onClick={(e) => onRevoke(e.currentTarget)}
            aria-label={`Revoke ${name}`}
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-brand-400 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <TrashIcon />
          </button>
        </Tooltip>
      </div>

      <div className="flex flex-col gap-1">
        <div
          role="progressbar"
          aria-label={`${name} lifetime used`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(elapsed * 100)}
          aria-valuetext={`${STATUS_LABEL[status]}. ${timeLeft}`}
          className="h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/70"
        >
          <div
            className={`h-full rounded-full ${BAR[status]}`}
            style={{ width: `${Math.max(elapsed * 100, 2)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className={TEXT[status]}>{STATUS_LABEL[status]}</span>
          <span className={TEXT[status]}>{timeLeft}</span>
        </div>
      </div>
      <SettingsTokenPairings pairings={pairings} now={now} onUnpair={onUnpair} />
    </li>
  );
}
