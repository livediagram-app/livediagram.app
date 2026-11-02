'use client';

// A metric with room to show itself (docs/specs/026-plan/plan-tabs.md "Metric tiles"): in a Dashboard slot, or sized up
// on the canvas. Its glyph and name, a hero figure that grows with the tile, the line under it, and, where there is
// room, a picture of what the figure is made of (metric-tile-model.ts): a ring, bars, a split, people, the top card or
// the stale ones. It reflows by size (metricTier): compact puts the figure beside its name; large puts the picture
// beside the figure when the tile is wide, under it otherwise.
import type { CSSProperties, ReactNode } from 'react';
import type { MetricKind } from '@liveplanner/items';
import { BoardWidgetArt } from '../plan-tile-art';
import { PersonDisc } from '../PersonDisc';
import type { PlanPalette } from '../plan-palette';
import {
  METRIC_SIDE_BY_SIDE_MIN_W,
  heroSize,
  metricStripFits,
  type MetricModel,
  type MetricTier,
  type MetricVisual,
} from '@liveplanner/plan-art';

const PEOPLE_ROWS = 5;

export function MetricTile({
  kind,
  label,
  model,
  tier,
  width,
  height,
  palette,
  fontFamily,
  loading,
  onOpenItem,
}: {
  kind: MetricKind;
  label: string;
  model: MetricModel;
  tier: Exclude<MetricTier, 'pill'>;
  width: number;
  height: number;
  palette: PlanPalette;
  fontFamily?: string | undefined;
  loading: boolean;
  onOpenItem?: ((itemId: string) => void) | undefined;
}) {
  const size = heroSize(width, height, tier);
  const side = tier === 'large' && width >= METRIC_SIDE_BY_SIDE_MIN_W;
  const frame: CSSProperties = {
    borderColor: palette.border,
    backgroundColor: palette.surface,
    color: palette.text,
    ...(fontFamily ? { fontFamily } : null),
  };
  const header = (
    <div className="flex min-w-0 items-center gap-2">
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: palette.column, color: palette.focus }}
      >
        <BoardWidgetArt kind={kind} size={15} />
      </span>
      <span
        className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: palette.muted }}
      >
        {label}
      </span>
    </div>
  );
  const hero = loading ? (
    <span className="text-[13px]" style={{ color: palette.muted }}>
      Loading cards…
    </span>
  ) : (
    <div className="min-w-0">
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span
          className="font-semibold leading-none tabular-nums tracking-tight"
          style={{ fontSize: size, color: model.tone ?? palette.text }}
        >
          {model.hero}
        </span>
        {model.unit ? (
          <span
            className="truncate font-medium"
            style={{ fontSize: Math.max(12, Math.round(size * 0.32)), color: palette.muted }}
          >
            {model.unit}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 truncate text-[12px] leading-snug" style={{ color: palette.muted }}>
        {model.line}
      </p>
    </div>
  );
  const picture =
    loading ||
    !model.visual ||
    tier === 'compact' ||
    (tier === 'regular' && !metricStripFits(model.visual, height, size)) ? null : (
      <Visual
        visual={model.visual}
        palette={palette}
        full={tier === 'large'}
        onOpenItem={onOpenItem}
      />
    );
  return (
    <div
      role="group"
      aria-label={`${label}: ${model.hero}${model.unit ? ` ${model.unit}` : ''}, ${model.line}`}
      className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border p-4"
      style={frame}
    >
      {tier === 'compact' ? (
        <div className="flex h-full min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">{header}</div>
          <div className="min-w-0 text-right">{hero}</div>
        </div>
      ) : side ? (
        <div className="flex h-full min-h-0 gap-6">
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
            {header}
            {hero}
          </div>
          {picture ? (
            <div className="flex min-h-0 min-w-0 flex-1 items-center">{picture}</div>
          ) : null}
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-3">
          {header}
          {hero}
          {picture ? <div className="mt-auto min-h-0">{picture}</div> : null}
        </div>
      )}
    </div>
  );
}

function Visual({
  visual,
  palette,
  full,
  onOpenItem,
}: {
  visual: NonNullable<MetricVisual>;
  palette: PlanPalette;
  // The picture in full (a large tile), else a strip of it.
  full: boolean;
  onOpenItem?: ((itemId: string) => void) | undefined;
}): ReactNode {
  switch (visual.kind) {
    case 'ring':
      return full ? (
        <Ring pct={visual.pct} palette={palette} />
      ) : (
        <Meter pct={visual.pct} palette={palette} />
      );
    case 'split':
      return <Split parts={visual.parts} total={visual.total} palette={palette} legend={full} />;
    case 'bars':
      return full ? (
        <Bars rows={visual.rows} palette={palette} />
      ) : (
        <Split
          parts={visual.rows}
          total={visual.rows.reduce((n, r) => n + r.count, 0)}
          palette={palette}
          legend={false}
        />
      );
    case 'people':
      return (
        <div className="flex min-w-0 flex-col gap-1.5">
          {visual.rows.slice(0, full ? PEOPLE_ROWS : 1).map(({ person, count }) => (
            <div key={person.id} className="flex min-w-0 items-center gap-2 text-[12px]">
              <PersonDisc person={person} />
              <span className="min-w-0 flex-1 truncate">{person.name}</span>
              <span className="tabular-nums" style={{ color: palette.muted }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      );
    case 'card':
      return (
        <button
          type="button"
          onClick={() => onOpenItem?.(visual.itemId)}
          className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition hover:brightness-110"
          style={{ borderColor: palette.cardBorder, backgroundColor: palette.card }}
        >
          <span className="min-w-0 flex-1 truncate font-medium">
            {visual.title || 'Untitled card'}
          </span>
          <span className="shrink-0 tabular-nums" style={{ color: palette.muted }}>
            {visual.votes}
          </span>
        </button>
      );
    case 'list':
      return (
        <ul className="flex min-w-0 flex-col gap-1">
          {visual.rows.slice(0, full ? 5 : 1).map((r) => (
            <li key={r.itemId}>
              <button
                type="button"
                onClick={() => onOpenItem?.(r.itemId)}
                className="w-full min-w-0 cursor-pointer truncate rounded-md px-2 py-1 text-left text-[12px] transition hover:bg-black/5 dark:hover:bg-white/10"
              >
                {r.title}
              </button>
            </li>
          ))}
        </ul>
      );
  }
}

// A ring filled to the share, its share in the middle.
function Ring({ pct, palette }: { pct: number; palette: PlanPalette }) {
  return (
    <div
      role="img"
      aria-label={`${pct}%`}
      className="mx-auto flex aspect-square h-full max-h-36 min-h-16 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${palette.focus} ${pct * 3.6}deg, ${palette.column} 0deg)`,
      }}
    >
      <div
        className="flex h-[74%] w-[74%] items-center justify-center rounded-full text-[13px] font-semibold tabular-nums"
        style={{ backgroundColor: palette.surface, color: palette.text }}
      >
        <span className="text-optical-centre">{pct}%</span>
      </div>
    </div>
  );
}

// A thin bar filled to the share.
function Meter({ pct, palette }: { pct: number; palette: PlanPalette }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: palette.column }}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, backgroundColor: palette.focus }}
      />
    </div>
  );
}

// One bar split into its parts, each its share of the whole; a legend under it in a large tile.
function Split({
  parts,
  total,
  palette,
  legend,
}: {
  parts: readonly { key: string; label: string; count: number; color: string }[];
  total: number;
  palette: PlanPalette;
  legend: boolean;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full"
        style={{ backgroundColor: palette.column }}
      >
        {parts
          .filter((p) => p.count > 0)
          .map((p) => (
            <div
              key={p.key}
              style={{
                width: `${(p.count / Math.max(1, total)) * 100}%`,
                backgroundColor: p.color,
              }}
            />
          ))}
      </div>
      {legend ? (
        <div
          className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]"
          style={{ color: palette.muted }}
        >
          {parts.map((p) => (
            <span key={p.key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              {p.label}
              <span className="tabular-nums" style={{ color: palette.text }}>
                {p.count}
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// A bar per row, its length its share of the largest.
function Bars({
  rows,
  palette,
}: {
  rows: readonly { key: string; label: string; count: number; color: string }[];
  palette: PlanPalette;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      {rows.slice(0, 6).map((r) => (
        <div key={r.key} className="flex min-w-0 items-center gap-2 text-[11px]">
          <span className="w-20 shrink-0 truncate" style={{ color: palette.muted }}>
            {r.label}
          </span>
          <div
            className="h-2 min-w-0 flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: palette.column }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.count / max) * 100}%`, backgroundColor: r.color }}
            />
          </div>
          <span className="w-6 shrink-0 text-right tabular-nums" style={{ color: palette.text }}>
            {r.count}
          </span>
        </div>
      ))}
    </div>
  );
}
