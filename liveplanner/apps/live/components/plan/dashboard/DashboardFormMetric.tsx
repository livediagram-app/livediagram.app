'use client';

// A figure from a form in a Dashboard slot (docs/specs/026-plan/plan-tabs.md "Form Metrics"): its responses, the new
// ones, whether it takes responses, its responses against its limit, when it closes, or its link with Copy, read live
// from the form's link as the board's Form strip reads it (never marking anything seen). The form is the project's
// first as it is placed; an Editor changes it from the card's form name when the project has more than one, and a
// slot whose form was deleted offers Clear Slot. Anyone may read it.
import { useEffect, useState } from 'react';
import { readForm } from '@liveplanner/forms';
import type { FormMetricContent } from '@liveplanner/project';
import { Select, lucideGlyph } from '@liveplanner/ui';
import { lucideClipboardList } from '@liveplanner/icons/lucide';
import { useFormBoard } from '@/components/forms/form-board-context';
import { useFormLink } from '@/hooks/forms/useFormLink';
import { formUrlFor } from '@/lib/form-path';
import { FORM_METRIC_NAMES } from '@/components/palette/palette-dashboard-tiles';
import { useDashboard } from './dashboard-context';
import { Missing } from './DashboardSlotContent';
import { formMetricShown, type FormMetricTone } from './form-metric-shown';

const FormGlyph = lucideGlyph(lucideClipboardList, 15);
const MUTED = 'text-slate-500 dark:text-slate-400';
const TONES: Record<FormMetricTone, string> = {
  green: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  amber: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  red: 'bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-200',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
};
// How often a shown figure is read again, as the Form tab's status bar does.
const NOW_TICK_MS = 60_000;

export function DashboardFormMetric({
  slotId,
  content,
}: {
  slotId: string;
  content: FormMetricContent;
}) {
  const { tabs, canEdit, actions } = useDashboard();
  const forms = tabs.filter((t) => t.kind === 'form');
  const tab = forms.find((t) => t.id === content.formTabId);
  if (!tab) {
    if (forms.length === 0 || content.formTabId)
      return <Missing message="This form was deleted." slotId={slotId} />;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
          {FORM_METRIC_NAMES[content.metric]}
        </span>
        {canEdit ? (
          <FormChoice
            forms={forms}
            value=""
            onChange={(formTabId) => actions.setSlotContent(slotId, { ...content, formTabId })}
          />
        ) : (
          <span className={`text-[12px] ${MUTED}`}>Waiting for its form.</span>
        )}
      </div>
    );
  }
  return <FormMetricBody slotId={slotId} content={content} tabId={tab.id} forms={forms} />;
}

function FormChoice({
  forms,
  value,
  onChange,
}: {
  forms: readonly { id: string; name: string }[];
  value: string;
  onChange: (formTabId: string) => void;
}) {
  return (
    <Select
      size="sm"
      aria-label="Form"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      selectClassName="text-[12px]"
    >
      {value ? null : (
        <option value="" disabled>
          Choose a form…
        </option>
      )}
      {forms.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </Select>
  );
}

function FormMetricBody({
  slotId,
  content,
  tabId,
  forms,
}: {
  slotId: string;
  content: FormMetricContent;
  tabId: string;
  forms: readonly { id: string; name: string; form?: unknown }[];
}) {
  const { canEdit, actions } = useDashboard();
  const api = useFormBoard();
  const link = useFormLink({
    projectId: api?.projectId ?? null,
    tabId,
    ownerId: api?.ownerId ?? '',
    share: api?.share ?? null,
    enabled: !!api?.online,
    markSeen: false,
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => window.clearInterval(t);
  }, []);
  const [copied, setCopied] = useState(false);
  const entry = forms.find((f) => f.id === tabId)!;
  const form = readForm(entry.form) ?? { heading: entry.name };
  const shown = formMetricShown(content.metric, {
    form,
    link: link.link,
    offline: link.status === 'offline',
    now,
  });
  const name = FORM_METRIC_NAMES[content.metric];
  const live = link.link?.link ?? null;
  const url = live?.code ? formUrlFor(window.location.origin, live.code) : null;
  const loading = link.status === 'loading' && !link.link;
  return (
    <div
      role="group"
      aria-label={`${name}: ${shown.hero ?? shown.line}`}
      className="relative flex h-full flex-col gap-2 overflow-hidden p-4"
    >
      <div className="flex min-w-0 items-center gap-2 pr-10">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
        >
          <FormGlyph />
        </span>
        <span
          className={`min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider ${MUTED}`}
        >
          {name}
        </span>
      </div>
      {loading ? (
        <p aria-live="polite" className={`text-[13px] ${MUTED}`}>
          Loading {entry.name}…
        </p>
      ) : content.metric === 'link' ? (
        url ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate rounded-md bg-slate-50 px-2 py-1.5 font-mono text-[12px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {url.replace(/^https?:\/\//, '')}
            </span>
            {api?.canShare ? (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(url).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1800);
                  });
                }}
                className="shrink-0 cursor-pointer rounded-md bg-brand-700 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            ) : null}
          </div>
        ) : (
          <span className={`text-[13px] ${MUTED}`}>Not published yet.</span>
        )
      ) : shown.tone ? (
        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[15px] font-semibold ${TONES[shown.tone]}`}
        >
          {shown.hero}
        </span>
      ) : (
        <span className="text-[32px] font-semibold leading-none tracking-tight tabular-nums text-slate-900 dark:text-slate-50">
          {shown.hero}
        </span>
      )}
      {shown.share !== undefined ? (
        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full ${shown.share >= 1 ? 'bg-amber-500' : 'bg-brand-500'}`}
            style={{ width: `${shown.share * 100}%` }}
          />
        </div>
      ) : null}
      <div className="mt-auto flex min-w-0 items-center gap-2">
        <span className={`min-w-0 flex-1 truncate text-[11px] ${MUTED}`}>{shown.line}</span>
        {/* The form it reads: an Editor changes it while the project has more than one. */}
        {canEdit && forms.length > 1 ? (
          <FormChoice
            forms={forms}
            value={tabId}
            onChange={(formTabId) => actions.setSlotContent(slotId, { ...content, formTabId })}
          />
        ) : (
          <span className={`shrink-0 truncate text-[11px] font-medium ${MUTED}`}>{entry.name}</span>
        )}
      </div>
    </div>
  );
}
