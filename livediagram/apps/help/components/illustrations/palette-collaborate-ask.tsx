// Collaborate scenes for the elements that ask the room (palette-collaborate.tsx): the estimate
// card, the temperature check and the idea box.

import { Scene, Label, Avatar } from '@liveworkspace/help-site/art/primitives';
import { AccentBar, CollabCard } from './palette-collaborate-card';

/** An estimate card before the reveal: your own pick lifted, who has
 *  answered (never what), and Reveal at the foot. */
export function EstimateCard() {
  const x = 100;
  const y = 12;
  const w = 220;
  const values = ['1', '2', '3', '5', '8', '13', '21', '?'];
  const cw = 22;
  const gap = 3;
  const left = x + (w - (cw * values.length + gap * (values.length - 1))) / 2;
  const cx = x + w / 2;
  const hands = [
    { initial: 'R', colour: 'emerald' as const },
    { initial: 'P', colour: 'violet' as const },
    { initial: 'J', colour: 'amber' as const },
  ];
  return (
    <Scene w={420} h={214}>
      <CollabCard x={x} y={y} w={w} h={190} title="Login rework" aside="3/5 ANSWERED">
        {/* The scale as cards, yours lifted in the accent. */}
        {values.map((v, i) => {
          const mine = v === '5';
          const bx = left + i * (cw + gap);
          return (
            <g key={v}>
              <rect
                x={bx}
                y={y + (mine ? 40 : 43)}
                width={cw}
                height={30}
                rx={6}
                className={mine ? 'fill-brand-500' : 'fill-slate-50 stroke-slate-200'}
                strokeWidth={1.2}
              />
              <Label
                x={bx + cw / 2}
                y={y + (mine ? 55 : 58)}
                anchor="middle"
                size={10}
                weight={700}
                tone={mine ? 'onAccent' : 'strong'}
              >
                {v}
              </Label>
            </g>
          );
        })}
        {/* Who has answered: face-down cards with their avatars, over a
            slim progress bar. */}
        {hands.map((h, i) => {
          const hx = cx - 36 + i * 26;
          return (
            <g key={h.initial}>
              <rect
                x={hx}
                y={y + 88}
                width={20}
                height={28}
                rx={5}
                className="fill-brand-100 stroke-brand-300"
                strokeWidth={1}
              />
              <Avatar cx={hx + 10} cy={y + 118} r={6} initial={h.initial} colour={h.colour} />
            </g>
          );
        })}
        <rect x={cx - 50} y={y + 136} width={100} height={4} rx={2} className="fill-slate-100" />
        <rect x={cx - 50} y={y + 136} width={60} height={4} rx={2} className="fill-brand-500" />
        {/* The one action, at the foot, under the cards it acts on. */}
        <AccentBar x={x + 12} y={y + 154} w={w - 24} label="Reveal" count={3} />
      </CollabCard>
    </Scene>
  );
}

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

/** An idea box while it is closed: a count, nothing else, Open the Box above
 *  the sealed panel, and the composer with its Anonymous chip at the foot. */
export function IdeaBoxCard() {
  const x = 100;
  const y = 12;
  const w = 220;
  const cx = x + w / 2;
  return (
    <Scene w={420} h={222}>
      <CollabCard x={x} y={y} w={w} h={198} title="What slowed us down?" aside="7 IDEAS">
        {/* The facilitator's one action, the Q&A board's dashed accent bar. */}
        <AccentBar x={x + 12} y={y + 40} w={w - 24} label="Open the Box" count={7} />
        {/* Sealed: a lock, the count, and no text. */}
        <rect
          x={x + 12}
          y={y + 70}
          width={w - 24}
          height={74}
          rx={9}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.2}
        />
        <circle cx={cx} cy={y + 87} r={9} className="fill-brand-100" />
        <rect
          x={cx - 3.5}
          y={y + 86}
          width={7}
          height={5.5}
          rx={1.2}
          className="fill-none stroke-brand-600"
          strokeWidth={1.2}
        />
        <path
          d={`M${cx - 2} ${y + 86}v-1.6a2 2 0 0 1 4 0v1.6`}
          className="fill-none stroke-brand-600"
          strokeWidth={1.2}
        />
        <Label x={cx} y={y + 112} anchor="middle" size={18} weight={700} tone="strong">
          7
        </Label>
        <Label x={cx} y={y + 131} anchor="middle" size={10} weight={600} tone="muted">
          ideas sealed
        </Label>
        {/* The composer at the foot, with its Anonymous chip. */}
        <rect
          x={x + 12}
          y={y + 152}
          width={w - 24}
          height={38}
          rx={11}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        <Label x={x + 22} y={y + 163} size={10} tone="muted">
          Add an idea…
        </Label>
        <circle cx={x + w - 25} cy={y + 164} r={8} className="fill-brand-500" />
        <path
          d={`M${x + w - 25} ${y + 168}v-7M${x + w - 28} ${y + 164}l3-3 3 3`}
          className="fill-none stroke-white help-art-as-drawn"
          strokeWidth={1.3}
        />
        <rect x={x + 18} y={y + 172} width={70} height={14} rx={7} className="fill-brand-50" />
        <Label x={x + 53} y={y + 179.5} anchor="middle" size={10} weight={600} tone="accent">
          Anonymous
        </Label>
      </CollabCard>
    </Scene>
  );
}
