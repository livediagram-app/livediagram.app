// Feature illustrations for talking in a Space (docs/specs/012-collaboration/proximity-audio.md,
// video-and-screen-bubbles.md, meeting-rooms-and-stage.md, knock.md, tab-attendance.md): the Meetings page's call
// cards. Every one that shows the board is a crop of a real Space through SpaceShot, with the call's own marks over it
// (a hearing ring, a camera or screen bubble, a raised hand, a knock). The motion is the shared card keyframes
// (app/feature-art/canvas.css), which settle under reduced motion.

import type { ReactNode } from 'react';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import { FONT } from '../art-tokens';
import { TEAM_POD } from '../hero-space-cast';
import { HALL, OFFICE } from '../hero-space-places';
import { SpaceShot, at, headOf, shotPoint } from './space-shot';

const POD_TABLE = [-260, -150, 560, 190] as const;
// The Meeting Room down to its table, so the three sat round it are in the shot with room above them for a bubble.
const OFFICE_MEETING = [290, -420, 580, 186] as const;
const OFFICE_DESKS = [-300, -445, 470, 170] as const;
const HALL_FRONT = [-510, -580, 1020, 322] as const;

/** A label pill in the canvas's own type: a coloured face, an optional dot, white words. */
function Tag({
  x,
  y,
  text,
  colour,
  dot,
  delay = 0.5,
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
    <g transform={`translate(${x - width / 2} ${y - 22})`}>
      <g className="fa-a-pop" style={at(delay)}>
        <rect width={width} height={22} rx={11} fill={colour} />
        {dot ? <circle cx={12} cy={11} r={4} fill={dot} /> : null}
        <text x={dot ? 22 : 10} y={15} fontFamily={FONT} fontSize={12} fontWeight={600} fill="#fff">
          {text}
        </text>
      </g>
    </g>
  );
}

/** The talking bars a speaking character shows: three bars, pulsing. */
function Talking({ x, y, delay = 0.3 }: { x: number; y: number; delay?: number }) {
  return (
    <g transform={`translate(${x - 14} ${y - 22})`}>
      <g className="fa-a-pop" style={at(delay)}>
        <rect
          width={28}
          height={20}
          rx={10}
          className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
        />
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={7 + i * 5.5}
            y={[7, 4, 8][i]}
            width={3}
            height={[6, 12, 4][i]}
            rx={1.5}
            className="fa-a-pop fill-emerald-500"
            style={at(delay + i * 0.15)}
          />
        ))}
      </g>
    </g>
  );
}

/** A bubble over a character's head: a camera's picture or a shared screen, in its rounded frame. */
function Bubble({
  x,
  y,
  w,
  h,
  delay,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  delay: number;
  children: ReactNode;
}) {
  return (
    <g transform={`translate(${x - w / 2} ${y - h - 6})`}>
      <g className="fa-a-pop" style={at(delay)}>
        <rect
          width={w}
          height={h}
          rx={12}
          className="fill-slate-800 stroke-white dark:stroke-slate-600"
          strokeWidth={3}
        />
        {children}
      </g>
    </g>
  );
}

/** A camera's picture: a person's head and shoulders on a soft backdrop, in their colour. */
function Face({ w, h, colour }: { w: number; h: number; colour: string }) {
  return (
    <g>
      <rect x={4} y={4} width={w - 8} height={h - 8} rx={9} fill={colour} opacity={0.35} />
      <circle cx={w / 2} cy={h * 0.42} r={h * 0.18} fill="#f5d0b0" />
      <path
        d={`M${w / 2 - h * 0.34} ${h - 4} a${h * 0.34} ${h * 0.3} 0 0 1 ${h * 0.68} 0z`}
        fill={colour}
      />
    </g>
  );
}

/** Talk to whoever is near you: Priya's hearing ring takes in Maya and Sam round the table, and Priya is talking. */
export function TalkNearArt() {
  const p = shotPoint(TEAM_POD, { name: 'Priya' });
  return (
    <SpaceShot
      spec={TEAM_POD}
      box={POD_TABLE}
      cast={['Maya', 'Sam', 'Priya', 'Leo', 'Ana'].map((name) => ({ name }))}
      under={
        <g>
          <ellipse
            cx={p.x}
            cy={p.y}
            rx={190}
            ry={110}
            className="fa-a-pop fill-emerald-400/10 stroke-emerald-500"
            strokeWidth={3}
            strokeDasharray="10 8"
            style={at(0.2)}
          />
        </g>
      }
    >
      <Talking x={p.x} y={p.y - headOf(TEAM_POD, 'Priya') - 4} delay={0.6} />
    </SpaceShot>
  );
}

/** Rooms keep a call private: the Meeting Room's three in their own call, said on a pill over the table. */
export function PrivateRoomArt() {
  const priya = shotPoint(OFFICE, { name: 'Priya' });
  return (
    <SpaceShot
      spec={OFFICE}
      box={OFFICE_MEETING}
      cast={[{ name: 'Priya' }, { name: 'Maya' }, { name: 'Sam' }]}
    >
      <Tag
        x={610}
        y={-395}
        text="Meeting Room · 3 in a call"
        colour="#047857"
        dot="#a7f3d0"
        delay={0.3}
      />
      <Talking x={priya.x} y={priya.y - headOf(OFFICE, 'Priya') - 4} delay={0.7} />
    </SpaceShot>
  );
}

/** Your camera, above your head: Priya's camera bubble shows to the two beside her. */
export function CameraBubbleArt() {
  const p = shotPoint(OFFICE, { name: 'Priya' });
  return (
    <SpaceShot
      spec={OFFICE}
      box={OFFICE_MEETING}
      cast={[{ name: 'Priya' }, { name: 'Maya' }, { name: 'Sam' }]}
    >
      <Bubble x={p.x} y={p.y - headOf(OFFICE, 'Priya')} w={76} h={56} delay={0.4}>
        <Face w={76} h={56} colour="#ec4899" />
      </Bubble>
    </SpaceShot>
  );
}

/** Share your screen: Maya's shared chart in a bubble over her head, Sharing said beside it. */
export function ScreenShareArt() {
  const m = shotPoint(OFFICE, { name: 'Maya' });
  const w = 104;
  const h = 64;
  return (
    <SpaceShot
      spec={OFFICE}
      box={OFFICE_MEETING}
      cast={[{ name: 'Priya' }, { name: 'Maya' }, { name: 'Sam' }]}
    >
      <Bubble x={m.x} y={m.y - headOf(OFFICE, 'Maya')} w={w} h={h} delay={0.4}>
        <rect x={6} y={6} width={w - 12} height={h - 12} rx={7} fill="#ffffff" />
        <rect x={14} y={14} width={48} height={6} rx={3} fill="#cbd5e1" />
        {[22, 34, 28, 44].map((bh, i) => (
          <rect
            key={i}
            x={16 + i * 22}
            y={h - 12 - bh * 0.85}
            width={14}
            height={bh * 0.85}
            rx={2}
            fill={i === 3 ? '#10b981' : '#a7f3d0'}
            className="fa-a-pop"
            style={at(0.7 + i * 0.12)}
          />
        ))}
      </Bubble>
      <Tag
        x={m.x + 104}
        y={m.y - headOf(OFFICE, 'Maya') - 36}
        text="Sharing"
        colour="#be123c"
        dot="#fecdd3"
        delay={0.9}
      />
    </SpaceShot>
  );
}

/** Speak from the stage: Ana heard by the whole hall from the stage, and Leo's hand up in the audience. */
export function StageArt() {
  const ana = shotPoint(HALL, { name: 'Ana' });
  const cast = HALL.cast.map((m) => ({ name: m.name }));
  const q = shotPoint(HALL, { name: 'Priya' });
  return (
    <SpaceShot spec={HALL} box={HALL_FRONT} cast={cast}>
      <Talking x={ana.x} y={ana.y - headOf(HALL, 'Ana') - 4} delay={0.6} />
      <Tag
        x={ana.x}
        y={ana.y - headOf(HALL, 'Ana') - 30}
        text="Speaking to everyone"
        colour="#047857"
        dot="#a7f3d0"
        delay={0.2}
      />
      <g transform={`translate(${q.x + 22} ${q.y - headOf(HALL, 'Priya') - 10})`}>
        <g className="fa-a-pop" style={at(1.1)}>
          <circle r={20} fill="#f59e0b" />
          <text y={7} textAnchor="middle" fontSize={20}>
            ✋
          </text>
        </g>
      </g>
    </SpaceShot>
  );
}

/** Knock before you walk in: the Meeting Room's sign says In Use, and the room is asked "Sam is knocking". */
export function KnockArt() {
  const p = shotPoint(OFFICE, { name: 'Priya' });
  return (
    <SpaceShot spec={OFFICE} box={OFFICE_MEETING} cast={[{ name: 'Priya' }, { name: 'Maya' }]}>
      <g transform={`translate(${p.x - 250} ${p.y - 120})`}>
        <g className="fa-a-pop" style={at(0.4)}>
          <rect
            width={200}
            height={64}
            rx={12}
            className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
            strokeWidth={1.5}
          />
          <circle cx={22} cy={22} r={10} fill="#0ea5e9" />
          <text
            x={22}
            y={26.5}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize={11}
            fontWeight={700}
            fill="#fff"
          >
            S
          </text>
          <text
            x={40}
            y={26}
            fontFamily={FONT}
            fontSize={13}
            fontWeight={600}
            className="fill-slate-800 dark:fill-slate-100"
          >
            Sam is knocking
          </text>
          <rect x={14} y={38} width={76} height={18} rx={9} fill="#047857" />
          <text
            x={52}
            y={51}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize={11}
            fontWeight={600}
            fill="#fff"
          >
            Let In
          </text>
          <rect
            x={98}
            y={38}
            width={84}
            height={18}
            rx={9}
            className="fill-slate-100 dark:fill-slate-700"
          />
          <text
            x={140}
            y={51}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize={11}
            fontWeight={600}
            className="fill-slate-600 dark:fill-slate-200"
          >
            Not Now
          </text>
        </g>
      </g>
    </SpaceShot>
  );
}

/** Quiet when you need it: Leo on Do Not Disturb at his desk, the red bar above his head. */
export function DoNotDisturbArt() {
  const leo = shotPoint(OFFICE, { name: 'Leo' });
  const ana = shotPoint(OFFICE, { name: 'Ana' });
  return (
    <SpaceShot spec={OFFICE} box={OFFICE_DESKS} cast={[{ name: 'Leo' }, { name: 'Ana' }]}>
      <Tag
        x={leo.x}
        y={leo.y - headOf(OFFICE, 'Leo') - 4}
        text="Do Not Disturb"
        colour="#be123c"
        dot="#fecdd3"
        delay={0.4}
      />
      <Talking x={ana.x} y={ana.y - headOf(OFFICE, 'Ana') - 4} delay={0.8} />
    </SpaceShot>
  );
}

/** Floors, lifts and a directory: the Directory listing every room on every floor, with who is in each. */
export function DirectoryArt() {
  const rooms = [
    { floor: 'Ground', room: 'Reception', who: ['#0ea5e9'] },
    { floor: 'Ground', room: 'Meeting Room', who: ['#ec4899', '#10b981', '#f59e0b'] },
    { floor: 'First', room: 'Focus Room', who: [] as string[] },
    { floor: 'First', room: 'Kitchen', who: ['#8b5cf6'] },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <rect
          x={14}
          y={6}
          width={272}
          height={84}
          rx={6}
          className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
        />
        <text
          x={24}
          y={19}
          fontSize={7}
          fontWeight={700}
          className="fill-slate-700 dark:fill-slate-200"
        >
          Directory
        </text>
        <text
          x={276}
          y={19}
          fontSize={5.6}
          textAnchor="end"
          className="fill-slate-400 dark:fill-slate-500"
        >
          4 rooms on 2 floors
        </text>
        {rooms.map((r, i) => {
          const y = 27 + i * 15;
          return (
            <g key={r.room} className="fa-a-pop" style={at(0.2 + i * 0.15)}>
              <text x={24} y={y + 8} fontSize={5.6} className="fill-slate-400 dark:fill-slate-500">
                {r.floor}
              </text>
              <text
                x={64}
                y={y + 8}
                fontSize={6.4}
                fontWeight={600}
                className="fill-slate-700 dark:fill-slate-200"
              >
                {r.room}
              </text>
              {r.who.map((c, j) => (
                <circle
                  key={c}
                  cx={160 + j * 9}
                  cy={y + 6}
                  r={4}
                  fill={c}
                  className="stroke-white dark:stroke-slate-800"
                  strokeWidth={1.2}
                />
              ))}
              {r.who.length === 0 ? (
                <text
                  x={156}
                  y={y + 8}
                  fontSize={5.6}
                  className="fill-slate-400 dark:fill-slate-500"
                >
                  Empty
                </text>
              ) : null}
              <rect
                x={222}
                y={y}
                width={54}
                height={11}
                rx={5.5}
                className={i === 1 ? 'fill-emerald-600' : 'fill-slate-100 dark:fill-slate-700'}
              />
              <text
                x={249}
                y={y + 7.6}
                fontSize={5.8}
                fontWeight={600}
                textAnchor="middle"
                className={i === 1 ? 'fill-white' : 'fill-slate-600 dark:fill-slate-200'}
              >
                Walk There
              </text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

/** Who came, and for how long: a tab's Attendance, today's visits with who joined, who left and how long they stayed. */
export function AttendanceArt() {
  const rows = [
    { name: 'Priya', colour: '#ec4899', when: 'Joined 09:58 · Here Now', stay: '32 min' },
    { name: 'Sam', colour: '#0ea5e9', when: 'Joined 10:00 · Left 10:15', stay: '15 min' },
    { name: 'Guest', colour: '#94a3b8', when: 'Joined 10:02 · Left 10:14', stay: '12 min' },
    { name: 'Leo', colour: '#f59e0b', when: 'Joined 10:01 · Left 10:13', stay: '12 min' },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <rect
          x={14}
          y={6}
          width={272}
          height={84}
          rx={6}
          className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
        />
        <text
          x={24}
          y={19}
          fontSize={7}
          fontWeight={700}
          className="fill-slate-700 dark:fill-slate-200"
        >
          Attendance · Stand-up
        </text>
        <text
          x={276}
          y={19}
          fontSize={5.6}
          textAnchor="end"
          className="fill-slate-400 dark:fill-slate-500"
        >
          Today
        </text>
        {rows.map((r, i) => {
          const y = 27 + i * 15;
          return (
            <g key={r.name} className="fa-a-pop" style={at(0.2 + i * 0.15)}>
              <circle cx={29} cy={y + 5.5} r={5} fill={r.colour} />
              <text
                x={29}
                y={y + 7.6}
                fontSize={5}
                fontWeight={700}
                textAnchor="middle"
                fill="#fff"
              >
                {r.name[0]}
              </text>
              <text
                x={40}
                y={y + 7.8}
                fontSize={6.4}
                fontWeight={600}
                className="fill-slate-700 dark:fill-slate-200"
              >
                {r.name}
              </text>
              <text
                x={80}
                y={y + 7.8}
                fontSize={5.8}
                className="fill-slate-400 dark:fill-slate-500"
              >
                {r.when}
              </text>
              <text
                x={276}
                y={y + 7.8}
                fontSize={6}
                fontWeight={600}
                textAnchor="end"
                className="fill-slate-600 dark:fill-slate-300"
              >
                {r.stay}
              </text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}
