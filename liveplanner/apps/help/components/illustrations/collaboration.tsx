// Collaboration-category illustrations (docs/specs/018-help/help-app.md): one-tab sharing and
// session tools.
// Composed only from the shared primitives so the house style holds.

import { Scene, Shape, Panel, Button, Label, Tabs } from '@liveworkspace/help-site/art/primitives';

// --- Sharing ------------------------------------------------------------------

/** A visitor on a one-tab link: their tab's canvas above a tab bar where the
 *  shared tab sits between two nameless "Not shared" pills. */
export function OneTabShare() {
  const pill = (x: number, w: number, label: string, shared: boolean) => (
    <g transform={`translate(${x} 196)`}>
      <rect
        width={w}
        height={24}
        rx={7}
        className={shared ? 'fill-white stroke-brand-400' : 'fill-transparent stroke-slate-400'}
        strokeWidth={1.5}
        strokeDasharray={shared ? undefined : '4 3'}
      />
      <Label
        x={w / 2}
        y={13}
        anchor="middle"
        size={10}
        weight={600}
        tone={shared ? 'strong' : 'muted'}
      >
        {label}
      </Label>
    </g>
  );
  return (
    <Scene w={420} h={240}>
      <Shape x={70} y={60} w={112} h={56} kind="rect" label="Q3: beta" />
      <Shape x={238} y={60} w={112} h={56} kind="rect" label="Q4: launch" />
      <rect x={0} y={184} width={420} height={56} className="fill-slate-100" />
      {pill(40, 104, 'Not shared', false)}
      {pill(158, 104, 'Roadmap', true)}
      {pill(276, 104, 'Not shared', false)}
    </Scene>
  );
}

// --- Teams -------------------------------------------------------------------

// --- Session tools -----------------------------------------------------------

/** The floating timer pill: its kicker, the clock, and (for editors) pause, reset and remove.
 *  A countdown drains left to right, so the tinted part is the time left. */
/** The Session strip in the bottom bar: the Timer showing its clock over the countdown's drain
 *  (or its glyph alone, idle), then Vote with your dots left as a badge, beside the
 *  Layers and Theme strip. */
function SessionStripArt({
  x,
  y,
  time,
  left = 0.7,
  dotsLeft,
}: {
  x: number;
  y: number;
  // The running timer's clock; absent, the Timer is its glyph alone.
  time?: string;
  left?: number;
  dotsLeft: number;
}) {
  const h = 40;
  const seg = 40;
  const timerW = time ? 96 : seg;
  const w = timerW + seg;
  const glyph = 'fill-none stroke-slate-500';
  const divider = (dx: number) => (
    <line
      x1={dx}
      y1={y + 6}
      x2={dx}
      y2={y + h - 6}
      className="stroke-slate-100"
      strokeWidth={1.5}
    />
  );
  const tx = time ? x + 18 : x + seg / 2;
  const vx = x + timerW + seg / 2;
  const lx = x + w + 8;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* The countdown's drain behind the Timer segment. */}
      {time ? (
        <path
          d={`M${x + 8} ${y + 0.75} H${x + timerW * left} V${y + h - 0.75} H${x + 8} a7.25 7.25 0 0 1 -7.25 -7.25 V${y + 8} a7.25 7.25 0 0 1 7.25 -7.25 Z`}
          className="fill-brand-100"
        />
      ) : null}
      {/* Timer glyph, and the clock while one runs */}
      <circle cx={tx} cy={y + 21} r={6} className={glyph} strokeWidth={1.5} />
      <path
        d={`M${tx} ${y + 21} v-3 M${tx - 2} ${y + 12} h4`}
        className={glyph}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {time ? (
        <Label x={x + 30} y={y + 21} size={14} weight={700} tone="strong">
          {time}
        </Label>
      ) : null}
      {/* Vote: a check in a circle, with your dots left as a badge */}
      {divider(x + timerW)}
      <circle cx={vx} cy={y + 20} r={7} className={glyph} strokeWidth={1.5} />
      <path
        d={`M${vx - 3} ${y + 20} l2.5 2.5 l4 -4.5`}
        className={glyph}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <circle
        cx={vx + 8}
        cy={y + 11}
        r={6.5}
        className="fill-brand-500 stroke-white"
        strokeWidth={1.5}
      />
      <Label x={vx + 8} y={y + 11.5} anchor="middle" size={8} weight={700} tone="onAccent">
        {dotsLeft}
      </Label>
      {/* Layers and the Theme & Canvas brush, one strip to the right */}
      <rect
        x={lx}
        y={y}
        width={seg * 2}
        height={h}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <path
        d={`M${lx + 20} ${y + 12} l9 5 l-9 5 l-9 -5 Z M${lx + 11} ${y + 22} l9 5 l9 -5`}
        className={glyph}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {divider(lx + seg)}
      <path
        d={`M${lx + seg + 27} ${y + 12} l-9 9 M${lx + seg + 18} ${y + 21} c-3 0 -5 2 -5 6 c3 0 6 -1 6 -4`}
        className={glyph}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** A votable shape with the vote stepper inside its bottom-right corner: minus, the tally, plus. */
function VoteShape({
  x,
  y,
  label,
  count,
  mine = false,
}: {
  x: number;
  y: number;
  label: string;
  count: number;
  mine?: boolean;
}) {
  const w = 108;
  // Tall enough that the centred label clears the stepper in the corner.
  const h = 78;
  return (
    <g>
      <Shape x={x} y={y} w={w} h={h} kind="rect" label={label} />
      {/* The tally stepper sits inside the bottom-right corner (ElementVoteOverlay), below the label. */}
      <g transform={`translate(${x + w - 64} ${y + h - 24})`}>
        <rect
          width={58}
          height={18}
          rx={9}
          className={mine ? 'fill-brand-50 stroke-brand-300' : 'fill-white stroke-slate-300'}
          strokeWidth={1.2}
        />
        <Label x={10} y={10} anchor="middle" size={11} weight={700} tone="body">
          −
        </Label>
        <Label
          x={29}
          y={10}
          anchor="middle"
          size={10}
          weight={700}
          tone={mine ? 'accent' : 'strong'}
        >
          {count}
        </Label>
        <Label x={48} y={10} anchor="middle" size={11} weight={700} tone="body">
          +
        </Label>
      </g>
    </g>
  );
}

/** A dot vote in progress with the Session strip below: the timer's clock on its button, the
 *  Vote button lit while the vote runs. */
export function SessionTools() {
  return (
    <Scene w={420} h={230}>
      <VoteShape x={20} y={40} label="Idea A" count={3} mine />
      <VoteShape x={156} y={40} label="Idea B" count={1} />
      <VoteShape x={292} y={40} label="Idea C" count={0} />
      <SessionStripArt x={140} y={176} time="4:32" dotsLeft={2} />
    </Scene>
  );
}

/** The Timer set-up, as the bottom bar's Timer button opens it: Countdown or Stopwatch, the dial
 *  with its nudge buttons, the presets, and the start button. */
export function TimerControl() {
  const presets = ['1', '3', '5', '10', '15', '30'];
  // The dial: one lap is an hour, so a 5 minute wedge is a twelfth of it.
  const cx = 210;
  const cy = 150;
  const r = 42;
  const a = (5 / 60) * Math.PI * 2;
  const ex = cx + r * Math.sin(a);
  const ey = cy - r * Math.cos(a);
  return (
    <Scene w={420} h={316} bg="plain">
      <Panel x={88} y={10} w={244} h={298} title="Timer">
        {/* Mode toggle */}
        <Tabs x={124} y={56} items={['Countdown', 'Stopwatch']} active={0} tabW={86} />
        {/* Dial with the 5 minute wedge and its drag handle, between the nudge buttons */}
        <circle
          cx={cx}
          cy={cy}
          r={r + 10}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.5}
        />
        <path
          d={`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)} Z`}
          className="fill-brand-500"
        />
        <circle cx={cx} cy={cy} r={28} className="fill-white" />
        <circle cx={ex} cy={ey} r={5} className="fill-white stroke-brand-500" strokeWidth={2} />
        <Label x={cx} y={cy - 4} anchor="middle" size={14} weight={700} tone="strong">
          5:00
        </Label>
        <Label x={cx} y={cy + 11} anchor="middle" size={10} weight={600} tone="muted">
          Drag to set
        </Label>
        <Button x={118} y={cy - 13} w={26} h={26} label="−" />
        <Button x={276} y={cy - 13} w={26} h={26} label="+" />
        {/* Presets */}
        {presets.map((p, i) => {
          const px = 106 + i * 35;
          const on = p === '5';
          return (
            <g key={p}>
              <rect
                x={px}
                y={214}
                width={31}
                height={22}
                rx={5}
                className={on ? 'fill-brand-500' : 'fill-slate-100'}
              />
              <Label
                x={px + 15.5}
                y={225}
                anchor="middle"
                size={10}
                weight={700}
                tone={on ? 'onAccent' : 'body'}
              >
                {`${p}m`}
              </Label>
            </g>
          );
        })}
        <Button x={106} y={246} w={208} h={28} label="Start 5 min countdown" variant="primary" />
        <Label x={210} y={290} anchor="middle" size={10} tone="muted">
          Everyone on this tab sees the same clock.
        </Label>
      </Panel>
    </Scene>
  );
}

/** Dot voting in progress: each votable element's stepper with its tally (tinted where you have
 *  spent your own dots), and your dots left on the Vote button below. */
export function DotVoting() {
  return (
    <Scene w={420} h={230}>
      <VoteShape x={20} y={40} label="Reduce WIP" count={4} mine />
      <VoteShape x={156} y={40} label="Pair more" count={1} />
      <VoteShape x={292} y={40} label="Auto tests" count={2} mine />
      <SessionStripArt x={196} y={176} dotsLeft={1} />
    </Scene>
  );
}
