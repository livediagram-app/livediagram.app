'use client';

// A form's Summary (docs/specs/030-forms/forms.md "The Summary"): its responses summed up question by question, in
// place of the form, read from the cards or the sheet rows they became. Loaded only when Summary is opened.
import { useEffect, useMemo, type ReactNode } from 'react';
import {
  promptOf,
  sheetResponses,
  summariseResponses,
  type FormDefinition,
  type QuestionSummary,
  type ResponseAnswers,
} from '@liveplanner/forms';
import { Button, EmptyState, lucideGlyph } from '@liveplanner/ui';
import { lucideChartColumn } from '@liveworkspace/icons/lucide';
import { usePlan } from '@/components/plan/PlanContext';
import { useSheetStore } from '@/components/plan/dashboard/useSheetReader';
import { cardResponses } from './form-responses';

const ChartIcon = lucideGlyph(lucideChartColumn, 22);

const CARD =
  'rounded-xl border border-slate-200 bg-white p-5 max-sm:p-4 dark:border-slate-700/80 dark:bg-slate-900';
const MUTED = 'text-[13px] text-slate-500 dark:text-slate-400';

type Read =
  | { state: 'ready'; responses: readonly ResponseAnswers[] }
  | { state: 'loading' }
  | { state: 'failed'; retry: () => void };

// A sheet form's rows, read live from the sheet store (its tab fetched as the Summary opens).
function useSheetRows(form: FormDefinition): Read {
  const { store, version } = useSheetStore();
  const at = form.sheet;
  const tabId = at?.tabId ?? null;
  useEffect(() => {
    if (store && tabId) void store.loadTab(tabId);
  }, [store, tabId]);
  const sheet = store && at ? store.sheet(at.sheetId) : undefined;
  // Read again on every draw: the store's version moves with each edit to a sheet it holds, and draws this again.
  void version;
  const responses = sheet ? sheetResponses(form, sheet) : null;
  if (responses) return { state: 'ready', responses };
  if (store && tabId && store.status(tabId) === 'error')
    return { state: 'failed', retry: () => void store.loadTab(tabId, true) };
  return { state: 'loading' };
}

export function FormSummary({
  form,
  tabId,
  destinationName,
  onOpenResponses,
  onShare,
}: {
  form: FormDefinition;
  tabId: string;
  // The board or sheet the responses are on, and the way to it.
  destinationName: string;
  onOpenResponses: () => void;
  // Share Form, an Editor's: offered while there is nothing to sum up.
  onShare?: (() => void) | undefined;
}) {
  return form.sheet ? (
    <SheetSummary {...{ form, destinationName, onOpenResponses, onShare }} />
  ) : (
    <BoardSummary {...{ form, tabId, destinationName, onOpenResponses, onShare }} />
  );
}

type ViewProps = {
  form: FormDefinition;
  destinationName: string;
  onOpenResponses: () => void;
  onShare?: (() => void) | undefined;
};

function BoardSummary({ form, tabId, ...rest }: ViewProps & { tabId: string }) {
  const plan = usePlan();
  const items = plan?.items;
  const types = plan?.types;
  const responses = useMemo(
    () => (items ? cardResponses(form, tabId, items.values(), types ?? []) : []),
    [form, tabId, items, types],
  );
  return <SummaryView form={form} read={{ state: 'ready', responses }} unit="card" {...rest} />;
}

function SheetSummary(props: ViewProps) {
  return <SummaryView read={useSheetRows(props.form)} unit="row" {...props} />;
}

function SummaryView({
  form,
  read,
  unit,
  destinationName,
  onOpenResponses,
  onShare,
}: ViewProps & { read: Read; unit: 'card' | 'row' }) {
  const responses = read.state === 'ready' ? read.responses : null;
  const summaries = useMemo(
    () => (responses ? summariseResponses(form, responses) : []),
    [form, responses],
  );
  const open = (
    <Button variant="secondary" size="sm" onClick={onOpenResponses}>
      {`Open ${destinationName}`}
    </Button>
  );
  if (read.state === 'failed')
    return (
      <div className={CARD} role="alert">
        <p className="text-[15px] font-medium text-slate-900 dark:text-slate-50">
          We couldn’t read {destinationName}
        </p>
        <p className={`mt-1 ${MUTED}`}>Check your connection and try again.</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={read.retry}>
          Try Again
        </Button>
      </div>
    );
  if (!responses)
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Reading the responses">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${CARD} h-32 animate-pulse motion-reduce:animate-none`} />
        ))}
      </div>
    );
  if (responses.length === 0)
    return (
      <EmptyState
        icon={<ChartIcon />}
        title="No Responses Yet"
        description={`Each response becomes a ${unit} on ${destinationName}, and its answers are summed up here.`}
      >
        {onShare ? (
          <Button size="sm" onClick={onShare}>
            Share Form
          </Button>
        ) : null}
      </EmptyState>
    );
  const count = responses.length;
  return (
    <div className="flex flex-col gap-3">
      <div className={`${CARD} flex flex-wrap items-center gap-x-4 gap-y-3`}>
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {count.toLocaleString('en-GB')} {count === 1 ? 'Response' : 'Responses'}
          </h2>
          <p className={`mt-0.5 ${MUTED}`}>
            Read from the {unit}s on {destinationName} as they are now: changing or deleting a{' '}
            {unit} changes this.
          </p>
        </div>
        {open}
      </div>
      {summaries.map((s) => (
        <QuestionCard
          key={s.question.id}
          summary={s}
          total={count}
          destinationName={destinationName}
        />
      ))}
    </div>
  );
}

const whole = (n: number) => n.toLocaleString('en-GB');
const oneDecimal = (n: number) =>
  n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
// A share of the people who answered, never "0%" for someone and never "100%" short of everyone.
function percent(count: number, of: number): string {
  if (!of || !count) return '0%';
  const p = Math.round((count / of) * 100);
  return `${count < of ? Math.min(99, Math.max(1, p)) : 100}%`;
}

function QuestionCard({
  summary: s,
  total,
  destinationName,
}: {
  summary: QuestionSummary;
  total: number;
  destinationName: string;
}) {
  return (
    <section className={CARD} aria-label={promptOf(s.question)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="min-w-0 text-[16px] font-medium leading-snug text-slate-900 dark:text-slate-50">
          {promptOf(s.question)}
        </h3>
        <p className={`shrink-0 tabular-nums ${MUTED}`}>
          {whole(s.answered)} of {whole(total)} answered
        </p>
      </div>
      <div className="mt-4">
        {s.answered === 0 ? (
          <p className={MUTED}>Nobody has answered this one.</p>
        ) : s.kind === 'choices' ? (
          <Bars rows={s.rows} of={s.answered} />
        ) : s.kind === 'rating' ? (
          <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
            <Figure value={oneDecimal(s.average ?? 0)} label={`Average of ${s.scale}`} />
            <div className="min-w-0 flex-1 basis-64">
              <Bars
                rows={s.counts.map((count, i) => ({ label: String(i + 1), count })).reverse()}
                of={s.answered}
                narrowLabels
              />
            </div>
          </div>
        ) : s.kind === 'number' ? (
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <Figure value={oneDecimal(s.average ?? 0)} label="Average" />
            <Figure value={oneDecimal(s.min ?? 0)} label="Lowest" />
            <Figure value={oneDecimal(s.max ?? 0)} label="Highest" />
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {s.latest.map((text, i) => (
                <li
                  key={i}
                  className="whitespace-pre-line break-words rounded-lg bg-slate-50 px-3 py-2 text-[14px] leading-relaxed text-slate-800 dark:bg-slate-800/60 dark:text-slate-100"
                >
                  {text}
                </li>
              ))}
            </ul>
            {s.answered > s.latest.length ? (
              <p className={`mt-2.5 ${MUTED}`}>
                The newest {s.latest.length} of {whole(s.answered)}. Every answer is on{' '}
                {destinationName}.
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function Figure({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div>
      <p className="text-[30px] font-semibold leading-none tracking-tight tabular-nums text-slate-900 dark:text-slate-50">
        {value}
      </p>
      <p className={`mt-1.5 ${MUTED}`}>{label}</p>
    </div>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

// One row an answer: its name, how many gave it and their share, over a thin bar. One hue: the bars show how many,
// and the figures beside them say it in ink, so nothing is read from colour alone.
function Bars({
  rows,
  of,
  narrowLabels = false,
}: {
  rows: readonly { label: string; count: number }[];
  of: number;
  narrowLabels?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li
          key={row.label}
          className={narrowLabels ? 'flex items-center gap-3' : 'flex flex-col gap-1'}
        >
          <div
            className={`flex items-baseline gap-3 text-[14px] ${narrowLabels ? 'w-5 shrink-0 justify-end' : 'justify-between'}`}
          >
            <span className="flex min-w-0 items-center gap-2 break-words text-slate-800 dark:text-slate-100">
              {HEX.test(row.label) ? (
                <span
                  aria-hidden
                  className="size-3.5 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]"
                  style={{ background: row.label }}
                />
              ) : null}
              {row.label}
            </span>
            {narrowLabels ? null : <Share count={row.count} of={of} />}
          </div>
          <div
            aria-hidden
            className={`h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${narrowLabels ? 'min-w-0 flex-1' : ''}`}
          >
            <div
              className="h-full rounded-full bg-brand-600 dark:bg-brand-400"
              style={{ width: `${of ? (row.count / of) * 100 : 0}%` }}
            />
          </div>
          {narrowLabels ? <Share count={row.count} of={of} fixed /> : null}
        </li>
      ))}
    </ul>
  );
}

function Share({ count, of, fixed = false }: { count: number; of: number; fixed?: boolean }) {
  return (
    <span
      className={`shrink-0 whitespace-nowrap text-[13px] tabular-nums text-slate-600 dark:text-slate-300 ${fixed ? 'w-20 text-right' : ''}`}
    >
      <strong className="font-semibold text-slate-900 dark:text-slate-50">{whole(count)}</strong>
      <span className="ml-1.5">{percent(count, of)}</span>
    </span>
  );
}
