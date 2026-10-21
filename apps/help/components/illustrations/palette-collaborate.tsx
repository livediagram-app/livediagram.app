// Collaborate-category illustrations (docs/specs/018-help/help-app.md, drawing docs/specs/012-collaboration/temperature-check.md
// and docs/specs/012-collaboration/decision-record.md): one scene per element that collects what the room thinks,
// the temperature check and the decision record. (The comment and action panels live in
// palette-collab-panels.tsx.)
//
// One scene per sub-article, drawn as the card really looks: a titled panel
// with its caption on the right.

import type { ReactNode } from 'react';

import { Scene, Label, } from './primitives';

// --- Shared card chrome ------------------------------------------------------

/** A collaboration element on the canvas: title, the caption on the right, a
 *  body, and whatever the card draws below. */
export function CollabCard({
  x,
  y,
  w,
  h,
  title,
  aside,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  aside?: string;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={11}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <Label x={x + 14} y={y + 19} size={12} weight={700} tone="strong">
        {title}
      </Label>
      {aside && (
        <Label x={x + w - 14} y={y + 19} anchor="end" size={10} weight={600} tone="muted">
          {aside}
        </Label>
      )}
      <line
        x1={x}
        y1={y + 31}
        x2={x + w}
        y2={y + 31}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      {children}
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------

// Cool to warm, the fixed TEMPERATURE_COLORS (blue, cyan, lime, amber, rose
// at their 400 shade), so the figure shows the same hues the card always draws.
const TEMPERATURE_HUES = ['blue', 'cyan', 'lime', 'amber', 'rose'] as const;
const HUE_FILL: Record<(typeof TEMPERATURE_HUES)[number], string> = {
  blue: 'fill-blue-400',
  cyan: 'fill-cyan-400',
  lime: 'fill-lime-400',
  amber: 'fill-amber-400',
  rose: 'fill-rose-400',
};
const HUE_STROKE: Record<(typeof TEMPERATURE_HUES)[number], string> = {
  blue: 'stroke-blue-400',
  cyan: 'stroke-cyan-400',
  lime: 'stroke-lime-400',
  amber: 'stroke-amber-400',
  rose: 'stroke-rose-400',
};

/** A temperature check: five faces, the bars they fill, and the average. */
export function TemperatureCheckCard() {
  const x = 86;
  const y = 12;
  const w = 248;
  const tally = [0, 1, 4, 2, 3];
  // The face's mouth per value, frown to beam (as MoodGlyph draws it).
  const mouths = [
    'M-3 3q3-2.6 6 0',
    'M-2.6 2.6q2.6-1 5.2 0',
    'M-2.6 2.2h5.2',
    'M-2.8 1.6q2.8 2.2 5.6 0',
    'M-3.2 1.2q3.2 4.2 6.4 0z',
  ];
  const col = 36;
  const gap = 5;
  const left = x + (w - (col * 5 + gap * 4)) / 2;
  const average = 3.7;
  const pos = (average - 1) / 4;
  const trackX = x + 14;
  const trackW = w - 28;
  return (
    <Scene w={420} h={226}>
      <defs>
        <linearGradient id="temperature-track">
          {TEMPERATURE_HUES.map((hue, i) => (
            <stop
              key={hue}
              offset={`${i * 25}%`}
              style={{ stopColor: `var(--color-${hue}-400)` }}
            />
          ))}
        </linearGradient>
      </defs>
      <CollabCard x={x} y={y} w={w} h={202} title="How are we feeling?" aside="10 ANSWERED">
        {tally.map((count, i) => {
          const hue = TEMPERATURE_HUES[i]!;
          const bx = left + i * (col + gap);
          const mine = i === 3;
          const cx = bx + col / 2;
          const full = 58;
          const barH = count === 0 ? 0 : Math.max(8, (count / 4) * full);
          return (
            <g key={hue}>
              {/* The face tile, yours lifted in its own colour. */}
              <rect
                x={bx}
                y={y + (mine ? 38 : 40)}
                width={col}
                height={36}
                rx={8}
                fillOpacity={mine ? 0.18 : undefined}
                className={
                  mine ? `${HUE_FILL[hue]} ${HUE_STROKE[hue]}` : 'fill-slate-50 stroke-slate-200'
                }
                strokeWidth={1.2}
              />
              <g
                transform={`translate(${cx} ${y + (mine ? 52 : 54)})`}
                className={mine ? HUE_STROKE[hue] : 'stroke-slate-500'}
                fill="none"
                strokeWidth={1.2}
                strokeLinecap="round"
              >
                <circle r={6} />
                <circle cx={-2} cy={-1.4} r={0.7} className="fill-current" stroke="none" />
                <circle cx={2} cy={-1.4} r={0.7} className="fill-current" stroke="none" />
                <path d={mouths[i]} />
              </g>
              <Label
                x={cx}
                y={y + (mine ? 67 : 69)}
                anchor="middle"
                size={10}
                weight={700}
                tone="strong"
              >
                {String(i + 1)}
              </Label>
              {/* The count over each bar, then the bar, rounded, easing to its share. */}
              <Label x={cx} y={y + 88} anchor="middle" size={9} weight={600} tone="muted">
                {String(count)}
              </Label>
              <rect
                x={cx - 11}
                y={y + 96}
                width={22}
                height={full}
                rx={11}
                className="fill-slate-100"
              />
              {barH > 0 && (
                <rect
                  x={cx - 11}
                  y={y + 96 + full - barH}
                  width={22}
                  height={barH}
                  rx={Math.min(11, barH / 2)}
                  className={HUE_FILL[hue]}
                />
              )}
            </g>
          );
        })}
        {/* The mood meter, the marker at the average. */}
        <rect
          x={trackX}
          y={y + 164}
          width={trackW}
          height={6}
          rx={3}
          fill="url(#temperature-track)"
        />
        <circle
          cx={trackX + 6 + pos * (trackW - 12)}
          cy={y + 167}
          r={5.5}
          className={`fill-white ${HUE_STROKE[TEMPERATURE_HUES[Math.round(pos * 4)]!]}`}
          strokeWidth={2.5}
        />
        <Label x={trackX} y={y + 188} size={15} weight={700} tone="strong">
          3.7
        </Label>
        <Label x={x + w - 14} y={y + 188} anchor="end" size={10} tone="muted">
          from 10 people
        </Label>
      </CollabCard>
    </Scene>
  );
}

/** A decision record: the statement as the label, the status badge, the
 *  drivers under "Because" and the date as a pill in the footer. */
export function DecisionRecordCard() {
  const x = 90;
  const y = 14;
  const w = 240;
  const drivers = ['Already on Cloudflare', 'SQL we know', 'No servers to run'];
  return (
    <Scene w={420} h={208}>
      <rect
        x={x}
        y={y}
        width={w}
        height={180}
        rx={11}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      {/* The status badge, top right, with its glyph. */}
      <rect x={x + w - 86} y={y + 10} width={74} height={18} rx={9} className="fill-emerald-100" />
      <path
        d={`M${x + w - 78} ${y + 19.4}l2 2 3.8-4`}
        className="fill-none stroke-emerald-700 dark:stroke-emerald-300"
        strokeWidth={1.5}
      />
      <Label
        x={x + w - 44}
        y={y + 19.5}
        anchor="middle"
        size={10}
        weight={700}
        className="fill-emerald-700 dark:fill-emerald-300"
      >
        Accepted
      </Label>
      {/* The statement: the sentence people read, set larger than a title. */}
      <Label x={x + 14} y={y + 22} size={14} weight={700} tone="strong">
        Use D1 for durable
      </Label>
      <Label x={x + 14} y={y + 41} size={14} weight={700} tone="strong">
        storage
      </Label>
      <Label x={x + 14} y={y + 66} size={10} weight={700} className="fill-emerald-500">
        BECAUSE
      </Label>
      {drivers.map((d, i) => {
        const ry = y + 86 + i * 20;
        return (
          <g key={d}>
            <circle cx={x + 21} cy={ry} r={6} className="fill-emerald-100" />
            <Label
              x={x + 21}
              y={ry + 1}
              anchor="middle"
              size={10}
              weight={700}
              className="fill-emerald-700 dark:fill-emerald-300"
            >
              →
            </Label>
            <Label x={x + 34} y={ry + 1} size={11} tone="body">
              {d}
            </Label>
          </g>
        );
      })}
      {/* The date, a pill in the footer. */}
      <rect x={x + 14} y={y + 148} width={92} height={20} rx={10} className="fill-slate-100" />
      <rect
        x={x + 22}
        y={y + 153}
        width={10}
        height={10}
        rx={2}
        className="fill-none stroke-slate-500"
        strokeWidth={1.2}
      />
      <Label x={x + 38} y={y + 158.5} size={10} weight={500} tone="body">
        2026-03-12
      </Label>
    </Scene>
  );
}
