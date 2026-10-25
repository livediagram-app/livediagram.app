import { Avatar, DiscText, Label } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage, TickDisc } from '@liveworkspace/help-site/art/parts';

// A numbered step disc, sitting on the top edge of its card.
function Step({ cx, cy, n }: { cx: number; cy: number; n: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={11} className="fill-brand-500 stroke-white" strokeWidth={2.5} />
      <DiscText cx={cx} cy={cy} size={11} weight={800}>
        {n}
      </DiscText>
    </g>
  );
}

// The board's three columns: each one's head dot and the tags on its cards.
const COLUMNS = [
  { x: 26, head: 'fill-slate-300', tags: ['fill-amber-300', 'fill-sky-300', 'fill-emerald-300'] },
  { x: 58, head: 'fill-amber-400', tags: ['fill-sky-300', 'fill-amber-300'] },
  { x: 90, head: 'fill-emerald-400', tags: ['fill-emerald-300'] },
];

// The sheet's rows: whether its Done box is ticked, and its status pill's tone.
const ROWS = [
  { done: true, pill: 'fill-emerald-300' },
  { done: false, pill: 'fill-amber-300' },
  { done: true, pill: 'fill-emerald-300' },
  { done: false, pill: 'fill-sky-300' },
];

// Getting Started: the first three things a new person does in liveplanner, as three cards on a path. Start a
// board of cards, keep the detail in a sheet, share the link.
export function GettingStartedArt() {
  return (
    <Stage>
      <path
        d="M72 41 Q136 4 200 41 Q264 4 328 41"
        className="fill-none stroke-brand-300"
        strokeWidth={2}
        strokeDasharray="2 6"
        strokeLinecap="round"
      />

      {/* 1: start a board. Three columns of cards, one lifted on its way to Done. */}
      <Card x={18} y={52} w={108} h={140} r={12}>
        {COLUMNS.map((col) => (
          <g key={col.x}>
            <rect x={col.x} y={68} width={28} height={86} rx={5} className="fill-slate-50" />
            <circle cx={col.x + 6} cy={75} r={2.2} className={col.head} />
            <rect
              x={col.x + 11}
              y={73.5}
              width={12}
              height={3}
              rx={1.5}
              className="fill-slate-300"
            />
            {col.tags.map((tag, i) => (
              <g key={i}>
                <rect
                  x={col.x + 3}
                  y={82 + i * 22}
                  width={22}
                  height={18}
                  rx={3}
                  className="fill-white stroke-slate-200"
                  strokeWidth={1}
                />
                <rect
                  x={col.x + 6}
                  y={86 + i * 22}
                  width={14}
                  height={3}
                  rx={1.5}
                  className="fill-slate-300"
                />
                <rect x={col.x + 6} y={92 + i * 22} width={8} height={3} rx={1.5} className={tag} />
              </g>
            ))}
          </g>
        ))}
        <g transform="rotate(-6 104 118)">
          <rect
            x={92}
            y={108}
            width={24}
            height={19}
            rx={3}
            className="fill-white stroke-brand-500"
            strokeWidth={1.5}
          />
          <rect x={96} y={112} width={14} height={3} rx={1.5} className="fill-slate-300" />
          <rect x={96} y={118} width={8} height={3} rx={1.5} className="fill-amber-300" />
        </g>
        <Label x={72} y={170} anchor="middle" size={10.5} weight={700} tone="strong">
          Start a board
        </Label>
      </Card>
      <Step cx={72} cy={52} n={1} />

      {/* 2: fill a sheet. A grid with a header row, a ticked Done column, status pills, and one cell selected. */}
      <Card x={146} y={52} w={108} h={140} r={12}>
        <rect
          x={156}
          y={68}
          width={88}
          height={84}
          rx={5}
          className="fill-white stroke-slate-200"
          strokeWidth={1}
        />
        <path d="M156 73 a5 5 0 0 1 5 -5 h78 a5 5 0 0 1 5 5 v9 h-88 Z" className="fill-brand-100" />
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={[162, 192, 218][i]}
            y={73.5}
            width={[20, 16, 18][i]}
            height={3}
            rx={1.5}
            className="fill-brand-400"
          />
        ))}
        {ROWS.map((row, i) => {
          const y = 82 + i * 17.5;
          return (
            <g key={i}>
              <line x1={156} y1={y} x2={244} y2={y} className="stroke-slate-200" strokeWidth={1} />
              <rect
                x={162}
                y={y + 7}
                width={i === 1 ? 16 : 22}
                height={3.5}
                rx={1.7}
                className="fill-slate-300"
              />
              {row.done ? (
                <TickDisc cx={200} cy={y + 8.8} r={4.5} />
              ) : (
                <rect
                  x={195.5}
                  y={y + 4.3}
                  width={9}
                  height={9}
                  rx={2}
                  className="fill-white stroke-slate-300"
                  strokeWidth={1}
                />
              )}
              <rect x={216} y={y + 5.5} width={22} height={6.5} rx={3.2} className={row.pill} />
            </g>
          );
        })}
        <line x1={188} y1={68} x2={188} y2={152} className="stroke-slate-200" strokeWidth={1} />
        <line x1={212} y1={68} x2={212} y2={152} className="stroke-slate-200" strokeWidth={1} />
        {/* The selected cell. */}
        <rect
          x={156}
          y={117}
          width={32}
          height={17.5}
          className="fill-none stroke-brand-500"
          strokeWidth={2}
        />
        <rect x={185} y={131.5} width={5} height={5} className="fill-brand-500 stroke-white" />
        <Label x={200} y={170} anchor="middle" size={10.5} weight={700} tone="strong">
          Fill a sheet
        </Label>
      </Card>
      <Step cx={200} cy={52} n={2} />

      {/* 3: share the link. */}
      <Card x={274} y={52} w={108} h={140} r={12}>
        <rect
          x={284}
          y={76}
          width={88}
          height={22}
          rx={6}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.2}
        />
        <path
          d="M291 87 a3 3 0 0 1 3 -3 h3 M301 87 a3 3 0 0 1 -3 3 h-3 M293 87 h6"
          className="fill-none stroke-brand-500"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <rect x={306} y={84.5} width={54} height={5} rx={2.5} className="fill-slate-300" />
        <rect x={292} y={106} width={72} height={20} rx={6} className="fill-brand-500" />
        <Label x={328} y={116.5} anchor="middle" size={9.5} weight={700} tone="onAccent">
          Copy link
        </Label>
        <Avatar cx={302} cy={145} r={9} initial="A" colour="emerald" />
        <Avatar cx={316} cy={145} r={9} initial="T" colour="amber" />
        <Avatar cx={330} cy={145} r={9} initial="R" colour="rose" />
        <TickDisc cx={356} cy={145} r={8} />
        <Label x={328} y={170} anchor="middle" size={10.5} weight={700} tone="strong">
          Share it
        </Label>
      </Card>
      <Step cx={328} cy={52} n={3} />
    </Stage>
  );
}
