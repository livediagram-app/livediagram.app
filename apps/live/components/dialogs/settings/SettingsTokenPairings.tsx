'use client';

// A token's paired workbenches (docs/specs/013-workspace/workbench-embeds.md "Pairing"; blueprint "Settings > API
// tokens", WB35, WB36): under the card's lifetime bar, one row per workbench the token may open documents in,
// each with Unpair, which asks first in the same popover Revoke uses. None renders nothing.
import { useId, useState } from 'react';
import type { WorkbenchPairing } from '@livediagram/api-schema';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { relativeTime } from './token-status';

const UNNAMED = 'Unnamed workbench';

export function SettingsTokenPairings({
  pairings,
  now,
  onUnpair,
}: {
  pairings: readonly WorkbenchPairing[];
  now: number;
  onUnpair: (pairingId: string) => void;
}) {
  const labelId = useId();
  const [confirm, setConfirm] = useState<{ pairing: WorkbenchPairing; anchor: HTMLElement } | null>(
    null,
  );

  if (pairings.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-700/70">
      <p
        id={labelId}
        className="text-[10px] font-semibold text-slate-500 uppercase dark:text-slate-400"
      >
        Paired workbenches
      </p>
      <ul aria-labelledby={labelId} className="flex flex-col gap-1.5">
        {pairings.map((pairing) => {
          const name = pairing.name ?? UNNAMED;
          return (
            <li key={pairing.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                  {name}
                </p>
                <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <code className="font-mono break-all text-slate-600 dark:text-slate-300">
                    {pairing.origin}
                  </code>
                  <span aria-hidden>·</span>
                  <span>Paired {relativeTime(pairing.pairedAt, now)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => setConfirm({ pairing, anchor: e.currentTarget })}
                aria-label={`Unpair ${name} at ${pairing.origin}`}
                className="min-h-6 shrink-0 rounded-md px-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-rose-400 dark:text-slate-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
              >
                Unpair
              </button>
            </li>
          );
        })}
      </ul>
      {confirm ? (
        <ConfirmPopover
          anchor={confirm.anchor}
          message={`Unpair ${confirm.pairing.name ?? UNNAMED}? Its open diagrams stop editing until you allow it again.`}
          confirmLabel="Unpair"
          onConfirm={() => {
            onUnpair(confirm.pairing.id);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}
