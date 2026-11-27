'use client';

// Bug Triage's triage strip above the action bar (docs/specs/026-plan/session-tabs.md "Bug Triage", "Running it"):
// Priority's levels as chips in their colours and None, then a row for each severity-style Choice field of the type
// (Severity, Impact), its options and None, the card's own values pressed. A press writes the field at once, as the
// field does on the card, for whoever may edit cards (an Editor or a Participant, facilitating or not); a Viewer reads
// the values. A type with neither shows nothing. Also a queue row's priority pill.
import {
  PRIORITIES,
  PRIORITY_LABELS,
  builtInFieldLabel,
  isPriority,
  severityFieldsOf,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { PRIORITY_COLOURS } from '@liveplanner/project';

const chip =
  'inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';
const off =
  'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';
const on =
  'border-brand-600 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-950/50 dark:text-brand-200';
const HEADING =
  'text-[12px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

type Row = {
  field: string;
  label: string;
  options: { value: string; label: string; colour?: string }[];
  current: string | null;
};

// The strip's rows for a card of `type`: Priority when the type has it, then its severity-style fields.
export function triageRows(item: Item, type: ItemTypeDef): Row[] {
  const rows: Row[] = [];
  if (type.fields.includes('priority')) {
    const p = item.fields['priority'];
    rows.push({
      field: 'priority',
      label: builtInFieldLabel('priority', [type], 'Priority'),
      options: PRIORITIES.map((v) => ({
        value: v,
        label: PRIORITY_LABELS[v],
        colour: PRIORITY_COLOURS[v],
      })),
      current: isPriority(p) ? p : null,
    });
  }
  for (const f of severityFieldsOf(type)) {
    const v = item.fields[f.id];
    rows.push({
      field: f.id,
      label: f.label,
      options: (f.options ?? []).map((o) => ({ value: o, label: o })),
      current: typeof v === 'string' && v ? v : null,
    });
  }
  return rows;
}

export function TriageStrip({
  item,
  type,
  canEdit,
  onSet,
}: {
  item: Item;
  type: ItemTypeDef;
  // May write the card's fields (an Editor or a Participant on an unlocked tab).
  canEdit: boolean;
  // A field written (a value) or cleared (null).
  onSet: (field: string, value: string | null) => void;
}) {
  const rows = triageRows(item, type);
  if (!rows.length) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t max-sm:flex-col max-sm:items-stretch max-sm:gap-y-1.5 border-slate-200 bg-slate-50/70 px-4 py-2.5 sm:px-6 xl:pr-[20rem] dark:border-slate-800 dark:bg-slate-900/60"
      data-triage-strip=""
    >
      {rows.map((row) =>
        canEdit ? (
          <div
            key={row.field}
            role="group"
            aria-label={row.label}
            // A phone keeps each row on one line, scrolled sideways, so the strip never crowds out the card.
            className="scrollbar-slim flex flex-wrap items-center gap-1.5 max-sm:flex-nowrap max-sm:overflow-x-auto"
          >
            <span className={`${HEADING} mr-1 shrink-0`}>{row.label}</span>
            {row.options.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={row.current === o.value}
                onClick={() => onSet(row.field, o.value)}
                className={`${chip} shrink-0 ${row.current === o.value ? on : off}`}
              >
                {o.colour ? (
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: o.colour }}
                  />
                ) : null}
                {o.label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={row.current === null}
              onClick={() => onSet(row.field, null)}
              className={`${chip} shrink-0 ${row.current === null ? on : off}`}
            >
              None
            </button>
          </div>
        ) : (
          <span key={row.field} className="inline-flex items-center gap-2">
            <span className={HEADING}>{row.label}</span>
            <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              {row.options.find((o) => o.value === row.current)?.label ?? 'None'}
            </span>
          </span>
        ),
      )}
    </div>
  );
}

// A queue row's priority (docs/specs/026-plan/session-tabs.md "Bug Triage"): its name in a pill of its colour, or a
// dashed "?" for none, so an unprioritised bug shows before it is accepted.
export function PriorityPill({ item }: { item: Item }) {
  const p = item.fields['priority'];
  if (!isPriority(p))
    return (
      <span
        className="shrink-0 rounded-full border border-dashed border-amber-400 px-1.5 text-[11px] font-medium text-amber-700 dark:border-amber-500 dark:text-amber-400"
        data-priority-pill="none"
      >
        <span className="text-optical-centre">
          <span aria-hidden>?</span>
          <span className="sr-only">No priority</span>
        </span>
      </span>
    );
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      data-priority-pill={p}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ backgroundColor: PRIORITY_COLOURS[p] }}
      />
      <span className="text-optical-centre">{PRIORITY_LABELS[p]}</span>
    </span>
  );
}
