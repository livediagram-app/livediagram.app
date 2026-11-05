'use client';

// A World Clock opened large while walking (docs/specs/008-canvas/avatar-mode.md "The reader"): every zone, not only
// the three the face has room for, one row each with its name, its time large and the day against the viewer's.
import type { ClockZone } from '@livehuddle/document';
import { useMinuteNow } from '@/lib/minute-clock';
import { zoneTime } from '@/lib/zone-time';
import { ReaderShell } from './ReaderShell';

export function WorldClockReader({
  title,
  zones,
  onClose,
}: {
  title: string;
  zones: readonly ClockZone[];
  onClose: () => void;
}) {
  const now = useMinuteNow();
  return (
    <ReaderShell title={title} onClose={onClose} widthClassName="max-w-[480px]" data-clock-reader>
      <ul className="flex flex-col divide-y divide-slate-200 px-4 py-2 dark:divide-slate-700">
        {zones.map((z, i) => {
          const t = now ? zoneTime(z.zone || undefined, now) : null;
          return (
            <li key={`${z.zone}-${i}`} className="flex items-baseline gap-3 py-3">
              <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">
                {z.label || 'Local'}
              </span>
              {t && t.dayShift !== 0 ? (
                <span className="rounded-full bg-amber-100 px-2 py-[1px] text-[12px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {t.dayShift > 0 ? `+${t.dayShift}` : t.dayShift}{' '}
                  {Math.abs(t.dayShift) === 1 ? 'day' : 'days'}
                </span>
              ) : null}
              <span className="text-[28px] font-semibold tabular-nums leading-none">
                {now ? (t ? t.text : '?') : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </ReaderShell>
  );
}
