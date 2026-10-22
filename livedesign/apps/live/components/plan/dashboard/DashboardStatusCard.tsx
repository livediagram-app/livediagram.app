'use client';

// A Status card (docs/specs/026-plan/plan-tabs.md "Cards"): On Track, At Risk or Off Track in its colour, a line of why,
// and when either last changed. An Editor picks the state from three buttons and types the line in place; each change
// is one step and stamps the time. Anyone else reads it.
import {
  DASHBOARD_CARD_TEXT_MAX,
  DASHBOARD_STATUSES,
  type DashboardCardStyle,
  type DashboardStatus,
} from '@livedesign/document';
import { relativeSince, useRelativeNow } from '@/lib/relative-time';
import { useDashboard } from './dashboard-context';
import { useSlotDraft } from './useSlotDraft';
import { CARD_BODY } from './card-parts';

const STATUS_INFO: Record<
  DashboardStatus,
  { label: string; dot: string; text: string; tint: string }
> = {
  'on-track': {
    label: 'On Track',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    tint: 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-500/15 dark:ring-emerald-500/30',
  },
  'at-risk': {
    label: 'At Risk',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    tint: 'bg-amber-50 ring-amber-200 dark:bg-amber-500/15 dark:ring-amber-500/30',
  },
  'off-track': {
    label: 'Off Track',
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-300',
    tint: 'bg-red-50 ring-red-200 dark:bg-red-500/15 dark:ring-red-500/30',
  },
};

export function DashboardStatusCard({
  slotId,
  status,
}: {
  slotId: string;
  // Its style rides along with each change (plan-tabs.md "Card style").
  status: { state: DashboardStatus; text: string; at: number; style?: DashboardCardStyle };
}) {
  const { canEdit, actions } = useDashboard();
  const now = useRelativeNow();
  const [text, setText] = useSlotDraft(status.text);
  const info = STATUS_INFO[status.state];
  const save = (next: { state?: DashboardStatus; text?: string }) =>
    actions.setSlotContent(slotId, {
      ...status,
      type: 'status',
      state: next.state ?? status.state,
      text: next.text ?? status.text,
      at: Date.now(),
    });
  return (
    <div className={CARD_BODY}>
      <div className="flex items-center gap-2 pr-8">
        <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${info.dot}`} />
        <span className={`text-[18px] font-semibold leading-tight ${info.text}`}>{info.label}</span>
      </div>
      {canEdit ? (
        <textarea
          aria-label="Why"
          value={text}
          maxLength={DASHBOARD_CARD_TEXT_MAX}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text !== status.text) save({ text });
          }}
          placeholder="Say why in a line or two…"
          className="min-h-0 w-full flex-1 resize-none bg-transparent text-[13px] leading-relaxed text-slate-600 outline-none placeholder:text-slate-400 dark:text-slate-300"
        />
      ) : (
        <p className="min-h-0 flex-1 overflow-hidden whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
          {status.text}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {canEdit ? (
          <div role="radiogroup" aria-label="Status" className="flex gap-1">
            {DASHBOARD_STATUSES.map((s) => {
              const on = s === status.state;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    if (!on) save({ state: s });
                  }}
                  className={`flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 transition duration-micro motion-reduce:transition-none ${
                    on
                      ? `${STATUS_INFO[s].tint} ${STATUS_INFO[s].text}`
                      : 'text-slate-500 ring-slate-200 hover:bg-slate-50 dark:text-slate-400 dark:ring-slate-700 dark:hover:bg-slate-800'
                  }`}
                >
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${STATUS_INFO[s].dot}`} />
                  {STATUS_INFO[s].label}
                </button>
              );
            })}
          </div>
        ) : (
          <span />
        )}
        {status.at > 0 && now > 0 ? (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Updated {relativeSince(status.at, now)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
