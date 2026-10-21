import { FONT, TEAMMATE, at } from '@/components/art-tokens';
import { CursorMark } from '@/components/hero-cursor';

// The hero's Forms window (docs/specs/019-marketing/marketing-site.md "Hero"): an RSVP form (docs/specs/030-forms/
// forms.md) beside the Sheet its responses go to. The form builds, its cover, heading and questions landing; a guest
// fills it in (their name typed, Yes picked, Vegan ticked) and presses Submit; their answers land as a new row in
// the Sheet, and two more responses follow, the count ticking up. Every piece plays at its own --d
// (hero-mode-animations.css); a phone draws the form over the Sheet.

// The script, in seconds.
const T = {
  card: 0.1,
  cover: 0.3,
  heading: 0.6,
  questions: 1.1, // first; the rest follow 0.2s apart
  sheet: 1.6,
  rows: 1.9, // the responses already in, 0.15s apart
  name: 2.6, // the guest reaches the name box
  typed: 3.0,
  yes: 3.8,
  vegan: 4.6,
  submit: 5.4,
  pressed: 5.9,
  landed: 6.3,
  more: [7.3, 7.9],
} as const;

const NAME = 'Sam';
const EARLIER = [
  { name: 'Ada', coming: 'Yes', diet: '' },
  { name: 'Ben', coming: 'Maybe', diet: 'Gluten free' },
  { name: 'Cy', coming: 'No', diet: '' },
] as const;
const LATER = [
  { name: 'Dee', coming: 'Yes', diet: 'Vegan' },
  { name: 'Eli', coming: 'Yes', diet: '' },
] as const;

type Layout = {
  form: { x: number; y: number; w: number };
  sheet: { x: number; y: number; w: number };
};
const LANDSCAPE: Layout = { form: { x: 30, y: -48, w: 260 }, sheet: { x: 312, y: -20, w: 270 } };
const PORTRAIT: Layout = { form: { x: 30, y: -34, w: 300 }, sheet: { x: 30, y: 270, w: 300 } };

// The form's parts, from its card's top left.
const Q = { name: 92, coming: 140, diet: 200, submit: 252 } as const;

// A cursor that glides from one stop to the next (hm-cursor), leaving as the next takes over.
function Stop({
  from,
  to,
  d,
  out,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  d: number;
  out?: number;
}) {
  const cursor = (
    <g
      className="hm-cursor"
      style={at(d, {
        '--sx': `${from.x}px`,
        '--sy': `${from.y}px`,
        '--cx': `${to.x}px`,
        '--cy': `${to.y}px`,
      })}
      aria-hidden
    >
      <CursorMark colour={TEAMMATE} label="Guest" badge="name" />
    </g>
  );
  return out === undefined ? (
    cursor
  ) : (
    <g className="hm-out" style={at(out)}>
      {cursor}
    </g>
  );
}

// A choice: a radio or a box, its label beside it, filled once picked.
function Choice({
  x,
  y,
  label,
  kind,
  picked,
}: {
  x: number;
  y: number;
  label: string;
  kind: 'radio' | 'box';
  picked?: number;
}) {
  return (
    <g>
      {kind === 'radio' ? (
        <circle
          cx={x + 5}
          cy={y - 3.5}
          r="5"
          fill="none"
          className="stroke-slate-300 dark:stroke-slate-600"
        />
      ) : (
        <rect
          x={x}
          y={y - 8.5}
          width="10"
          height="10"
          rx="2"
          fill="none"
          className="stroke-slate-300 dark:stroke-slate-600"
        />
      )}
      {picked !== undefined ? (
        <g className="hm-pop" style={at(picked)}>
          {kind === 'radio' ? (
            <circle cx={x + 5} cy={y - 3.5} r="3" fill="#7c3aed" />
          ) : (
            <>
              <rect x={x} y={y - 8.5} width="10" height="10" rx="2" fill="#7c3aed" />
              <path
                d={`M${x + 2.5} ${y - 3.5}L${x + 4.5} ${y - 1.5}L${x + 8} ${y - 6}`}
                stroke="#ffffff"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
            </>
          )}
        </g>
      ) : null}
      <text
        x={x + 15}
        y={y}
        fontFamily={FONT}
        fontSize="9.5"
        className="fill-(--art-text) dark:fill-slate-100"
      >
        {label}
      </text>
    </g>
  );
}

function Form({ l }: { l: Layout }) {
  const { x, y, w } = l.form;
  const prompt = (dy: number, text: string, i: number) => (
    <text
      className="hm-fade fill-(--art-text) dark:fill-slate-100"
      style={at(T.questions + i * 0.2)}
      x={x + 16}
      y={y + dy}
      fontFamily={FONT}
      fontSize="10.5"
      fontWeight="600"
    >
      {text}
    </text>
  );
  return (
    <>
      <g className="hm-fade" style={at(T.card)}>
        <rect
          x={x}
          y={y}
          width={w}
          height="290"
          rx="10"
          className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
          style={{ filter: 'drop-shadow(0 4px 10px rgb(15 23 42 / 0.08))' }}
        />
      </g>
      <defs>
        <linearGradient id="hf-cover" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#f9a8d4" />
        </linearGradient>
      </defs>
      <path
        className="hm-fade"
        style={at(T.cover)}
        d={`M${x} ${y + 10}A10 10 0 0 1 ${x + 10} ${y}H${x + w - 10}A10 10 0 0 1 ${x + w} ${y + 10}V${y + 34}H${x}Z`}
        fill="url(#hf-cover)"
      />
      <text
        className="hm-type fill-(--art-text) dark:fill-slate-100"
        style={at(T.heading, { '--steps': 12 })}
        x={x + 16}
        y={y + 56}
        fontFamily={FONT}
        fontSize="15"
        fontWeight="800"
      >
        Summer party
      </text>
      <text
        className="hm-fade fill-slate-500 dark:fill-slate-400"
        style={at(T.heading + 0.4)}
        x={x + 16}
        y={y + 72}
        fontFamily={FONT}
        fontSize="9"
      >
        Let us know by Friday.
      </text>

      {/* Name: its box, the guest's name typed in. */}
      {prompt(Q.name, 'Name *', 0)}
      <g className="hm-fade" style={at(T.questions)}>
        <rect
          x={x + 16}
          y={y + Q.name + 6}
          width={w - 32}
          height="22"
          rx="5"
          fill="none"
          className="stroke-slate-300 dark:stroke-slate-600"
        />
      </g>
      <text
        className="hm-type fill-(--art-text) dark:fill-slate-100"
        style={at(T.typed, { '--steps': NAME.length })}
        x={x + 24}
        y={y + Q.name + 21}
        fontFamily={FONT}
        fontSize="10"
      >
        {NAME}
      </text>

      {/* Coming? and Dietary needs: Yes picked, Vegan ticked. */}
      {prompt(Q.coming, 'Coming?', 1)}
      <g className="hm-fade" style={at(T.questions + 0.2)}>
        <Choice x={x + 16} y={y + Q.coming + 22} label="Yes" kind="radio" picked={T.yes + 0.3} />
        <Choice x={x + 70} y={y + Q.coming + 22} label="No" kind="radio" />
        <Choice x={x + 120} y={y + Q.coming + 22} label="Maybe" kind="radio" />
      </g>
      {prompt(Q.diet, 'Dietary needs', 2)}
      <g className="hm-fade" style={at(T.questions + 0.4)}>
        <Choice x={x + 16} y={y + Q.diet + 22} label="Vegan" kind="box" picked={T.vegan + 0.3} />
        <Choice x={x + 84} y={y + Q.diet + 22} label="Gluten free" kind="box" />
      </g>

      {/* Submit, at the bottom right; pressed, it rings. */}
      <g className="hm-fade" style={at(T.questions + 0.6)}>
        <rect x={x + w - 82} y={y + Q.submit} width="66" height="24" rx="6" fill="#7c3aed" />
        <text
          x={x + w - 49}
          y={y + Q.submit + 16}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="10"
          fontWeight="700"
          fill="#ffffff"
        >
          Submit
        </text>
      </g>
      <rect
        className="hm-pop"
        style={at(T.pressed)}
        x={x + w - 85}
        y={y + Q.submit - 3}
        width="72"
        height="30"
        rx="8"
        fill="none"
        stroke="#c4b5fd"
        strokeWidth="2"
      />
    </>
  );
}

// The responses Sheet: its columns, the responses already in, then each new one landing as a row.
function Responses({ l }: { l: Layout }) {
  const { x, y, w } = l.sheet;
  const cols = [
    { head: '#', w: 26 },
    { head: 'Name', w: 70 },
    { head: 'Coming?', w: 70 },
    { head: 'Dietary needs', w: w - 166 },
  ];
  const colX = (c: number) => x + cols.slice(0, c).reduce((s, col) => s + col.w, 0);
  const rowY = (r: number) => y + 40 + r * 24;
  const row = (r: number, values: readonly string[], bold = false) =>
    values.map((v, c) => (
      <text
        key={c}
        x={colX(c) + 8}
        y={rowY(r) + 16}
        fontFamily={FONT}
        fontSize="9.5"
        fontWeight={bold ? 700 : 500}
        className="fill-(--art-text) dark:fill-slate-100"
      >
        {v}
      </text>
    ));
  const all = [...EARLIER, { name: NAME, coming: 'Yes', diet: 'Vegan' }, ...LATER];
  const landsAt = (i: number) =>
    i < EARLIER.length
      ? T.rows + i * 0.15
      : i === EARLIER.length
        ? T.landed
        : T.more[i - EARLIER.length - 1]!;
  const counts = [
    { n: EARLIER.length, from: T.sheet },
    { n: EARLIER.length + 1, from: T.landed },
    { n: EARLIER.length + 2, from: T.more[0] },
    { n: EARLIER.length + 3, from: T.more[1] },
  ];
  return (
    <>
      <g className="hm-fade" style={at(T.sheet)}>
        <text
          x={x}
          y={y + 12}
          fontFamily={FONT}
          fontSize="11"
          fontWeight="700"
          className="fill-(--art-text) dark:fill-slate-100"
        >
          Summer party Responses
        </text>
        <rect
          x={x}
          y={y + 18}
          width={w}
          height={22 + (all.length + 1) * 24}
          rx="6"
          className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        />
        <rect
          x={x}
          y={y + 18}
          width={w}
          height="22"
          rx="6"
          className="fill-slate-100 dark:fill-slate-800"
        />
        {cols.map((col, c) => (
          <text
            key={col.head}
            x={colX(c) + 8}
            y={y + 33}
            fontFamily={FONT}
            fontSize="9"
            fontWeight="700"
            className="fill-slate-600 dark:fill-slate-300"
          >
            {col.head}
          </text>
        ))}
      </g>
      {counts.map((c, i) => {
        const label = (
          <text
            className="hm-pop fill-slate-500 dark:fill-slate-400"
            style={at(c.from)}
            x={x + w}
            y={y + 12}
            textAnchor="end"
            fontFamily={FONT}
            fontSize="9.5"
            fontWeight="600"
          >
            {c.n} responses
          </text>
        );
        const next = counts[i + 1];
        return next ? (
          <g key={c.n} className="hm-out" style={at(next.from - 0.05)}>
            {label}
          </g>
        ) : (
          <g key={c.n}>{label}</g>
        );
      })}
      {all.map((r, i) => (
        <g key={r.name} className="hm-pop" style={at(landsAt(i))}>
          {i >= EARLIER.length ? (
            <rect
              className="hm-out"
              style={at(landsAt(i) + 1.2)}
              x={x + 1}
              y={rowY(i)}
              width={w - 2}
              height="24"
              fill="#7c3aed"
              fillOpacity="0.1"
            />
          ) : null}
          {row(i, [String(i + 1), r.name, r.coming, r.diet])}
        </g>
      ))}
    </>
  );
}

function Scene({ l }: { l: Layout }) {
  const { x, y, w } = l.form;
  const nameAt = { x: x + 120, y: y + Q.name + 18 };
  const yesAt = { x: x + 22, y: y + Q.coming + 20 };
  const veganAt = { x: x + 22, y: y + Q.diet + 20 };
  const submitAt = { x: x + w - 40, y: y + Q.submit + 14 };
  return (
    <>
      {/* The Plan tab's surface, edge to edge under the toolbar row. */}
      <rect
        className="hm-fade fill-slate-50 dark:fill-slate-950"
        style={at(T.card)}
        x="-600"
        y="-60"
        width="1800"
        height="1200"
      />
      <Form l={l} />
      <Responses l={l} />
      {/* The guest: to the name box, then Yes, Vegan and Submit. */}
      <Stop from={{ x: nameAt.x + 140, y: nameAt.y + 160 }} to={nameAt} d={T.name} out={T.yes} />
      <Stop from={nameAt} to={yesAt} d={T.yes - 0.02} out={T.vegan} />
      <Stop from={yesAt} to={veganAt} d={T.vegan - 0.02} out={T.submit} />
      <Stop from={veganAt} to={submitAt} d={T.submit - 0.02} />
    </>
  );
}

export function FormBoard({ portrait = false }: { portrait?: boolean }) {
  return <Scene l={portrait ? PORTRAIT : LANDSCAPE} />;
}
