// Collaborate scenes for the elements that run and record the room (palette-collaborate.tsx): the
// agenda, the decision record, the roll call and the quiz round.

import { Scene, Label, Avatar } from '@liveworkspace/help-site/art/primitives';
import { AccentBar, CollabCard } from './palette-collaborate-card';

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
        <AccentBar x={x + 12} y={y + 156} w={w - 24} label="Take Again" />
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
  const r = 54;
  // The countdown ring runs just outside the disc, as QuizFace draws it.
  const ring = r + 7;
  const answers = ['Venus', 'Mercury', 'Mars', 'Earth'];
  const at = [
    [cx, cy - 92],
    [cx + 132, cy],
    [cx, cy + 92],
    [cx - 132, cy],
  ] as const;
  const circumference = 2 * Math.PI * ring;
  return (
    <Scene w={420} h={256}>
      <circle cx={cx} cy={cy} r={r} className="fill-white stroke-brand-300" strokeWidth={2} />
      {/* The countdown ring, two thirds left. */}
      <circle
        cx={cx}
        cy={cy}
        r={ring}
        className="fill-none stroke-brand-500"
        strokeWidth={3}
        strokeDasharray={`${circumference * 0.66} ${circumference}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        strokeLinecap="round"
      />
      <Label x={cx} y={cy - 30} anchor="middle" size={14} weight={700} tone="strong">
        13
      </Label>
      <Label x={cx} y={cy - 12} anchor="middle" size={10} weight={700} tone="strong">
        Which planet
      </Label>
      <Label x={cx} y={cy} anchor="middle" size={10} weight={700} tone="strong">
        is closest to
      </Label>
      <Label x={cx} y={cy + 12} anchor="middle" size={10} weight={700} tone="strong">
        the sun?
      </Label>
      <Label x={cx} y={cy + 30} anchor="middle" size={10} tone="muted">
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
