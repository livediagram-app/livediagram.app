// Collaborate-category illustrations (docs/specs/018-help/help-app.md, drawing docs/specs/012-collaboration/estimate-card.md to docs/specs/012-collaboration/roll-call.md and
// docs/specs/012-collaboration/comment-pin.md): the palette's Collaborate groups, plus one scene per element that
// collects what the room thinks — comment panel, estimate card, temperature
// check, idea box, agenda, decision record and roll call.
//
// One scene per sub-article, drawn as the card really looks: a titled panel
// with the count on the right and the card's own buttons along the bottom.

import type { ReactNode } from 'react';

import { Scene, Label, TextBar, Avatar, Panel } from './primitives';

// --- Shared card chrome ------------------------------------------------------

/** A collaboration element on the canvas: title, the count on the right, a
 *  body, and the card's own footer buttons. */
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
        <Label x={x + w - 14} y={y + 19} anchor="end" size={9} weight={600} tone="muted">
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

/** A card footer button: loud for the one the card is for, quiet beside it. */
export function CardButton({
  x,
  y,
  w,
  label,
  loud = false,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  loud?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={22}
        rx={7}
        className={loud ? 'fill-brand-500 stroke-brand-600' : 'fill-slate-50 stroke-slate-300'}
        strokeWidth={1.5}
      />
      <Label
        x={x + w / 2}
        y={y + 12}
        anchor="middle"
        size={10}
        weight={600}
        tone={loud ? 'onAccent' : 'body'}
      >
        {label}
      </Label>
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------

/** The Collaborate tab: the comment panel loose at the top, then the two
 *  groups you click into. */
export function CollaborateGroups() {
  const px = 62;
  const py = 12;
  return (
    <Scene w={420} h={210} bg="plain">
      <Panel x={px} y={py} w={296} h={180} title="COLLABORATE">
        <rect
          x={px + 12}
          y={py + 32}
          width={272}
          height={34}
          rx={8}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <rect x={px + 22} y={py + 41} width={16} height={13} rx={3} className="fill-brand-100" />
        <Label x={px + 48} y={py + 44} size={10} weight={600} tone="strong">
          Comment panel
        </Label>
        <Label x={px + 48} y={py + 57} size={8} tone="muted">
          A whole thread, left out on the board
        </Label>
        {[
          { label: 'Ask the room', blurb: 'Estimates, temperature, ideas' },
          { label: 'Keep a record', blurb: 'Agenda, decision, roll call' },
        ].map((g, i) => {
          const gx = px + 12 + i * 140;
          return (
            <g key={g.label}>
              <rect
                x={gx}
                y={py + 78}
                width={128}
                height={78}
                rx={9}
                className="fill-white stroke-slate-200"
                strokeWidth={1.5}
              />
              <rect
                x={gx + 48}
                y={py + 92}
                width={32}
                height={26}
                rx={6}
                className="fill-brand-50 stroke-brand-200"
                strokeWidth={1.5}
              />
              <Label x={gx + 64} y={py + 130} anchor="middle" size={10} weight={600} tone="body">
                {g.label}
              </Label>
              <Label x={gx + 64} y={py + 144} anchor="middle" size={8} tone="muted">
                {g.blurb}
              </Label>
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}

/** An estimate card before the reveal: who has answered, never what they
 *  said. */
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
        {/* The one action, the dashed accent bar. */}
        <rect
          x={x + 12}
          y={y + 40}
          width={w - 24}
          height={20}
          rx={7}
          className="fill-brand-50 stroke-brand-300"
          strokeWidth={1.2}
          strokeDasharray="4 3"
        />
        <Label x={cx} y={y + 50} anchor="middle" size={9} weight={600} tone="accent">
          Reveal (3)
        </Label>
        {/* The scale as cards, yours lifted in the accent. */}
        {values.map((v, i) => {
          const mine = v === '5';
          const bx = left + i * (cw + gap);
          return (
            <g key={v}>
              <rect
                x={bx}
                y={y + (mine ? 66 : 68)}
                width={cw}
                height={30}
                rx={6}
                className={mine ? 'fill-brand-500' : 'fill-slate-50 stroke-slate-200'}
                strokeWidth={1.2}
              />
              <Label
                x={bx + cw / 2}
                y={y + (mine ? 81 : 83)}
                anchor="middle"
                size={9.5}
                weight={700}
                tone={mine ? 'onAccent' : 'strong'}
              >
                {v}
              </Label>
            </g>
          );
        })}
        {/* Who has answered: face-down cards with their avatars. */}
        {hands.map((h, i) => {
          const hx = cx - 36 + i * 26;
          return (
            <g key={h.initial}>
              <rect
                x={hx}
                y={y + 110}
                width={20}
                height={28}
                rx={5}
                className="fill-brand-100 stroke-brand-300"
                strokeWidth={1}
              />
              <Avatar cx={hx + 10} cy={y + 140} r={6} initial={h.initial} colour={h.colour} />
            </g>
          );
        })}
        <Label x={cx} y={y + 160} anchor="middle" size={8} weight={600} tone="muted">
          3 of 5 in
        </Label>
        <rect x={cx - 50} y={y + 167} width={100} height={4} rx={2} className="fill-slate-100" />
        <rect x={cx - 50} y={y + 167} width={60} height={4} rx={2} className="fill-brand-500" />
      </CollabCard>
    </Scene>
  );
}

/** A temperature check: five readings, the bars they fill, and the average. */
export function TemperatureCheckCard() {
  const x = 100;
  const y = 12;
  const w = 220;
  const tally = [0, 1, 4, 2, 3];
  const hues = ['#60a5fa', '#22d3ee', '#a3e635', '#fbbf24', '#fb7185'];
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
          {hues.map((c, i) => (
            <stop key={c} offset={`${i * 25}%`} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <CollabCard x={x} y={y} w={w} h={190} title="How are we feeling?" aside="10 ANSWERED">
        {tally.map((count, i) => {
          const bx = left + i * (col + gap);
          const mine = i === 3;
          const cx = bx + col / 2;
          const full = 58;
          const barH = count === 0 ? 0 : Math.max(8, (count / 4) * full);
          return (
            <g key={i}>
              {/* The face tile, yours lifted in its own colour. */}
              <rect
                x={bx}
                y={y + (mine ? 38 : 40)}
                width={col}
                height={36}
                rx={8}
                fill={mine ? hues[i] : undefined}
                fillOpacity={mine ? 0.18 : undefined}
                stroke={mine ? hues[i] : undefined}
                className={mine ? undefined : 'fill-slate-50 stroke-slate-200'}
                strokeWidth={1.2}
              />
              <g
                transform={`translate(${cx} ${y + (mine ? 52 : 54)})`}
                className={mine ? undefined : 'stroke-slate-500'}
                stroke={mine ? hues[i] : undefined}
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
                size={8}
                weight={700}
                tone="strong"
              >
                {String(i + 1)}
              </Label>
              {/* The bar, rounded, easing to its share. */}
              <rect
                x={cx - 11}
                y={y + 88}
                width={22}
                height={full}
                rx={11}
                className="fill-slate-100"
              />
              {barH > 0 && (
                <rect
                  x={cx - 11}
                  y={y + 88 + full - barH}
                  width={22}
                  height={barH}
                  rx={Math.min(11, barH / 2)}
                  fill={hues[i]}
                />
              )}
            </g>
          );
        })}
        {/* The mood meter, the marker at the average. */}
        <rect
          x={trackX}
          y={y + 154}
          width={trackW}
          height={6}
          rx={3}
          fill="url(#temperature-track)"
        />
        <circle
          cx={trackX + 6 + pos * (trackW - 12)}
          cy={y + 157}
          r={5.5}
          className="fill-white"
          stroke={hues[Math.round(pos * 4)]}
          strokeWidth={2.5}
        />
        <Label x={trackX} y={y + 178} size={15} weight={700} tone="strong">
          3.7
        </Label>
        <Label x={x + w - 14} y={y + 178} anchor="end" size={9} tone="muted">
          from 10 people
        </Label>
      </CollabCard>
    </Scene>
  );
}

/** An idea box while it is closed: a count, nothing else, and the two ways
 *  out of it. */
export function IdeaBoxCard() {
  const x = 100;
  const y = 12;
  const w = 220;
  const cx = x + w / 2;
  return (
    <Scene w={420} h={222}>
      <CollabCard x={x} y={y} w={w} h={198} title="What slowed us down?" aside="7 IDEAS">
        {/* The facilitator's one action, the Q&A board's dashed accent bar. */}
        <rect
          x={x + 12}
          y={y + 40}
          width={w - 24}
          height={22}
          rx={7}
          className="fill-brand-50 stroke-brand-300"
          strokeWidth={1.2}
          strokeDasharray="4 3"
        />
        <Label x={cx} y={y + 51} anchor="middle" size={9.5} weight={600} tone="accent">
          Open the box (7)
        </Label>
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
        <Label x={cx} y={y + 113} anchor="middle" size={18} weight={700} tone="strong">
          7
        </Label>
        <Label x={cx} y={y + 131} anchor="middle" size={8.5} weight={600} tone="muted">
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
        <Label x={x + 22} y={y + 164} size={9} tone="muted">
          Add an idea…
        </Label>
        <circle cx={x + w - 25} cy={y + 164} r={8} className="fill-brand-500" />
        <path
          d={`M${x + w - 25} ${y + 168}v-7M${x + w - 28} ${y + 164}l3-3 3 3`}
          className="fill-none stroke-white"
          strokeWidth={1.3}
        />
        <rect x={x + 18} y={y + 174} width={56} height={11} rx={5.5} className="fill-brand-50" />
        <Label x={x + 46} y={y + 180} anchor="middle" size={7} weight={600} tone="accent">
          Anonymous
        </Label>
      </CollabCard>
    </Scene>
  );
}

/** An agenda: segments with their minutes, one struck through, one running. */
export function AgendaCard() {
  const x = 96;
  const y = 12;
  const w = 228;
  const rows: { name: string; mins: string; state: 'done' | 'current' | 'ahead' }[] = [
    { name: 'Set the scene', mins: '5m', state: 'done' },
    { name: 'Silent writing', mins: '10m', state: 'done' },
    { name: 'Group and discuss', mins: '15m', state: 'current' },
    { name: 'Actions', mins: '10m', state: 'ahead' },
  ];
  return (
    <Scene w={420} h={200}>
      <CollabCard x={x} y={y} w={w} h={172} title="Retro" aside="40m total">
        {rows.map((r, i) => {
          const ry = y + 42 + i * 32;
          const current = r.state === 'current';
          const done = r.state === 'done';
          return (
            <g key={r.name}>
              <rect
                x={x + 12}
                y={ry}
                width={w - 24}
                height={26}
                rx={7}
                className={
                  current ? 'fill-brand-50 stroke-brand-300' : 'fill-white stroke-slate-200'
                }
                strokeWidth={1.5}
              />
              <Label
                x={x + 24}
                y={ry + 13}
                size={11}
                weight={current ? 700 : 500}
                tone={done ? 'muted' : current ? 'accent' : 'body'}
              >
                {r.name}
              </Label>
              {done && (
                <line
                  x1={x + 22}
                  y1={ry + 13}
                  x2={x + 24 + r.name.length * 5.6}
                  y2={ry + 13}
                  className="stroke-slate-400"
                  strokeWidth={1.2}
                />
              )}
              <Label
                x={x + w - 24}
                y={ry + 13}
                anchor="end"
                size={10}
                weight={600}
                tone={current ? 'accent' : 'muted'}
              >
                {current ? '6:12' : r.mins}
              </Label>
            </g>
          );
        })}
      </CollabCard>
    </Scene>
  );
}

/** A decision record: the statement, its status chip, the drivers and the
 *  date. */
export function DecisionRecordCard() {
  const x = 90;
  const y = 20;
  const w = 240;
  return (
    <Scene w={420} h={196}>
      <rect
        x={x}
        y={y}
        width={w}
        height={152}
        rx={11}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <rect x={x + w - 82} y={y + 12} width={68} height={17} rx={8} className="fill-emerald-100" />
      <Label
        x={x + w - 48}
        y={y + 21}
        anchor="middle"
        size={8}
        weight={700}
        className="fill-emerald-700 dark:fill-emerald-300"
      >
        ACCEPTED
      </Label>
      <Label x={x + 14} y={y + 22} size={12} weight={700} tone="strong">
        Use D1 for durable
      </Label>
      <Label x={x + 14} y={y + 38} size={12} weight={700} tone="strong">
        storage
      </Label>
      <line
        x1={x}
        y1={y + 52}
        x2={x + w}
        y2={y + 52}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={x + 14} y={y + 70} size={8} weight={700} tone="muted">
        DRIVERS
      </Label>
      <TextBar x={x + 14} y={y + 84} w={196} />
      <TextBar x={x + 14} y={y + 98} w={162} />
      <TextBar x={x + 14} y={y + 112} w={184} />
      <Label x={x + 14} y={y + 136} size={10} tone="muted">
        12 March 2026
      </Label>
    </Scene>
  );
}

/** A roll call: who was in the room at the moment the roll was taken. */
export function RollCallCard() {
  const x = 104;
  const y = 16;
  const w = 212;
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
    <Scene w={420} h={196}>
      <CollabCard x={x} y={y} w={w} h={164} title="Roll call" aside="4 present">
        <Label x={x + 14} y={y + 44} size={9} tone="muted">
          12 March 2026, 10:04
        </Label>
        {people.map((p, i) => {
          const rx = x + 14 + (i % 2) * 96;
          const ry = y + 68 + Math.floor(i / 2) * 30;
          return (
            <g key={p.name}>
              <Avatar cx={rx + 11} cy={ry} r={10} initial={p.initial} colour={p.colour} />
              <Label x={rx + 28} y={ry + 1} size={11} tone="body">
                {p.name}
              </Label>
            </g>
          );
        })}
        <CardButton x={x + 14} y={y + 128} w={w - 28} label="Take again" />
      </CollabCard>
    </Scene>
  );
}
