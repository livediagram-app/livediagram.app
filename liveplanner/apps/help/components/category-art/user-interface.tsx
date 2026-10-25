import { Label } from '@liveworkspace/help-site/art/primitives';
import { Callout, Stage, Window } from '@liveworkspace/help-site/art/parts';

// The board's columns: their names, head dots, and the tag on each of their cards.
const COLUMNS = [
  { x: 26, name: 'To do', head: 'fill-slate-300', tags: ['fill-amber-300', 'fill-sky-300'] },
  { x: 108, name: 'Doing', head: 'fill-amber-400', tags: ['fill-rose-300', 'fill-sky-300'] },
  { x: 190, name: 'Done', head: 'fill-emerald-400', tags: ['fill-emerald-300'] },
];

// The bottom-right cluster's buttons and their centres, left to right (Panel Layout): Undo and Redo, then the
// card strip (Trash is left out for room), then Style.
const CLUSTER = [
  { label: '↶', x: 212 },
  { label: '↷', x: 232 },
  { label: 'New', x: 260 },
  { label: 'Find', x: 290 },
  { label: 'Types', x: 322 },
  { label: 'Style', x: 356 },
];

// User Interface: the plan editor laid out, with numbered callouts on its four fixed pieces of chrome (Panel
// Layout): the header with the plan's name, its pills and Share; the board header with the menu button, the done
// count and Filter cards; the cluster of buttons in the bottom-right corner; and the tab bar with the quick controls.
export function UserInterfaceArt() {
  return (
    <Stage>
      <Window x={14} y={10} w={372} h={200} title="Sprint 14 · liveplanner">
        {/* 1: the header. */}
        <rect x={24} y={40} width={12} height={12} rx={3} className="fill-brand-500" />
        <Label x={42} y={46.5} size={9} weight={700} tone="strong">
          Sprint 14
        </Label>
        <rect
          x={92}
          y={39}
          width={40}
          height={15}
          rx={7.5}
          className="fill-emerald-50 stroke-emerald-200"
          strokeWidth={1}
        />
        <Label x={112} y={47} anchor="middle" size={7.5} weight={600} className="fill-emerald-700">
          Shared
        </Label>
        <rect
          x={137}
          y={39}
          width={42}
          height={15}
          rx={7.5}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1}
        />
        <Label x={158} y={47} anchor="middle" size={7.5} weight={600} tone="body">
          Editing
        </Label>
        <rect x={330} y={38} width={46} height={17} rx={6} className="fill-brand-500" />
        <Label x={353} y={47} anchor="middle" size={8.5} weight={700} tone="onAccent">
          Share
        </Label>
        <line x1={14} y1={62} x2={386} y2={62} className="stroke-slate-100" strokeWidth={1} />

        {/* 2: the board header. */}
        <rect
          x={24}
          y={68}
          width={20}
          height={18}
          rx={5}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        <path
          d="M29 73.5 h10 M29 77 h10 M29 80.5 h10"
          className="stroke-slate-500"
          strokeWidth={1.3}
          strokeLinecap="round"
        />
        <Label x={52} y={77.5} size={9.5} weight={700} tone="strong">
          Board
        </Label>
        <Label x={86} y={77.5} size={8} weight={600} tone="accent">
          60% · 3 of 5
        </Label>
        <rect
          x={148}
          y={69}
          width={58}
          height={16}
          rx={5}
          className="fill-white stroke-slate-200"
          strokeWidth={1}
        />
        <Label x={177} y={77.5} anchor="middle" size={7.5} weight={600} tone="body">
          Filter cards
        </Label>
        <Label x={216} y={77.5} anchor="middle" size={11} weight={600} tone="body">
          +
        </Label>
        <circle cx={232} cy={77} r={4.5} className="fill-none stroke-slate-400" strokeWidth={1.5} />
        <circle cx={232} cy={77} r={1.5} className="fill-slate-400" />

        {/* The board. */}
        {COLUMNS.map((col) => (
          <g key={col.name}>
            <rect x={col.x} y={92} width={76} height={76} rx={6} className="fill-slate-50" />
            <circle cx={col.x + 9} cy={101} r={2.6} className={col.head} />
            <Label x={col.x + 16} y={101.5} size={8} weight={700} tone="body">
              {col.name}
            </Label>
            {col.tags.map((tag, i) => (
              <g key={i}>
                <rect
                  x={col.x + 5}
                  y={110 + i * 28}
                  width={66}
                  height={23}
                  rx={4}
                  className="fill-white stroke-slate-200"
                  strokeWidth={1}
                />
                <rect
                  x={col.x + 11}
                  y={116 + i * 28}
                  width={42}
                  height={3.5}
                  rx={1.7}
                  className="fill-slate-300"
                />
                <rect
                  x={col.x + 11}
                  y={124 + i * 28}
                  width={18}
                  height={3.5}
                  rx={1.7}
                  className={tag}
                />
              </g>
            ))}
          </g>
        ))}

        {/* 3: the bottom-right cluster. */}
        <rect
          x={196}
          y={150}
          width={180}
          height={22}
          rx={7}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        {CLUSTER.map((b) => (
          <Label
            key={b.label}
            x={b.x}
            y={161.5}
            anchor="middle"
            size={b.label.length === 1 ? 10 : 7.5}
            weight={600}
            tone="body"
          >
            {b.label}
          </Label>
        ))}

        {/* 4: the tab bar and the quick controls. */}
        <line x1={14} y1={180} x2={386} y2={180} className="stroke-slate-100" strokeWidth={1} />
        <rect
          x={24}
          y={185}
          width={44}
          height={16}
          rx={5}
          className="fill-white stroke-brand-400"
          strokeWidth={1.2}
        />
        <Label x={46} y={193.5} anchor="middle" size={7.5} weight={700} tone="accent">
          Board
        </Label>
        <rect x={72} y={185} width={46} height={16} rx={5} className="fill-slate-100" />
        <Label x={95} y={193.5} anchor="middle" size={7.5} weight={500} tone="body">
          Backlog
        </Label>
        <rect x={122} y={185} width={42} height={16} rx={5} className="fill-slate-100" />
        <Label x={143} y={193.5} anchor="middle" size={7.5} weight={500} tone="body">
          Budget
        </Label>
        <Label x={174} y={193.5} anchor="middle" size={11} weight={600} tone="muted">
          +
        </Label>
        <circle cx={330} cy={193} r={4} className="fill-none stroke-slate-500" strokeWidth={1.4} />
        <path
          d="M333 196 l3 3"
          className="stroke-slate-500"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <circle
          cx={350}
          cy={193}
          r={4.5}
          className="fill-none stroke-slate-500"
          strokeWidth={1.4}
        />
        <circle cx={350} cy={193} r={1.5} className="fill-slate-500" />
        <path d="M370 188 a5 5 0 1 0 5 7 a4 4 0 0 1 -5 -7 Z" className="fill-slate-500" />
      </Window>
      <Callout cx={24} cy={38} n={1} />
      <Callout cx={24} cy={66} n={2} />
      <Callout cx={376} cy={148} n={3} />
      <Callout cx={24} cy={183} n={4} />
    </Stage>
  );
}
