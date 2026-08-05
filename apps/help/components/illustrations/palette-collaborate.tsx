// Collaborate-category illustrations (spec/55, drawing spec/123 to spec/129 and
// spec/136): the palette's Collaborate groups, plus one scene per element that
// collects what the room thinks — comment panel, estimate card, temperature
// check, idea box, agenda, decision record and roll call.
//
// One scene per sub-article, drawn as the card really looks: a titled panel
// with the count on the right and the card's own buttons along the bottom.

import type { ReactNode } from 'react';

import { Scene, Label, TextBar, Avatar, Shape, Arrow, Panel } from './primitives';

// --- Shared card chrome ------------------------------------------------------

/** A collaboration element on the canvas: title, the count on the right, a
 *  body, and the card's own footer buttons. */
function CollabCard({
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
function CardButton({
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

/** A pressable value chip, as the estimate and temperature cards draw their
 *  scales. */
function Chip({
  x,
  y,
  value,
  mine = false,
}: {
  x: number;
  y: number;
  value: string;
  mine?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={26}
        height={22}
        rx={6}
        className={mine ? 'fill-brand-500 stroke-brand-600' : 'fill-slate-50 stroke-slate-300'}
        strokeWidth={1.5}
      />
      <Label
        x={x + 13}
        y={y + 12}
        anchor="middle"
        size={11}
        weight={700}
        tone={mine ? 'onAccent' : 'body'}
      >
        {value}
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

/** A comment panel beside the element it is about, joined by an ordinary
 *  arrow. */
export function CommentPanelCard() {
  const x = 190;
  const y = 18;
  return (
    <Scene w={420} h={210}>
      <Shape x={22} y={80} w={104} h={54} kind="rect" label="Auth service" />
      <Arrow from={[126, 107]} to={[188, 107]} />
      <CollabCard x={x} y={y} w={210} h={170} title="Comments" aside="3">
        <Avatar cx={x + 24} cy={y + 50} r={11} initial="R" colour="emerald" />
        <TextBar x={x + 42} y={y + 42} w={140} />
        <TextBar x={x + 42} y={y + 54} w={104} />
        <Avatar cx={x + 24} cy={y + 88} r={11} initial="P" colour="violet" />
        <TextBar x={x + 42} y={y + 80} w={126} />
        <TextBar x={x + 42} y={y + 92} w={88} />
        <rect
          x={x + 14}
          y={y + 108}
          width={182}
          height={22}
          rx={7}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.5}
        />
        <Label x={x + 24} y={y + 119} size={9} tone="muted">
          Add a comment…
        </Label>
        <CardButton x={x + 14} y={y + 136} w={86} label="Resolve" loud />
      </CollabCard>
    </Scene>
  );
}

/** An estimate card before the reveal: who has answered, never what they
 *  said. */
export function EstimateCard() {
  const x = 100;
  const y = 14;
  const w = 220;
  return (
    <Scene w={420} h={210}>
      <CollabCard x={x} y={y} w={w} h={182} title="Login rework" aside="3/5 answered">
        {['1', '2', '3', '5', '8', '13', '21', '?'].map((v, i) => (
          <Chip
            key={v}
            x={x + 14 + (i % 6) * 32}
            y={y + 42 + Math.floor(i / 6) * 28}
            value={v}
            mine={v === '5'}
          />
        ))}
        <Label x={x + 14} y={y + 108} size={8} weight={700} tone="muted">
          ANSWERED
        </Label>
        <Avatar cx={x + 26} cy={y + 130} r={11} initial="R" colour="emerald" />
        <Avatar cx={x + 56} cy={y + 130} r={11} initial="P" colour="violet" />
        <Avatar cx={x + 86} cy={y + 130} r={11} initial="J" colour="amber" />
        <CardButton x={x + 14} y={y + 148} w={96} label="Reveal" loud />
        <CardButton x={x + 118} y={y + 148} w={88} label="Clear" />
      </CollabCard>
    </Scene>
  );
}

/** A temperature check: five readings, the bars they fill, and the average. */
export function TemperatureCheckCard() {
  const x = 100;
  const y = 14;
  const w = 220;
  const tally = [0, 1, 4, 2, 3];
  const barTone = [
    'fill-brand-400',
    'fill-teal-400',
    'fill-emerald-400',
    'fill-amber-400',
    'fill-rose-400',
  ];
  return (
    <Scene w={420} h={210}>
      <CollabCard x={x} y={y} w={w} h={182} title="How are we feeling?" aside="10 answered">
        {['1', '2', '3', '4', '5'].map((v, i) => (
          <Chip key={v} x={x + 14 + i * 32} y={y + 42} value={v} mine={v === '4'} />
        ))}
        {tally.map((count, i) => {
          const bx = x + 14 + i * 32;
          const full = 62;
          const barH = count === 0 ? 0 : Math.max(8, (count / 4) * full);
          return (
            <g key={i}>
              <rect x={bx} y={y + 74} width={26} height={full} rx={5} className="fill-slate-100" />
              {barH > 0 && (
                <rect
                  x={bx}
                  y={y + 74 + full - barH}
                  width={26}
                  height={barH}
                  rx={5}
                  className={barTone[i]}
                />
              )}
              <Label x={bx + 13} y={y + 146} anchor="middle" size={9} tone="muted">
                {count}
              </Label>
            </g>
          );
        })}
        <Label x={x + 14} y={y + 166} size={16} weight={700} tone="strong">
          3.7
        </Label>
        <Label x={x + 46} y={y + 167} size={10} tone="muted">
          average
        </Label>
      </CollabCard>
    </Scene>
  );
}

/** An idea box while it is closed: a count, nothing else, and the two ways
 *  out of it. */
export function IdeaBoxCard() {
  const x = 100;
  const y = 16;
  const w = 220;
  return (
    <Scene w={420} h={206}>
      <CollabCard x={x} y={y} w={w} h={172} title="What slowed us down?" aside="7 ideas">
        <rect
          x={x + 60}
          y={y + 44}
          width={100}
          height={48}
          rx={8}
          className="fill-slate-50 stroke-slate-300"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <Label x={x + 110} y={y + 66} anchor="middle" size={20} weight={700} tone="accent">
          7
        </Label>
        <Label x={x + 110} y={y + 82} anchor="middle" size={8} weight={600} tone="muted">
          HELD UNTIL YOU OPEN IT
        </Label>
        <rect
          x={x + 14}
          y={y + 102}
          width={192}
          height={22}
          rx={7}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <Label x={x + 24} y={y + 113} size={9} tone="muted">
          Add an idea…
        </Label>
        <CardButton x={x + 14} y={y + 134} w={100} label="Open the box" loud />
        <CardButton x={x + 122} y={y + 134} w={84} label="Scatter" />
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
        className="fill-emerald-700"
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
