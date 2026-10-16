'use client';

// A Key Date card (docs/specs/026-plan/plan-tabs.md "Cards"): a heading over the days to a date ("12 days to go",
// "Tomorrow", "Today"), red once it has passed ("3 days ago"), and the date itself. An Editor types the heading and
// picks the date in place; each lands as one step (the date when the field is left or Enter pressed, so typing a year
// is one step, not four; the count follows the date as it is typed). The count moves on with the shared clock.
import { calendarDayAfter, daysUntil, isCalendarDay } from '@livediagram/document';
import { keyDateCount } from '@livediagram/plan-art';
import { useRelativeNow } from '@/lib/relative-time';
import { useDashboard } from './dashboard-context';
import { CARD_BODY, CardHeading } from './card-parts';
import { useSlotDraft } from './useSlotDraft';

// What the count reads, and whether it has passed: shared with the card's picture in an image export.
export { keyDateCount };

const longDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export function DashboardKeyDateCard({
  slotId,
  keyDate,
}: {
  slotId: string;
  keyDate: { title: string; date: string };
}) {
  const { canEdit, actions } = useDashboard();
  const [date, setDate] = useSlotDraft(keyDate.date);
  const now = useRelativeNow();
  const today = now > 0 ? calendarDayAfter(new Date(now), 0) : '';
  const days = daysUntil(isCalendarDay(date) ? date : keyDate.date, today);
  const count = days === null ? null : keyDateCount(days);
  const save = (next: Partial<typeof keyDate>) =>
    actions.setSlotContent(slotId, { type: 'key-date', ...keyDate, ...next });
  // The date typed or picked, saved once: a whole day or cleared, and only when it changed.
  const commitDate = () => {
    if (date !== keyDate.date && (isCalendarDay(date) || date === '')) save({ date });
  };
  return (
    <div className={CARD_BODY}>
      <CardHeading
        value={keyDate.title}
        canEdit={canEdit}
        label="Key Date heading"
        onSave={(title) => save({ title })}
      />
      <div className="flex min-h-0 flex-1 items-center">
        {count ? (
          <p className="flex items-baseline gap-1.5">
            <span
              className={`text-[34px] font-semibold leading-none tracking-tight tabular-nums ${
                count.past ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-50'
              }`}
            >
              {count.figure}
            </span>
            {count.unit ? (
              <span className="text-[13px] text-slate-500 dark:text-slate-400">{count.unit}</span>
            ) : null}
          </p>
        ) : (
          <p className="text-[13px] text-slate-500 dark:text-slate-400">No date set.</p>
        )}
      </div>
      {canEdit ? (
        <input
          type="date"
          aria-label="Date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onBlur={commitDate}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitDate();
          }}
          className="w-fit cursor-pointer rounded-md border border-slate-200 bg-transparent px-2 py-0.5 text-[12px] text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:text-slate-300 dark:[color-scheme:dark]"
        />
      ) : keyDate.date ? (
        <span className="text-[12px] text-slate-500 dark:text-slate-400">
          {longDate(keyDate.date)}
        </span>
      ) : null}
    </div>
  );
}
