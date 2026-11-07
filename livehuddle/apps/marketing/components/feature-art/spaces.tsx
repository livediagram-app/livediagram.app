// Feature illustrations for meeting in a Space (docs/specs/019-marketing/marketing-site.md "Feature category pages"):
// every card on the Spaces, Meetings and Collaborate pages that shows the board shows a real Space in use, a crop of
// the Team Pod, the Virtual Office or the All-Hands Hall through SpaceShot (./space-shot), never a diagram. The
// motion is the shared card keyframes (app/feature-art/canvas.css), which settle under reduced motion.

import type { CSSProperties } from 'react';
import { TemplatePreview } from '@livehuddle/template-previews';
import type { TemplateKind } from '@livehuddle/templates';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import { FONT } from '../art-tokens';
import { TEAM_POD } from '../hero-space-cast';
import { HALL, OFFICE } from '../hero-space-places';
import { SpaceShot, SpeechBubble, at, headOf, shotPoint } from './space-shot';

// The crops, [x, y, width, height] in each template's canvas coordinates, about the card frame's 3:1.
const POD_TABLE = [-260, -150, 560, 190] as const;
const OFFICE_DESKS = [-300, -445, 470, 170] as const;
const OFFICE_MEETING = [400, -445, 420, 170] as const;
const OFFICE_CORRIDOR = [-120, -200, 600, 200] as const;
const HALL_ROOM = [-470, -365, 900, 290] as const;

/** A small pill over a character's head: a status, a role, a view being followed. */
function Pill({
  x,
  y,
  text,
  colour,
  dot,
  delay = 0.6,
}: {
  x: number;
  y: number;
  text: string;
  colour: string;
  dot?: string;
  delay?: number;
}) {
  const width = text.length * 7 + (dot ? 30 : 20);
  return (
    <g transform={`translate(${x - width / 2} ${y - 24})`}>
      <g className="fa-a-pop" style={at(delay)}>
        <rect width={width} height={22} rx={11} fill={colour} />
        {dot ? <circle cx={12} cy={11} r={4} fill={dot} /> : null}
        <text
          x={dot ? 22 : 10}
          y={15}
          fontFamily={FONT}
          fontSize={12}
          fontWeight={600}
          fill="#ffffff"
        >
          {text}
        </text>
      </g>
    </g>
  );
}

/** Walk in as yourself: Priya on her way to the table, a click ring where she is heading. */
export function WalkInArt() {
  const to = { x: 6, y: 44 };
  return (
    <SpaceShot
      spec={TEAM_POD}
      box={[-250, -130, 520, 210]}
      cast={[
        { name: 'Maya' },
        { name: 'Priya', still: 'walk-right-0', x: -150, y: 80 },
        { name: 'Sam' },
      ]}
      under={
        <g>
          <path
            d={`M-130 80 H${to.x} V${to.y + 6}`}
            fill="none"
            strokeWidth={3}
            strokeDasharray="6 7"
            className="fa-a-draw stroke-pink-400"
            style={{ '--len': 260 } as CSSProperties}
          />
          <ellipse
            cx={to.x}
            cy={to.y}
            rx={20}
            ry={8}
            fill="none"
            strokeWidth={3}
            className="fa-a-pop stroke-pink-500"
            style={at(0.4)}
          />
        </g>
      }
    />
  );
}

/** A character of your own: the team side by side, each in their own outfit, hair and colour. */
export function CharacterArt() {
  const names = ['Maya', 'Sam', 'Priya', 'Leo', 'Ana'] as const;
  return (
    <SpaceShot
      spec={TEAM_POD}
      box={[-300, -140, 600, 200]}
      under={<rect x={-300} y={-140} width={600} height={200} className="fill-(--art-paper)" />}
      cast={names.map((name, i) => ({ name, x: -220 + i * 110, y: 10 }))}
    />
  );
}

/** Spaces to start from: four of them, the Virtual Office, the Team Pod, the Coworking Space and the All-Hands Hall. */
export function FourSpacesArt() {
  const kinds: TemplateKind[] = ['virtual-office', 'team-pod', 'coworking-space', 'all-hands-hall'];
  return (
    <Frame canvas>
      <div className="absolute inset-0 grid grid-cols-4 gap-2 p-2.5">
        {kinds.map((kind, i) => (
          <div
            key={kind}
            className={`fa-a-pop flex items-center justify-center overflow-hidden rounded-md border bg-white p-1 dark:bg-slate-900 [&_svg]:h-full [&_svg]:w-full ${
              i === 0
                ? 'border-brand-500 ring-2 ring-brand-500/25'
                : 'border-slate-200 dark:border-slate-700'
            }`}
            style={at(0.2 + i * 0.25)}
          >
            <TemplatePreview kind={kind} />
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** Spaces that open walking: Maya arriving on the Avatar Pad by the door in a beam of light. */
export function ArriveArt() {
  const p = { x: -170, y: 150 };
  return (
    <SpaceShot
      spec={TEAM_POD}
      box={[-430, 10, 520, 200]}
      cast={[{ name: 'Maya', still: 'stand', x: p.x, y: p.y }]}
      under={
        <g>
          <ellipse
            cx={p.x}
            cy={p.y}
            rx={34}
            ry={12}
            className="fill-emerald-400/35 stroke-emerald-500"
            strokeWidth={2}
          />
          <defs>
            <linearGradient id="fa-sp-beam" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6ee7b7" stopOpacity="0" />
              <stop offset="1" stopColor="#34d399" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <rect
            x={p.x - 28}
            y={p.y - 130}
            width={56}
            height={130}
            fill="url(#fa-sp-beam)"
            className="fa-a-in"
            style={at(0.2)}
          />
        </g>
      }
    >
      <Pill x={p.x + 120} y={p.y - 40} text="Avatar Pad" colour="#047857" delay={0.8} />
    </SpaceShot>
  );
}

/** Desks, sofas and a coffee machine: the Virtual Office's Desks room, two of the team at their desks. */
export function FurnitureArt() {
  return <SpaceShot spec={OFFICE} box={OFFICE_DESKS} cast={[{ name: 'Leo' }, { name: 'Ana' }]} />;
}

/** Fences and portals: step into one portal on the corridor and come out of its partner. */
export function PortalArt() {
  const a = { x: -10, y: -40 };
  const b = { x: 420, y: -40 };
  const ring = (p: { x: number; y: number }, delay: number) => (
    <g className="fa-a-pop" style={at(delay)}>
      <ellipse
        cx={p.x}
        cy={p.y}
        rx={34}
        ry={13}
        className="fill-violet-400/30 stroke-violet-500"
        strokeWidth={3}
      />
      <ellipse cx={p.x} cy={p.y} rx={20} ry={7} className="fill-violet-500/40" />
    </g>
  );
  return (
    <SpaceShot
      spec={OFFICE}
      box={OFFICE_CORRIDOR}
      cast={[{ name: 'Sam', still: 'walk-right-0', x: a.x, y: a.y }]}
      under={
        <g>
          {ring(a, 0.2)}
          {ring(b, 0.5)}
          <path
            d={`M${a.x + 40} ${a.y - 60} Q ${(a.x + b.x) / 2} ${a.y - 150} ${b.x - 40} ${b.y - 60}`}
            fill="none"
            strokeWidth={3}
            strokeDasharray="6 7"
            className="fa-a-draw stroke-violet-400"
            style={{ '--len': 520, '--d': '0.8s' } as CSSProperties}
          />
        </g>
      }
    />
  );
}

/** Everyone walks together: the All-Hands Hall's room, everyone in their own colour with their name. */
export function EveryoneArt() {
  return (
    <SpaceShot
      spec={HALL}
      box={HALL_ROOM}
      cast={['Maya', 'Jo', 'Leo', 'Priya', 'Sam', 'Kit', 'Raj'].map((name) => ({ name }))}
    />
  );
}

/** Status at a glance: Leo focusing with his headphones on, Ana available, each said above their heads. */
export function StatusArt() {
  const leo = shotPoint(OFFICE, { name: 'Leo' });
  const ana = shotPoint(OFFICE, { name: 'Ana' });
  return (
    <SpaceShot spec={OFFICE} box={OFFICE_DESKS} cast={[{ name: 'Leo' }, { name: 'Ana' }]}>
      <Pill
        x={leo.x}
        y={leo.y - headOf(OFFICE, 'Leo') - 4}
        text="Focusing"
        colour="#b45309"
        dot="#fde68a"
        delay={0.4}
      />
      <Pill
        x={ana.x}
        y={ana.y - headOf(OFFICE, 'Ana') - 4}
        text="Available"
        colour="#047857"
        dot="#a7f3d0"
        delay={0.9}
      />
    </SpaceShot>
  );
}

/** Say it in a bubble: Priya calls the room in from the end of the meeting table. */
export function BubbleArt() {
  const p = shotPoint(OFFICE, { name: 'Priya' });
  return (
    <SpaceShot
      spec={OFFICE}
      box={OFFICE_MEETING}
      cast={[{ name: 'Priya' }, { name: 'Maya' }, { name: 'Sam' }]}
    >
      <g transform={`translate(${p.x - 40} ${p.y - headOf(OFFICE, 'Priya') - 6})`}>
        <g className="fa-a-pop" style={at(0.4)}>
          <SpeechBubble text="Demo time? 👋" name="Priya" colour="#ec4899" />
        </g>
      </g>
    </SpaceShot>
  );
}

/** Wave, cheer and dance: Leo's cheer and Sam's wave at the stand-up, and a burst over the table. */
export function ReactArt() {
  const bursts = [
    ['🎉', -40, -120, 0.3],
    ['✨', 60, -140, 0.6],
    ['🎉', 150, -110, 0.9],
  ] as const;
  return (
    <SpaceShot
      spec={TEAM_POD}
      box={POD_TABLE}
      cast={[
        { name: 'Sam', still: 'wave-0' },
        { name: 'Leo', still: 'cheer-2' },
        { name: 'Maya' },
        { name: 'Priya' },
        { name: 'Ana' },
      ]}
    >
      {bursts.map(([emoji, x, y, d]) => (
        <text
          key={`${x}`}
          x={x}
          y={y}
          fontSize={34}
          textAnchor="middle"
          className="fa-a-pop"
          style={at(d)}
        >
          {emoji}
        </text>
      ))}
    </SpaceShot>
  );
}

/** A view that keeps up, or follows a teammate's: the screen's edge travelling with a character down the corridor. */
function ViewFrame({ following }: { following?: string }) {
  const p = { x: 260, y: -54 };
  return (
    <SpaceShot
      spec={OFFICE}
      box={OFFICE_CORRIDOR}
      cast={[{ name: 'Sam', still: 'walk-right-0', x: p.x, y: p.y }]}
    >
      <g className="fa-a-in" style={at(0.3)}>
        <rect
          x={p.x - 120}
          y={p.y - 130}
          width={240}
          height={170}
          rx={8}
          fill="none"
          strokeWidth={3}
          strokeDasharray="10 8"
          className="stroke-sky-500"
        />
        <path
          d={`M${p.x + 135} ${p.y - 45} h40 m-12 -10 l12 10 l-12 10`}
          fill="none"
          strokeWidth={3}
          className="stroke-sky-500"
        />
      </g>
      {following ? (
        <Pill
          x={p.x}
          y={p.y - 92}
          text={`Following ${following}`}
          colour="#0369a1"
          dot="#0ea5e9"
          delay={0.5}
        />
      ) : null}
    </SpaceShot>
  );
}

/** A camera that keeps up: the view pans with you as you walk towards its edge. */
export function CameraArt() {
  return <ViewFrame />;
}

/** Follow someone's view: your screen goes where Sam's goes. */
export function FollowArt() {
  return <ViewFrame following="Sam" />;
}

/** A Space for every meeting: the Team Pod's stand-up round its table, the team in their places. */
export function EveryMeetingArt() {
  return (
    <SpaceShot
      spec={TEAM_POD}
      box={POD_TABLE}
      cast={['Maya', 'Sam', 'Priya', 'Leo', 'Ana'].map((name) => ({ name }))}
    />
  );
}
