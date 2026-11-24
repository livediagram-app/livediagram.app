// Feature illustrations for calls started from the other apps (docs/specs/012-collaboration/calls-from-items.md,
// liveworkspace/docs/specs/004-index/item-calls.md and send-to-plan.md): the Meetings page's "Calls from your work"
// cards. Each is a panel the call's people see, drawn as the editor draws it: the item's Call button with its live
// pill, the Wrap Up dialog, and stickies on their way to a plan. The motion is the shared card keyframes
// (app/feature-art/canvas.css), which settle under reduced motion.

import type { ReactNode } from 'react';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import { at } from './space-shot';

const PANEL = 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700';
const INK = 'fill-slate-700 dark:fill-slate-200';
const QUIET = 'fill-slate-400 dark:fill-slate-500';
const LINE = 'fill-slate-200 dark:fill-slate-700';

function Words({
  x,
  y,
  size = 6.2,
  weight = 600,
  quiet = false,
  anchor,
  children,
}: {
  x: number;
  y: number;
  size?: number;
  weight?: number;
  quiet?: boolean;
  anchor?: 'middle' | 'end';
  children: ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight}
      textAnchor={anchor}
      className={quiet ? QUIET : INK}
    >
      {children}
    </text>
  );
}

function Panel({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={6} className={PANEL} />;
}

/** A filled button in the brand's deep emerald, white words. */
function Press({ x, y, w, text }: { x: number; y: number; w: number; text: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={13} rx={4} className="fill-brand-700" />
      <text x={x + w / 2} y={y + 8.8} fontSize={6} fontWeight={700} textAnchor="middle" fill="#fff">
        {text}
      </text>
    </g>
  );
}

/** A diagram with its Call button and the live pill, and the call it opens in a new tab: a Space named for it. */
export function CallFromItemArt() {
  const people = ['#ec4899', '#0ea5e9', '#f59e0b'];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <Panel x={12} y={8} w={150} h={80} />
        <rect x={20} y={16} width={8} height={8} rx={2} className="fill-sky-500" />
        <Words x={32} y={22.4} size={6.6} weight={700}>
          Checkout Flow
        </Words>
        <g className="fa-a-pop" style={at(0.3)}>
          <circle cx={92} cy={20} r={2.4} className="fill-emerald-500" />
          <Words x={97} y={22.2} size={5.6} quiet>
            3 in Call
          </Words>
          <Press x={128} y={13.5} w={28} text="Join" />
        </g>
        <g className="stroke-sky-500 fill-sky-50 dark:fill-sky-950" strokeWidth={0.9}>
          <rect x={26} y={44} width={30} height={16} rx={3} />
          <rect x={72} y={44} width={30} height={16} rx={3} />
          <rect x={118} y={44} width={30} height={16} rx={3} />
        </g>
        <path d="M56 52 H72 M102 52 H118" strokeWidth={0.9} className="stroke-slate-400" />
        <path
          d="M164 48 H184"
          strokeWidth={1.4}
          strokeLinecap="round"
          className="fa-a-pop stroke-slate-400"
          style={at(0.7)}
        />
        <path
          d="M180 44 L185 48 L180 52"
          fill="none"
          strokeWidth={1.4}
          className="stroke-slate-400"
        />
        <g className="fa-a-pop" style={at(0.9)}>
          <Panel x={190} y={14} w={98} h={68} />
          <Words x={198} y={27} size={6.2} weight={700}>
            Checkout Flow Call
          </Words>
          <rect
            x={198}
            y={34}
            width={82}
            height={34}
            rx={4}
            className="fill-emerald-50 dark:fill-emerald-950"
          />
          {people.map((c, i) => (
            <circle
              key={c}
              cx={222 + i * 18}
              cy={51}
              r={6}
              fill={c}
              className="fa-a-pop"
              style={at(1.1 + i * 0.15)}
            />
          ))}
          <Words x={198} y={77} size={5.4} quiet>
            Open Item · Invite · Wrap Up
          </Words>
        </g>
      </svg>
    </Frame>
  );
}

/** The Wrap Up dialog: the summary, the knowledgebase it goes to, and the actions sent to a plan. */
export function WrapUpArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <Panel x={14} y={6} w={272} h={84} />
        <Words x={24} y={19} size={7} weight={700}>
          Wrap Up
        </Words>
        <Words x={58} y={19} size={5.6} quiet>
          Send the summary and the actions where they belong.
        </Words>
        <g className="fa-a-pop" style={at(0.3)}>
          <rect
            x={24}
            y={25}
            width={160}
            height={40}
            rx={4}
            className="fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
            strokeWidth={0.8}
          />
          <Words x={30} y={35} size={5.6}>
            Call about Checkout Flow, 32 minutes.
          </Words>
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={30}
              y={41 + i * 7}
              width={[140, 118, 128][i]}
              height={3.4}
              rx={1.7}
              className={LINE}
            />
          ))}
        </g>
        <g className="fa-a-pop" style={at(0.7)}>
          <Words x={194} y={33} size={5.4} weight={700} quiet>
            SEND TO
          </Words>
          <Words x={194} y={43} size={6}>
            Engineering Handbook
          </Words>
          <Press x={194} y={50} w={82} text="Send Summary" />
        </g>
        <g className="fa-a-pop" style={at(1.1)}>
          <Press x={24} y={71} w={96} text="Send Actions to Plan" />
          <Words x={126} y={80} size={5.6} quiet>
            Write With AI drafts the summary
          </Words>
        </g>
      </svg>
    </Frame>
  );
}

/** Stickies from the Space's wall, picked in Send to Plan, landing as cards on a liveplanner board. */
export function SendToPlanArt() {
  const notes = [
    { t: 'Fix the retry', c: 'fill-amber-200' },
    { t: 'Update docs', c: 'fill-pink-200' },
    { t: 'Book demo', c: 'fill-sky-200' },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {notes.map((n, i) => (
          <g key={n.t} className="fa-a-pop" style={at(0.2 + i * 0.15)}>
            <rect
              x={18 + (i % 2) * 52}
              y={12 + Math.floor(i / 2) * 38}
              width={46}
              height={32}
              rx={2}
              className={n.c}
            />
            <text
              x={22 + (i % 2) * 52}
              y={26 + Math.floor(i / 2) * 38}
              fontSize={6}
              fontWeight={600}
              fill="#334155"
            >
              {n.t}
            </text>
          </g>
        ))}
        <path
          d="M128 48 H150"
          strokeWidth={1.4}
          strokeLinecap="round"
          className="stroke-slate-400"
        />
        <path
          d="M146 44 L151 48 L146 52"
          fill="none"
          strokeWidth={1.4}
          className="stroke-slate-400"
        />
        <Panel x={158} y={8} w={128} h={80} />
        <Words x={166} y={21} size={5.4} weight={700} quiet>
          LIVEPLANNER · TO DO
        </Words>
        {notes.map((n, i) => (
          <g key={n.t} className="fa-a-pop" style={at(0.8 + i * 0.2)}>
            <rect
              x={166}
              y={27 + i * 19}
              width={112}
              height={15}
              rx={3}
              strokeWidth={0.8}
              className={PANEL}
            />
            <Words x={172} y={37 + i * 19} size={6}>
              {n.t}
            </Words>
          </g>
        ))}
      </svg>
    </Frame>
  );
}
