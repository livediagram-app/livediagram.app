'use client';

// The token manager's overview (docs/specs/015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category):
// how many of the ten slots are taken, and the way to make another. The row's own header (SettingsRowShell, with the
// key tile) says what tokens are for, so this repeats neither the title nor the line. The meter is one pip per slot so "how close am I to the cap"
// reads at a glance instead of from a sentence.
import { Button } from '@livepages/ui';
import { PlusIcon } from '@/components/primitives/explorer-icons';

// Brand while there is room, amber from here, rose at the cap.
const METER_WARN_AT = 8;

export function SettingsTokenOverview({
  count,
  max,
  composing,
  onNew,
}: {
  // Null while the list loads: the meter waits rather than flashing "0".
  count: number | null;
  max: number;
  composing: boolean;
  onNew: () => void;
}) {
  // No tokens yet: the composer below is the one thing to do, so there is no second way to it and no meter reading
  // "0 of 10".
  const firstRun = count === 0;
  const atCap = count !== null && count >= max;
  const fill = atCap
    ? 'bg-rose-500'
    : count !== null && count >= METER_WARN_AT
      ? 'bg-amber-500'
      : 'bg-brand-500 dark:bg-brand-400';

  return (
    <div className="flex flex-col gap-3">
      {count === null || firstRun ? null : (
        <div className="flex items-center gap-3">
          <div
            role="meter"
            aria-label="Token slots used"
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={count}
            aria-valuetext={`${count} of ${max}`}
            className="flex flex-1 gap-1"
          >
            {Array.from({ length: max }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < count ? fill : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{count}</span> of{' '}
            {max}
          </span>
          {composing ? null : (
            // Visibly just "New" beside the meter; the accessible name says what it makes, still starting with the
            // visible word.
            <Button
              size="xs"
              onClick={onNew}
              disabled={atCap}
              aria-label="New token"
              className="shrink-0"
            >
              <PlusIcon />
              New
            </Button>
          )}
        </div>
      )}
      {atCap ? (
        <p className="text-[11px] text-rose-600 dark:text-rose-400">
          Every slot is taken. Revoke a token to make room for a new one.
        </p>
      ) : null}
    </div>
  );
}
