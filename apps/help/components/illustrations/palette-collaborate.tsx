// Collaborate-category illustrations (docs/specs/018-help/help-app.md, drawing docs/specs/012-collaboration/estimate-card.md to docs/specs/012-collaboration/roll-call.md and
// docs/specs/012-collaboration/comment-pin.md): the palette's Collaborate groups, plus one scene per element that
// collects what the room thinks: estimate card, temperature check, idea box,
// agenda, decision record and roll call. (The comment and action panels live in
// palette-collab-panels.tsx, the Q&A board in palette-qa-board.tsx.)
//
// One scene per sub-article, drawn as the card really looks: a titled panel
// with its caption on the right, and the card's one action as the dashed
// accent bar the Q&A board introduced.

import type { ReactNode } from 'react';

import { Scene, Label, Avatar, Panel } from './primitives';

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

/** The dashed accent bar every modern Collaborate card uses for its one
 *  action (Reveal, Open the box, Take roll, Add Action). */
function AccentBar({
  x,
  y,
  w,
  h = 22,
  label,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  label: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={7}
        className="fill-brand-50 stroke-brand-300"
        strokeWidth={1.2}
        strokeDasharray="4 3"
      />
      <Label x={x + w / 2} y={y + h / 2 + 1} anchor="middle" size={10} weight={600} tone="accent">
        {label}
      </Label>
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------

// The Collaborate category's groups, in BEHAVIOUR_GROUPS order
// (apps/live/components/palette/palette-create-tabs.tsx). Ask and Record are
// the two this article covers, so they are the two drawn lit.
const GROUPS: { label: string; lit: boolean }[] = [
  { label: 'Ask', lit: true },
  { label: 'Tools', lit: false },
  { label: 'Record', lit: true },
  { label: 'React', lit: false },
  { label: 'Selection Mode', lit: false },
  { label: 'Navigate', lit: false },
];

/** The Collaborate category: a search across every group, over the six
 *  groups you click into. Ask and Record hold the elements that collect what
 *  the room thinks. */
export function CollaborateGroups() {
  const px = 52;
  const py = 12;
  return (
    <Scene w={420} h={228} bg="plain">
      <Panel x={px} y={py} w={316} h={204} title="COLLABORATE">
        <rect
          x={px + 12}
          y={py + 32}
          width={292}
          height={24}
          rx={7}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.5}
        />
        <circle
          cx={px + 25}
          cy={py + 44}
          r={4}
          className="fill-none stroke-slate-400"
          strokeWidth={1.5}
        />
        <path
          d="M0 0 L4 4"
          transform={`translate(${px + 28} ${py + 47})`}
          className="stroke-slate-400"
          strokeWidth={1.5}
        />
        <Label x={px + 38} y={py + 45} size={10} tone="muted">
          Search collaboration
        </Label>
        {GROUPS.map((g, i) => {
          const gx = px + 12 + (i % 3) * 100;
          const gy = py + 66 + Math.floor(i / 3) * 66;
          return (
            <g key={g.label}>
              <rect
                x={gx}
                y={gy}
                width={92}
                height={56}
                rx={9}
                className={g.lit ? 'fill-brand-50 stroke-brand-300' : 'fill-white stroke-slate-200'}
                strokeWidth={1.5}
              />
              <rect
                x={gx + 32}
                y={gy + 9}
                width={28}
                height={22}
                rx={6}
                className={g.lit ? 'fill-brand-100' : 'fill-slate-100'}
              />
              <Label
                x={gx + 46}
                y={gy + 44}
                anchor="middle"
                size={10}
                weight={600}
                tone={g.lit ? 'accent' : 'body'}
              >
                {g.label}
              </Label>
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}

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
        <AccentBar x={x + 12} y={y + 154} w={w - 24} label="Reveal (3)" />
      </CollabCard>
    </Scene>
  );
}

// Cool to warm, as TEMPERATURE_COLORS runs (blue, cyan, lime, amber, rose),
// expressed through the house accent hues rather than the editor's hex values.
const TEMPERATURE_HUES = ['indigo', 'teal', 'emerald', 'amber', 'rose'] as const;
const HUE_FILL: Record<(typeof TEMPERATURE_HUES)[number], string> = {
  indigo: 'fill-indigo-400',
  teal: 'fill-teal-400',
  emerald: 'fill-emerald-400',
  amber: 'fill-amber-400',
  rose: 'fill-rose-400',
};
const HUE_STROKE: Record<(typeof TEMPERATURE_HUES)[number], string> = {
  indigo: 'stroke-indigo-400',
  teal: 'stroke-teal-400',
  emerald: 'stroke-emerald-400',
  amber: 'stroke-amber-400',
  rose: 'stroke-rose-400',
};

/** A temperature check: five faces, the bars they fill, and the average. */
export function TemperatureCheckCard() {
  const x = 100;
  const y = 12;
  const w = 220;
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
    <Scene w={420} h={214}>
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
      <CollabCard x={x} y={y} w={w} h={190} title="How are we feeling?" aside="10 ANSWERED">
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
              {/* The bar, rounded, easing to its share. */}
              <rect
                x={cx - 11}
                y={y + 86}
                width={22}
                height={full}
                rx={11}
                className="fill-slate-100"
              />
              {barH > 0 && (
                <rect
                  x={cx - 11}
                  y={y + 86 + full - barH}
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
          y={y + 152}
          width={trackW}
          height={6}
          rx={3}
          fill="url(#temperature-track)"
        />
        <circle
          cx={trackX + 6 + pos * (trackW - 12)}
          cy={y + 155}
          r={5.5}
          className={`fill-white ${HUE_STROKE[TEMPERATURE_HUES[Math.round(pos * 4)]!]}`}
          strokeWidth={2.5}
        />
        <Label x={trackX} y={y + 176} size={15} weight={700} tone="strong">
          3.7
        </Label>
        <Label x={x + w - 14} y={y + 176} anchor="end" size={10} tone="muted">
          from 10 people
        </Label>
      </CollabCard>
    </Scene>
  );
}

/** An idea box while it is closed: a count, nothing else, Open the box above
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
        <AccentBar x={x + 12} y={y + 40} w={w - 24} label="Open the box (7)" />
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

/** An agenda: a stepper of segments, the finished ones ticked and struck
 *  through, the current one lit with its time remaining, the total up top. */
export function AgendaCard() {
  const x = 96;
  const y = 12;
  const w = 228;
  const rows: { name: string; mins: string; state: 'done' | 'current' | 'ahead' }[] = [
    { name: 'Set the scene', mins: '5m', state: 'done' },
    { name: 'Gather input', mins: '10m', state: 'done' },
    { name: 'Discuss', mins: '15m', state: 'current' },
    { name: 'Agree actions', mins: '5m', state: 'ahead' },
  ];
  const railX = x + 24;
  return (
    <Scene w={420} h={208}>
      <CollabCard x={x} y={y} w={w} h={184} title="Retro" aside="35M">
        {/* How far through the session. */}
        <rect x={x + 12} y={y + 38} width={w - 24} height={4} rx={2} className="fill-slate-100" />
        <rect
          x={x + 12}
          y={y + 38}
          width={(w - 24) * 0.6}
          height={4}
          rx={2}
          className="fill-brand-500"
        />
        <line
          x1={railX}
          y1={y + 60}
          x2={railX}
          y2={y + 162}
          className="stroke-slate-200"
          strokeWidth={1.5}
        />
        {rows.map((r, i) => {
          const current = r.state === 'current';
          const done = r.state === 'done';
          // The current segment's row is expanded.
          const ry = y + 52 + i * 30 + (i > 2 ? 14 : 0);
          return (
            <g key={r.name}>
              {current && (
                <rect
                  x={x + 12}
                  y={ry - 6}
                  width={w - 24}
                  height={42}
                  rx={8}
                  className="fill-brand-50 stroke-brand-300"
                  strokeWidth={1.2}
                />
              )}
              {done ? (
                <g>
                  <circle cx={railX} cy={ry + 8} r={6} className="fill-brand-500" />
                  <path
                    d={`M${railX - 2.6} ${ry + 8.2}l1.8 1.8 3.4-3.6`}
                    className="fill-none stroke-white help-art-as-drawn"
                    strokeWidth={1.4}
                  />
                </g>
              ) : current ? (
                <circle cx={railX} cy={ry + 8} r={5} className="fill-brand-500" />
              ) : (
                <circle
                  cx={railX}
                  cy={ry + 8}
                  r={5}
                  className="fill-white stroke-slate-300"
                  strokeWidth={1.5}
                />
              )}
              <Label
                x={railX + 14}
                y={ry + 9}
                size={11}
                weight={current ? 700 : 500}
                tone={done ? 'muted' : current ? 'accent' : 'body'}
              >
                {r.name}
              </Label>
              {done && (
                <line
                  x1={railX + 13}
                  y1={ry + 9}
                  x2={railX + 15 + r.name.length * 5.6}
                  y2={ry + 9}
                  className="stroke-slate-400"
                  strokeWidth={1.2}
                />
              )}
              {current ? (
                <g>
                  <Label
                    x={x + w - 22}
                    y={ry + 9}
                    anchor="end"
                    size={14}
                    weight={700}
                    tone="accent"
                  >
                    6:12
                  </Label>
                  <rect
                    x={railX + 14}
                    y={ry + 22}
                    width={w - 72}
                    height={4}
                    rx={2}
                    className="fill-brand-100"
                  />
                  <rect
                    x={railX + 14}
                    y={ry + 22}
                    width={(w - 72) * 0.4}
                    height={4}
                    rx={2}
                    className="fill-brand-500"
                  />
                </g>
              ) : (
                <Label x={x + w - 22} y={ry + 9} anchor="end" size={10} weight={600} tone="muted">
                  {r.mins}
                </Label>
              )}
            </g>
          );
        })}
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

/** A roll call: the count, the avatar stack and when it was taken, then
 *  everyone as a chip, with Take again at the foot. */
export function RollCallCard() {
  const x = 100;
  const y = 12;
  const w = 220;
  const people: {
    initial: string;
    name: string;
    colour: 'brand' | 'emerald' | 'violet' | 'amber';
  }[] = [
    { initial: 'A', name: 'Alex', colour: 'brand' },
    { initial: 'R', name: 'Rae', colour: 'emerald' },
    { initial: 'P', name: 'Priya', colour: 'violet' },
    { initial: 'J', name: 'Jo', colour: 'amber' },
  ];
  return (
    <Scene w={420} h={212}>
      <CollabCard x={x} y={y} w={w} h={188} title="Design review">
        {/* The header block: count, avatar stack, time taken. */}
        <rect x={x + 12} y={y + 40} width={w - 24} height={46} rx={10} className="fill-slate-50" />
        <Label x={x + 24} y={y + 57} size={20} weight={700} tone="strong">
          4
        </Label>
        <Label x={x + 24} y={y + 75} size={10} weight={600} tone="muted">
          PRESENT
        </Label>
        {people.map((p, i) => (
          <Avatar
            key={p.initial}
            cx={x + 86 + i * 15}
            cy={y + 63}
            r={10}
            initial={p.initial}
            colour={p.colour}
          />
        ))}
        <rect x={x + w - 64} y={y + 54} width={44} height={18} rx={9} className="fill-slate-100" />
        <Label x={x + w - 42} y={y + 63.5} anchor="middle" size={10} weight={500} tone="body">
          10:04
        </Label>
        {/* Everyone, as chips. */}
        {people.map((p, i) => {
          const chipW = 88;
          const cx0 = x + 12 + (i % 2) * (chipW + 8);
          const cy0 = y + 96 + Math.floor(i / 2) * 26;
          return (
            <g key={p.name}>
              <rect x={cx0} y={cy0} width={chipW} height={22} rx={11} className="fill-slate-100" />
              <Avatar cx={cx0 + 11} cy={cy0 + 11} r={9} initial={p.initial} colour={p.colour} />
              <Label x={cx0 + 26} y={cy0 + 12} size={11} weight={500} tone="body">
                {p.name}
              </Label>
            </g>
          );
        })}
        <AccentBar x={x + 12} y={y + 156} w={w - 24} label="Take again" />
      </CollabCard>
    </Scene>
  );
}

/** A quiz mid-round: the question in the disc with the countdown ring
 *  draining round it, the answers fanned out at even angles from 12 o'clock,
 *  your own pick raised and marked You. */
export function QuizRoundCard() {
  const cx = 210;
  const cy = 128;
  const r = 52;
  const answers = ['Venus', 'Mercury', 'Mars', 'Earth'];
  const at = [
    [cx, cy - 92],
    [cx + 132, cy],
    [cx, cy + 92],
    [cx - 132, cy],
  ] as const;
  const circumference = 2 * Math.PI * (r - 4);
  return (
    <Scene w={420} h={256}>
      <circle cx={cx} cy={cy} r={r} className="fill-white stroke-brand-300" strokeWidth={2} />
      {/* The countdown ring, two thirds left. */}
      <circle
        cx={cx}
        cy={cy}
        r={r - 4}
        className="fill-none stroke-brand-500"
        strokeWidth={3}
        strokeDasharray={`${circumference * 0.66} ${circumference}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        strokeLinecap="round"
      />
      <Label x={cx} y={cy - 26} anchor="middle" size={14} weight={700} tone="strong">
        13
      </Label>
      <Label x={cx} y={cy - 6} anchor="middle" size={10} weight={700} tone="strong">
        Which planet is
      </Label>
      <Label x={cx} y={cy + 7} anchor="middle" size={10} weight={700} tone="strong">
        closest to the sun?
      </Label>
      <Label x={cx} y={cy + 26} anchor="middle" size={10} tone="muted">
        3 answered
      </Label>
      {answers.map((a, i) => {
        const [ax, ay] = at[i]!;
        const mine = i === 1;
        const w = 92;
        const h = 32;
        return (
          <g key={a}>
            <rect
              x={ax - w / 2}
              y={ay - h / 2 - (mine ? 2 : 0)}
              width={w}
              height={h}
              rx={12}
              className={mine ? 'fill-brand-50 stroke-brand-500' : 'fill-white stroke-slate-300'}
              strokeWidth={2}
            />
            <circle
              cx={ax - w / 2 + 14}
              cy={ay - (mine ? 2 : 0)}
              r={8}
              className={mine ? 'fill-brand-100' : 'fill-slate-100'}
            />
            <Label
              x={ax - w / 2 + 14}
              y={ay + 1 - (mine ? 2 : 0)}
              anchor="middle"
              size={10}
              weight={700}
              tone="strong"
            >
              {String.fromCharCode(65 + i)}
            </Label>
            <Label
              x={ax - w / 2 + 28}
              y={ay + 1 - (mine ? 2 : 0)}
              size={11}
              weight={600}
              tone="strong"
            >
              {a}
            </Label>
            {mine && (
              <g>
                <rect
                  x={ax + w / 2 - 34}
                  y={ay - h / 2 - 9}
                  width={28}
                  height={14}
                  rx={7}
                  className="fill-brand-500"
                />
                <Label
                  x={ax + w / 2 - 20}
                  y={ay - h / 2 - 1.5}
                  anchor="middle"
                  size={10}
                  weight={700}
                  tone="onAccent"
                >
                  You
                </Label>
              </g>
            )}
          </g>
        );
      })}
    </Scene>
  );
}
