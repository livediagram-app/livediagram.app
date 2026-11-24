'use client';

// Changes to the plan (docs/specs/013-workspace/make-plan-cards.md "Changes to the plan"): on a tab View As Diagram drew,
// the drawing's structural edits offered to the plan in a pill at the top centre, "2 changes to the plan", opening a
// list with Apply, Dismiss and Apply All. Nothing reaches the plan until the person applies it, as themselves, with
// Edit on the plan. The host (PlanCardsHost) publishes the offers here, so the canvas chrome needs no new props.
import { useState, useSyncExternalStore } from 'react';
import { IndexError, type PlanEditResult } from '@liveworkspace/index-client';
import { Button } from '@liveworkspace/ui';
import {
  TopCenterBanner,
  TopCenterRow,
} from '@liveworkspace/workbench/components/chrome/TopCenter';
import { useToast } from '@liveworkspace/workbench/hooks/ui/useToast';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { track } from '@/lib/telemetry';
import type { PlanChangeOffer } from '@/lib/plan-cards/plan-changes';

type Shown = { planId: string; offers: PlanChangeOffer[]; onDismiss: (key: string) => void } | null;

let shown: Shown = null;
const listeners = new Set<() => void>();

/** The host's word on what to offer now; null hides the pill. */
export function setPlanChanges(next: Shown): void {
  shown = next;
  for (const l of [...listeners]) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const read = () => shown;

type Client = Pick<typeof indexClient, 'applyPlanEdits'>;

function refusalOf(err: unknown): string {
  if (err instanceof IndexError && (err.status === 403 || err.status === 404))
    return 'You can view this plan but not change it.';
  if (err instanceof IndexError && err.code === 'rate_limited')
    return 'That is a lot of changes at once. Try again in a minute.';
  return "The plan couldn't be reached just now. Try again.";
}

export function PlanChangesPill({ client = indexClient }: { client?: Client }) {
  const now = useSyncExternalStore(subscribe, read, () => null);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [refused, setRefused] = useState<Record<string, string>>({});
  if (!now || now.offers.length === 0) return null;
  const { planId, offers, onDismiss } = now;

  const apply = async (list: PlanChangeOffer[], key: string) => {
    setBusy(key);
    try {
      const { results } = await client.applyPlanEdits(
        planId,
        list.map((o) => o.edit),
      );
      const next: Record<string, string> = {};
      let applied = 0;
      results.forEach((r: PlanEditResult, i) => {
        const offer = list[i];
        if (!offer) return;
        if (r.status === 'applied') {
          applied += 1;
          onDismiss(offer.key);
        } else next[offer.key] = r.reason;
      });
      setRefused((was) => ({ ...was, ...next }));
      if (applied) {
        track('UI', 'Created', 'PlanChange');
        toast.success(applied === 1 ? 'Changed the plan' : `Made ${applied} changes to the plan`);
      }
      if (Object.keys(next).length) track('UI', 'Refused', 'PlanChange');
    } catch (err) {
      track('UI', 'Refused', 'PlanChange');
      const why = refusalOf(err);
      setRefused((was) => ({ ...was, ...Object.fromEntries(list.map((o) => [o.key, why])) }));
    } finally {
      setBusy(null);
    }
  };

  const count = offers.length;
  const title = count === 1 ? '1 change to the plan' : `${count} changes to the plan`;
  return (
    <TopCenterRow>
      <TopCenterBanner
        tone="brand"
        shape="card"
        className={`flex-col items-stretch gap-0 ${open ? 'w-[min(26rem,calc(100vw-1.5rem))]' : ''}`}
      >
        <div
          className="flex items-center gap-2 py-1 pr-1 pl-3 text-xs font-medium"
          data-plan-changes=""
        >
          <span className="min-w-0 flex-1 truncate">{title}</span>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => {
              if (!open) track('UI', 'Opened', 'PlanChange');
              setOpen(!open);
            }}
            className="min-h-8 cursor-pointer rounded-full bg-white/70 px-3 text-[11px] font-semibold text-brand-800 transition hover:bg-white dark:bg-white/10 dark:text-brand-100 dark:hover:bg-white/20"
          >
            {open ? 'Hide' : 'Review'}
          </button>
        </div>
        {open ? (
          <div className="flex flex-col gap-2 border-t border-brand-200/70 px-3 pt-2 pb-3 dark:border-brand-500/30">
            <p className="text-[11px] text-brand-900/70 dark:text-brand-100/70">
              Your edits to this drawing, offered to the plan. Nothing changes there until you
              apply.
            </p>
            <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {offers.map((o) => (
                <li
                  key={o.key}
                  className="flex flex-col gap-1 rounded-lg bg-white/80 px-2.5 py-2 dark:bg-slate-900/60"
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-xs text-slate-800 dark:text-slate-100">
                      {o.words}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => {
                        onDismiss(o.key);
                        track('UI', 'Closed', 'PlanChange');
                      }}
                    >
                      Dismiss
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => void apply([o], o.key)}
                    >
                      {busy === o.key ? 'Applying…' : 'Apply'}
                    </Button>
                  </div>
                  {refused[o.key] ? (
                    <p role="alert" className="text-[11px] text-rose-700 dark:text-rose-300">
                      {refused[o.key]}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            {count > 1 ? (
              <Button
                type="button"
                size="sm"
                className="self-end"
                disabled={busy !== null}
                onClick={() => void apply(offers, '*')}
              >
                {busy === '*' ? 'Applying…' : 'Apply All'}
              </Button>
            ) : null}
          </div>
        ) : null}
      </TopCenterBanner>
    </TopCenterRow>
  );
}
