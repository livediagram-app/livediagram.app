import type { ReactNode } from 'react';
import { Label } from '@/components/illustrations/primitives';
import { Window, Stage } from './parts';

const G = 'fill-none stroke-current';

// The sidebar's rows, each with its glyph drawn about its centre.
const ROWS: { label: string; glyph: ReactNode }[] = [
  {
    label: 'Home',
    glyph: (
      <path d="M-5 0 L0 -5 L5 0 V5 H-5 Z" className={G} strokeWidth={1.3} strokeLinejoin="round" />
    ),
  },
  {
    label: 'Recent',
    glyph: (
      <>
        <circle r={5} className={G} strokeWidth={1.3} />
        <path d="M0 -2.5 V0 L2 1.5" className={G} strokeWidth={1.3} strokeLinecap="round" />
      </>
    ),
  },
  {
    label: 'Shared',
    glyph: (
      <>
        <circle cx={-2} cy={-2} r={2.2} className={G} strokeWidth={1.2} />
        <path
          d="M-6 5 a4 4 0 0 1 8 0 M2.5 -3 a2 2 0 1 1 0 3.5 M3.5 2 a3.5 3.5 0 0 1 3 3"
          className={G}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
      </>
    ),
  },
  {
    label: 'My Work',
    glyph: (
      <path
        d="M-5.5 -4 h4 l1.5 1.5 h5.5 v7 h-11 Z"
        className={G}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    ),
  },
  {
    label: 'Team Spaces',
    glyph: (
      <>
        <circle cx={-2.5} cy={-1.5} r={2.3} className={G} strokeWidth={1.2} />
        <circle cx={3} cy={-1.5} r={2.3} className={G} strokeWidth={1.2} />
        <path
          d="M-6 5 a3.5 3.5 0 0 1 7 0 M-0.5 5 a3.5 3.5 0 0 1 7 0"
          className={G}
          strokeWidth={1.2}
        />
      </>
    ),
  },
  {
    label: 'Images',
    glyph: (
      <>
        <rect x={-5.5} y={-4.5} width={11} height={9} rx={1.5} className={G} strokeWidth={1.3} />
        <path
          d="M-5 3.5 l3.5 -3.5 2.5 2.5 2 -2 3 3"
          className={G}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      </>
    ),
  },
];

const DOCS: { title: string; kind: 'flow' | 'board' | 'slide' | 'sticky' | 'tree' | 'sheet' }[] = [
  { title: 'Roadmap', kind: 'board' },
  { title: 'System map', kind: 'flow' },
  { title: 'Team retro', kind: 'sticky' },
  { title: 'Kickoff deck', kind: 'slide' },
  { title: 'Org chart', kind: 'tree' },
  { title: 'Budget', kind: 'sheet' },
];

// A tiny drawing of a project's content inside its card's thumbnail, in the box (x, y, 64 by 34).
function Thumb({ x, y, kind }: { x: number; y: number; kind: (typeof DOCS)[number]['kind'] }) {
  switch (kind) {
    case 'board':
      return (
        <g>
          {[0, 1, 2].map((c) => (
            <g key={c}>
              <rect
                x={x + 6 + c * 19}
                y={y + 6}
                width={16}
                height={4}
                rx={2}
                className={['fill-violet-300', 'fill-amber-300', 'fill-emerald-300'][c]}
              />
              <rect
                x={x + 6 + c * 19}
                y={y + 13}
                width={16}
                height={7}
                rx={1.5}
                className="fill-white stroke-slate-200"
                strokeWidth={0.8}
              />
              {c < 2 && (
                <rect
                  x={x + 6 + c * 19}
                  y={y + 23}
                  width={16}
                  height={7}
                  rx={1.5}
                  className="fill-white stroke-slate-200"
                  strokeWidth={0.8}
                />
              )}
            </g>
          ))}
        </g>
      );
    case 'flow':
      return (
        <g>
          <rect
            x={x + 6}
            y={y + 12}
            width={16}
            height={11}
            rx={2}
            className="fill-white stroke-brand-400"
            strokeWidth={1}
          />
          <path
            d={`M${x + 32} ${y + 7} l8 10.5 -8 10.5 -8 -10.5 Z`}
            className="fill-white stroke-brand-400"
            strokeWidth={1}
          />
          <rect x={x + 46} y={y + 12} width={14} height={11} rx={2} className="fill-brand-400" />
          <path
            d={`M${x + 22} ${y + 17.5} h2 M${x + 40} ${y + 17.5} h6`}
            className="stroke-brand-400"
            strokeWidth={1}
          />
        </g>
      );
    case 'sticky':
      return (
        <g className="help-art-as-drawn">
          {[
            ['fill-amber-200', 8, 6],
            ['fill-rose-200', 26, 9],
            ['fill-emerald-200', 44, 5],
            ['fill-violet-200', 17, 19],
            ['fill-amber-200', 36, 20],
          ].map(([c, dx, dy], i) => (
            <rect
              key={i}
              x={x + (dx as number)}
              y={y + (dy as number)}
              width={13}
              height={11}
              rx={1}
              className={c as string}
            />
          ))}
        </g>
      );
    case 'slide':
      return (
        <g>
          <rect x={x + 8} y={y + 5} width={48} height={26} rx={2} className="fill-brand-500" />
          <rect
            x={x + 13}
            y={y + 11}
            width={24}
            height={4}
            rx={2}
            className="fill-white help-art-as-drawn"
          />
          <rect x={x + 13} y={y + 19} width={16} height={3} rx={1.5} className="fill-brand-200" />
        </g>
      );
    case 'tree':
      return (
        <g>
          <rect x={x + 25} y={y + 5} width={14} height={8} rx={2} className="fill-teal-200" />
          <path
            d={`M${x + 32} ${y + 13} v4 M${x + 14} ${y + 21} v-4 h36 v4`}
            className="fill-none stroke-slate-300"
            strokeWidth={1}
          />
          {[7, 25, 43].map((dx) => (
            <rect
              key={dx}
              x={x + dx}
              y={y + 21}
              width={14}
              height={8}
              rx={2}
              className="fill-white stroke-teal-400"
              strokeWidth={0.9}
            />
          ))}
        </g>
      );
    default:
      return (
        <g>
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2].map((c) => (
              <rect
                key={`${r}${c}`}
                x={x + 7 + c * 17}
                y={y + 5 + r * 7}
                width={16}
                height={6}
                className={r === 0 ? 'fill-emerald-200' : 'fill-white stroke-slate-200'}
                strokeWidth={0.6}
              />
            )),
          )}
        </g>
      );
  }
}

// Explorer: the project library. The sidebar with My Work open, and a grid of projects, each card a
// glimpse of what is inside it.
export function ExplorerArt() {
  return (
    <Stage>
      <Window x={16} y={12} w={368} h={198} title="Explorer">
        <rect x={16} y={34} width={106} height={176} className="fill-slate-50" />
        <line x1={122} y1={34} x2={122} y2={210} className="stroke-slate-200" strokeWidth={1} />
        {ROWS.map((r, i) => {
          const y = 44 + i * 25;
          const on = i === 3;
          return (
            <g key={r.label}>
              {on && <rect x={22} y={y} width={94} height={21} rx={6} className="fill-brand-100" />}
              <g
                transform={`translate(34 ${y + 10.5})`}
                className={on ? 'text-brand-700' : 'text-slate-500'}
              >
                {r.glyph}
              </g>
              <Label
                x={46}
                y={y + 11}
                size={9.5}
                weight={on ? 700 : 500}
                tone={on ? 'accent' : 'body'}
              >
                {r.label}
              </Label>
            </g>
          );
        })}

        <Label x={136} y={50} size={12} weight={700} tone="strong">
          My Work
        </Label>
        <rect x={322} y={41} width={50} height={18} rx={6} className="fill-slate-100" />
        <rect
          x={324}
          y={43}
          width={23}
          height={14}
          rx={4}
          className="fill-white stroke-slate-200"
          strokeWidth={0.8}
        />
        {[0, 1].map((r) =>
          [0, 1].map((c) => (
            <rect
              key={`${r}${c}`}
              x={331 + c * 5}
              y={46 + r * 5}
              width={3.5}
              height={3.5}
              rx={0.8}
              className="fill-brand-500"
            />
          )),
        )}
        <path
          d="M353 46.5 h12 M353 50 h12 M353 53.5 h12"
          className="stroke-slate-400"
          strokeWidth={1.2}
        />

        {DOCS.map((d, i) => {
          const x = 134 + (i % 3) * 80;
          const y = 68 + Math.floor(i / 3) * 70;
          return (
            <g key={d.title}>
              <rect
                x={x}
                y={y}
                width={74}
                height={62}
                rx={8}
                className="fill-white stroke-slate-200"
                strokeWidth={1.2}
              />
              <path
                d={`M${x} ${y + 8} a8 8 0 0 1 8 -8 H${x + 66} a8 8 0 0 1 8 8 V${y + 40} H${x} Z`}
                className="fill-slate-50"
              />
              <Thumb x={x + 5} y={y + 3} kind={d.kind} />
              <Label x={x + 8} y={y + 51} size={9} weight={600} tone="strong">
                {d.title}
              </Label>
            </g>
          );
        })}
      </Window>
    </Stage>
  );
}
