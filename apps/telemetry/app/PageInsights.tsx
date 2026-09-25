'use client';

import { fmtDay } from './chart-utils';
import type { InsightDef, InsightReading } from './page-insights';

// One insight tile on the Pages tab (spec/150): the rate, the counts it is
// made of, how it moved against the span before, and its 30-day trend.

const ACCENT = '#0ea5e9';

// Rates read as whole numbers; an average (pages per visitor) keeps a decimal.
const fmt = (value: number, scale: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: scale === 1 ? 1 : 0 });

export function InsightTile({
  def,
  reading,
  highlightFromIndex,
  previousLabel,
}: {
  def: InsightDef;
  reading: InsightReading;
  highlightFromIndex: number | null;
  previousLabel: string | null; // "the 7 days before", or null with no previous span
}) {
  const { value, to, from, previous, trend, since } = reading;
  // A line needs two days with a rate to be a line.
  const drawable = trend.filter((v) => v !== null).length >= 2;
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{def.title}</p>
        {value !== null && previous !== null && previousLabel ? (
          <Change def={def} now={value} before={previous} against={previousLabel} />
        ) : null}
      </div>
      {/* The flow the rate measures, so the ratio reads without the sentence. */}
      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Chip>{def.fromLabel}</Chip>
        <span aria-hidden>→</span>
        <span className="sr-only">to</span>
        <Chip>{def.toLabel}</Chip>
      </p>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {value === null ? 'n/a' : fmt(value, def.scale)}
        </span>
        {value !== null ? <span className="text-xs text-slate-400">{def.unit}</span> : null}
      </p>
      <p className="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">
        {value === null
          ? `No ${def.fromLabel} in this window yet.`
          : `${to.toLocaleString()} from ${from.toLocaleString()}`}
        {since !== null ? ` · since page views began ${fmtDay(since)}` : ''}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {def.detail}
      </p>
      <div className="mt-auto pt-4">
        {drawable ? (
          <>
            <RatioTrend values={trend} highlightFromIndex={highlightFromIndex} />
            <p className="mt-1 text-[10px] text-slate-400">30 days, rolling 7-day rate</p>
          </>
        ) : (
          <p className="text-[10px] text-slate-400">
            Not enough days of page views yet for a trend.
          </p>
        )}
      </div>
    </div>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {children}
    </span>
  );
}

// The move against the span before: green up / rose down where a rise is
// good news, slate either way where it isn't clearly either.
function Change({
  def,
  now,
  before,
  against,
}: {
  def: InsightDef;
  now: number;
  before: number;
  against: string;
}) {
  const delta = now - before;
  const flat = Math.abs(delta) < (def.scale === 1 ? 0.05 : 0.5);
  const tone =
    flat || def.rising === 'neutral'
      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      : delta > 0
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
        : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400';
  const arrow = flat ? '→' : delta > 0 ? '▲' : '▼';
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${tone}`}
      title={`Against ${against}: ${fmt(before, def.scale)}`}
    >
      {arrow} {flat ? 'flat' : fmt(Math.abs(delta), def.scale)}
      <span className="sr-only"> against {against}</span>
    </span>
  );
}

// The rate's 30-day line: the selected window in the accent, the days before
// muted, gaps where the denominator was still zero.
function RatioTrend({
  values,
  highlightFromIndex,
}: {
  values: (number | null)[];
  highlightFromIndex: number | null;
}) {
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const n = values.length;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 50);
  const y = (v: number) => 92 - (v / max) * 84;
  const from = highlightFromIndex ?? 0;
  // Break the path at nulls so a gap reads as "no rate", not as zero.
  const path = (start: number) => {
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
      if (i < start || v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'} ${x(i)} ${y(v)} `;
      pen = true;
    });
    return d;
  };
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-12 w-full" aria-hidden>
      {from > 0 ? (
        <rect x={x(from)} y={0} width={100 - x(from)} height={100} fill={ACCENT} opacity={0.06} />
      ) : null}
      <path
        d={path(0)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        className="text-slate-300 dark:text-slate-600"
      />
      <path
        d={path(from)}
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
