// Feature illustrations for what a Space holds beyond its rooms and calls, on the board itself
// (docs/specs/008-canvas/3d-view.md, receptionist.md, docs/specs/009-elements/room-builder.md): the 3D View, the
// Receptionist and the Room Builder. They draw through SpaceShot, or the cast's own sprite sheets, so every character is
// the product's own; the chrome is the editor's own, with its labels. The panels a Space opens (the games, the Mini
// View, History, Webhooks) are in ./space-panels. The motion is the shared card keyframes (app/feature-art/canvas.css),
// which settle under reduced motion.

import type { CSSProperties } from 'react';
import { ROOM_TONES } from '@livehuddle/document';
import { avatarBox } from '@livehuddle/avatar/walk';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import { FONT } from '../art-tokens';
import {
  RECEPTIONIST,
  RECEPTIONIST_SHEET,
  SPACE_AVATAR_SCALE,
  TEAM_POD,
  castHref,
  stillId,
  type StillKey,
} from '../hero-space-cast';
import { NameChip, SpaceShot, at, headOf, overHeadOf } from './space-shot';

const BOX = avatarBox(SPACE_AVATAR_SCALE);

/** A cast member's sprite from a sheet, its feet at (x, y), drawn at `scale` of the canvas's size. */
function Sprite({
  sheet,
  id,
  x,
  y,
  scale = 1,
}: {
  sheet: string;
  id: string;
  x: number;
  y: number;
  scale?: number;
}) {
  return (
    <use
      href={`${sheet}#${id}`}
      x={x - BOX.offsetX * scale}
      y={y - BOX.offsetY * scale}
      width={BOX.width * scale}
      height={BOX.height * scale}
    />
  );
}

/** A Team Pod teammate's still, by name. */
function podStill(name: string, key: StillKey = 'stand') {
  const member = TEAM_POD.cast.find((m) => m.name === name)!;
  return stillId(member, key);
}

/** The 3D View switch's glyph (the editor's Space3DGlyph): a floor in perspective with two walls standing on it. */
function Space3DGlyph() {
  return (
    <g fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 16.5h15l-3-7.5h-9z" />
      <path d="M5.5 9V4.5h9V9" />
      <path d="M10 4.5V9" />
    </g>
  );
}

/**
 * See the Space in 3D: a meeting room tilted back like a map, its walls standing with a framed doorway and a
 * window, the room's name over the door, the team standing upright round the table, and the 3D View switch lit in the
 * bottom-right cluster, as Space3DButton draws it (white strip, the brand's wash while on, the glyph and "3D").
 */
export function Space3DArt() {
  return (
    <SpaceShot
      spec={TEAM_POD}
      box={[-300, -140, 600, 200]}
      under={
        <g>
          <rect x={-300} y={-140} width={600} height={200} className="fill-(--art-paper)" />
          {/* The floor, in perspective: narrower at the back. */}
          <path d="M-170 -60 H170 L290 60 H-290 Z" className="fill-stone-100 dark:fill-slate-800" />
          {/* The side walls, standing taller as they come nearer, darker as they run away from the camera. */}
          <path
            d="M-170 -60 V-122 L-262 -40 V32 Z"
            className="fa-a-in fill-stone-200 dark:fill-slate-600"
            style={at(0.1)}
          />
          <path
            d="M170 -60 V-122 L262 -40 V32 Z"
            className="fa-a-in fill-stone-200 dark:fill-slate-600"
            style={at(0.1)}
          />
          {/* A window in the right wall: glass in a painted frame, a mullion and a transom. */}
          <g className="fa-a-in" style={at(0.3)}>
            <path
              d="M196 -86 L238 -50 V-12 L196 -46 Z"
              className="fill-sky-200 stroke-white dark:fill-sky-900 dark:stroke-slate-400"
              strokeWidth={4}
              strokeLinejoin="round"
            />
            <path
              d="M217 -68 V-29 M196 -62 L238 -26"
              className="stroke-white dark:stroke-slate-400"
              strokeWidth={2}
            />
          </g>
          {/* The back wall, lit from the front, with its lighter top edge and the skirting at its foot. */}
          <rect
            x={-170}
            y={-122}
            width={340}
            height={62}
            className="fa-a-in fill-stone-300 dark:fill-slate-500"
            style={at(0.2)}
          />
          <rect
            x={-170}
            y={-122}
            width={340}
            height={4}
            className="fill-stone-200 dark:fill-slate-400"
          />
          <rect x={-170} y={-64} width={340} height={4} fill={ROOM_TONES.skirting} opacity={0.7} />
          {/* The doorway: a dark wooden frame under a plaster lintel, the room's name on the lintel. */}
          <rect x={-26} y={-110} width={52} height={50} fill="#7c4a2d" />
          <rect
            x={-19}
            y={-104}
            width={38}
            height={44}
            className="fill-stone-700 dark:fill-slate-900"
          />
          <text
            x={0}
            y={-113}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize={11}
            fontWeight={700}
            className="fill-stone-600 dark:fill-slate-200"
          >
            Meeting Room
          </text>
          {/* A rug and the table they stand round. */}
          <path
            d="M-120 -30 H120 L150 20 H-150 Z"
            className="fill-emerald-200/70 dark:fill-emerald-900/60"
          />
          <path d="M-70 -24 H70 L84 2 H-84 Z" fill="#a16207" />
          <rect x={-84} y={2} width={168} height={8} fill="#854d0e" />
        </g>
      }
      cast={[
        { name: 'Maya', x: -150, y: 12 },
        { name: 'Sam', x: -40, y: 22 },
        { name: 'Priya', x: 70, y: 22 },
        { name: 'Leo', x: 170, y: 12 },
      ]}
    >
      {/* The bottom-right cluster's 3D View switch, on. */}
      <g transform="translate(216 12)">
        <g className="fa-a-pop" style={at(0.7)}>
          <rect
            width={74}
            height={38}
            rx={8}
            strokeWidth={1.5}
            className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
          />
          <rect
            x={1.5}
            y={1.5}
            width={71}
            height={35}
            rx={6.5}
            className="fill-emerald-100 dark:fill-emerald-500/20"
          />
          <g
            transform="translate(10 8) scale(1.1)"
            className="stroke-emerald-700 dark:stroke-emerald-100"
          >
            <Space3DGlyph />
          </g>
          <text
            x={39}
            y={24.5}
            fontFamily={FONT}
            fontSize={15}
            fontWeight={600}
            className="fill-emerald-700 dark:fill-emerald-100"
          >
            3D
          </text>
        </g>
      </g>
    </SpaceShot>
  );
}

// The Receptionist's welcome (apps/editor/lib/receptionist/receptionist-topics.ts and ReceptionistBubble.tsx): his
// opening line, then his topics grouped under amber headings, each a row with a chevron.
const WELCOME = ['Welcome in! I’m the receptionist.', 'What should I show you?'];
const TOPICS = ['Talking to People', 'Camera and Screen'];

/**
 * A host at the door: Maya appears on the Avatar Pad and the Receptionist, in his waistcoat and amber shirt, waves
 * her in, his bubble open on his welcome and the first of his topics.
 */
export function ReceptionistArt() {
  const pad = { x: -262, y: 170 };
  const host = { x: -128, y: 170 };
  const amber = RECEPTIONIST.colour;
  const w = 268;
  const h = 110;
  // The bubble over his head and its name chip, its tail clear of the chip.
  const bx = host.x - 96;
  const by = host.y - overHeadOf(TEAM_POD, 'Maya') - 8 - h;
  return (
    <SpaceShot
      spec={TEAM_POD}
      box={[-540, -69, 820, 262]}
      cast={[{ name: 'Maya', x: pad.x, y: pad.y }]}
      under={
        <ellipse
          cx={pad.x}
          cy={pad.y}
          rx={34}
          ry={12}
          className="fill-emerald-400/35 stroke-emerald-500"
          strokeWidth={2}
        />
      }
    >
      <Sprite sheet={RECEPTIONIST_SHEET} id={stillId(RECEPTIONIST, 'wave-1')} {...host} />
      <g transform={`translate(${host.x} ${host.y})`}>
        <NameChip name="The Receptionist" colour={amber} head={headOf(TEAM_POD, 'Maya')} />
      </g>
      <g transform={`translate(${bx} ${by})`}>
        <g className="fa-a-pop" style={at(0.4)}>
          <rect
            width={w}
            height={h}
            rx={14}
            stroke={amber}
            strokeWidth={1.5}
            className="fill-white dark:fill-slate-900"
          />
          <path
            d={`M${host.x - bx - 7} ${h - 1}L${host.x - bx} ${h + 8}L${host.x - bx + 7} ${h - 1}`}
            stroke={amber}
            strokeWidth={1.5}
            className="fill-white dark:fill-slate-900"
          />
          {WELCOME.map((line, i) => (
            <text
              key={line}
              x={14}
              y={22 + i * 16}
              fontFamily={FONT}
              fontSize={14}
              className="fill-slate-800 dark:fill-slate-100"
            >
              {line}
            </text>
          ))}
          <text
            x={14}
            y={57}
            fontFamily={FONT}
            fontSize={9.5}
            fontWeight={700}
            letterSpacing={1.4}
            className="fill-amber-600 dark:fill-amber-300"
          >
            TALK
          </text>
          {TOPICS.map((topic, i) => (
            <g key={topic} className="fa-a-in" style={at(0.9 + i * 0.25)}>
              <rect
                x={14}
                y={63 + i * 22}
                width={w - 28}
                height={18}
                rx={6}
                strokeWidth={1.2}
                className="fill-none stroke-emerald-500/50"
              />
              <text
                x={24}
                y={76 + i * 22}
                fontFamily={FONT}
                fontSize={12}
                fontWeight={600}
                className="fill-emerald-700 dark:fill-emerald-200"
              >
                {topic}
              </text>
              <text
                x={w - 24}
                y={76.5 + i * 22}
                fontFamily={FONT}
                fontSize={15}
                textAnchor="end"
                className="fill-emerald-700/60 dark:fill-emerald-200/60"
              >
                ›
              </text>
            </g>
          ))}
        </g>
      </g>
    </SpaceShot>
  );
}

// The Room Builder's walls as the editor draws them (RoomBuilderViews' PlasterWalls, @livehuddle/document ROOM_TONES):
// a plaster top over a fine edge of plaster's deeper shade, mitred at the corners. In card units.
const WALL = 4;
const WALL_EDGE = 1.2;

/** A run of wall along `d`, drawn in as it is placed. */
function Walls({ d, len, delay }: { d: string; len: number; delay: number }) {
  const draw = { '--len': len, '--d': `${delay}s` } as CSSProperties;
  return (
    <g fill="none" strokeLinejoin="miter" strokeLinecap="square">
      <path
        d={d}
        stroke={ROOM_TONES.wallEdge}
        strokeWidth={WALL + WALL_EDGE}
        className="fa-a-draw"
        style={draw}
      />
      <path
        d={d}
        stroke={ROOM_TONES.wallTop}
        strokeWidth={WALL}
        className="fa-a-draw"
        style={draw}
      />
    </g>
  );
}

/**
 * Draw any room: the Room Builder's banner over the board, an L-shaped open plan whose corners are being clicked in
 * (each wall snapped to 45 degrees, the last one a rubber band back to the ringed first corner), and beside it a
 * finished Glass Room with a Door in its wall and two of the team inside, seen through the glass.
 */
export function RoomBuilderArt() {
  // The L's corners, wall centre line, first to last; the closing wall runs from the last back to the first.
  const corners: [number, number][] = [
    [18, 30],
    [136, 30],
    [136, 60],
    [86, 60],
    [86, 88],
    [18, 88],
  ];
  const placed = `M${corners.map(([x, y]) => `${x} ${y}`).join(' L')}`;
  const sheet = castHref(TEAM_POD);
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* The glass room: floor, its panes a wash of the room's stroke, their frames and a glint. */}
        <g className="fa-a-in" style={at(0.1)}>
          <rect
            x={168}
            y={30}
            width={118}
            height={58}
            className="fill-[#f5f0e6] dark:fill-[#292524]"
          />
          <Sprite sheet={sheet} id={podStill('Priya')} x={208} y={82} scale={0.38} />
          <Sprite sheet={sheet} id={podStill('Sam')} x={240} y={82} scale={0.38} />
          <rect
            x={168}
            y={30}
            width={118}
            height={58}
            fill="#94a3b8"
            fillOpacity={0.16}
            stroke="#94a3b8"
            strokeWidth={WALL}
            strokeOpacity={0.7}
          />
          <path
            d="M176 36 L186 36 M266 36 L278 36"
            stroke="#ffffff"
            strokeWidth={1.2}
            strokeLinecap="round"
            opacity={0.8}
          />
          {/* A Door on its front wall, swung open into the room. */}
          <rect
            x={250}
            y={86}
            width={22}
            height={4}
            className="fill-[#f5f0e6] dark:fill-[#292524]"
          />
          <path
            d="M250 88 V71 A17 17 0 0 1 267 88"
            fill="none"
            stroke="#7c4a2d"
            strokeWidth={1.2}
            strokeDasharray="2 1.6"
          />
          <path d="M250 88 V71" stroke="#7c4a2d" strokeWidth={2} />
          <text
            x={174}
            y={42}
            fontFamily={FONT}
            fontSize={6.6}
            fontWeight={700}
            className="fill-slate-700 dark:fill-slate-200"
          >
            Focus Room
          </text>
        </g>
        {/* The L being drawn: the walls placed so far, then the rubber band to the pointer on the first corner. */}
        <Walls d={placed} len={300} delay={0.2} />
        <path
          d={`M${corners[5]![0]} ${corners[5]![1]} L${corners[0]![0]} ${corners[0]![1]}`}
          fill="none"
          stroke={ROOM_TONES.wallEdge}
          strokeWidth={WALL}
          strokeOpacity={0.45}
          strokeDasharray="4 3"
          className="fa-a-late"
        />
        {corners.map(([x, y], i) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r={2.4}
            strokeWidth={1.3}
            className="fa-a-pop fill-white stroke-emerald-600 dark:fill-slate-900 dark:stroke-emerald-400"
            style={at(0.2 + i * 0.22)}
          />
        ))}
        {/* In range of the first corner: the ring that says a click closes the room, and the pointer on it. */}
        <circle
          cx={corners[0]![0]}
          cy={corners[0]![1]}
          r={6}
          fill="none"
          strokeWidth={1.3}
          className="fa-a-late stroke-emerald-500"
        />
        <path
          d="M20 32 L20 43 L23 40 L25.5 45 L27.3 44.1 L24.9 39.3 L29 39 Z"
          strokeWidth={0.9}
          strokeLinejoin="round"
          className="fa-a-late fill-slate-900 stroke-white dark:fill-white dark:stroke-slate-900"
        />
        {/* The tool's banner (ModeBanner, the brand tone): what to do, and Cancel. */}
        <g className="fa-a-pop" style={at(0.1)}>
          <rect
            x={52}
            y={4}
            width={196}
            height={15}
            rx={7.5}
            className="fill-emerald-50 stroke-emerald-200 dark:fill-emerald-950 dark:stroke-emerald-500/40"
          />
          <text
            x={60}
            y={14}
            fontFamily={FONT}
            fontSize={6.2}
            className="fill-emerald-800 dark:fill-emerald-100"
          >
            Click to place corners, click the start to close
          </text>
          <rect
            x={214}
            y={6.5}
            width={31}
            height={10}
            rx={5}
            className="fill-white dark:fill-slate-800"
          />
          <text
            x={229.5}
            y={13.6}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize={5.6}
            fontWeight={600}
            className="fill-slate-700 dark:fill-slate-200"
          >
            Cancel
          </text>
        </g>
      </svg>
    </Frame>
  );
}
