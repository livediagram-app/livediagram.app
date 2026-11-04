// The Space feature scene (docs/specs/019-marketing/marketing-site.md "Feature scenes"): who walks into the Team Pod, the way
// they come, and what the room does once they are in. Pure data, in the Team Pod template's own canvas coordinates
// (buildTemplate('team-pod', 0, 0), whose room spans x -550..210 and y -252..228 with its door at x -212..-128), so
// the characters stand where the template's furniture is. hero-space-scene.tsx draws it; app/hero-scenes/space.css
// moves it.

import type { AvatarConfig } from '@liveworkspace/avatar/config';
import type { AvatarFacing } from '@liveworkspace/avatar/walk';

// The stage: the pod and its board, a little paper round them. Both room drawings are written to this box
// (public/hero/team-pod-*.svg, lib/hero-space-room.test.tsx), so the image and the characters share one frame.
export const SPACE_STAGE = { x: -560, y: -262, width: 1120, height: 500 } as const;
export const SPACE_VIEWBOX = `${SPACE_STAGE.x} ${SPACE_STAGE.y} ${SPACE_STAGE.width} ${SPACE_STAGE.height}`;

// The room drawings, one per appearance, served from the marketing app's public/ folder.
export const SPACE_ROOM_HREF = {
  light: '/hero/team-pod-light.svg',
  dark: '/hero/team-pod-dark.svg',
} as const;

// The characters' sprite sheet: every still the scene shows, one <symbol> each, drawn by Avatar mode's own sprite
// (lib/hero-space-room.test.tsx writes it), so the page's HTML holds a <use> per still rather than its pixels.
export const CAST_SHEET_HREF = '/hero/team-cast.svg';

// The paper each drawing is inked for: the Default canvas's light paper and its dark one (pen-colours.ts).
export const SPACE_PAPER = { light: '#fbfaf7', dark: '#0d121a' } as const;

// The size every character is drawn at: Regular, as the Avatar panel's default.
export const SPACE_AVATAR_SCALE = 1.5;

// Where everyone comes in: under the pod's doorway, just below the window's edge.
export const DOOR = { x: -170, y: 262 } as const;

// Walking pace in canvas px per second (Avatar mode walks at 260; the hero strolls).
export const WALK_SPEED = 170;

// One stride frame, as the editor's walk cycle alternates its two frames.
export const STRIDE_S = 0.3;

export type Point = { x: number; y: number };

export type CastMember = {
  name: string;
  // The participant colour: the shirt and the name chip.
  colour: string;
  config: AvatarConfig;
  // Where the character first shows, and when (seconds after load).
  from: Point;
  start: number;
  // When it sets off, for one already in the room at `start` (Ana, by the coffee machine).
  leaves?: number;
  // The waypoints after `from`, walked in turn at WALK_SPEED.
  path: Point[];
  // The way it faces once it stops.
  rest: AvatarFacing;
  // A drink in the hand from the start (the coffee machine's).
  holding?: 'coffee';
  // Its reaction once everyone is in, on the room's loop: a cheer (Avatar mode's hop, arms up) or a wave.
  reaction?: { kind: 'cheer' | 'wave'; at: number };
};

// Five teammates. Ana is already by the coffee machine; the other four walk in through the door one after
// another, then everyone gathers round the meeting table (x -110..122, y -172..-4) for the stand-up: one at each
// end, three along its near side. The paths go round the furniture (the bookshelf is x 50..170, y 48..180).
export const CAST: readonly CastMember[] = [
  {
    name: 'Maya',
    colour: '#10b981',
    config: { gender: 'female', clothing: 'tee', hair: 'ponytail', size: 'regular' },
    from: DOOR,
    start: 0.4,
    path: [
      { x: -170, y: 90 },
      { x: -64, y: 90 },
      { x: -64, y: 44 },
    ],
    rest: 'down',
  },
  {
    name: 'Sam',
    colour: '#0ea5e9',
    config: { gender: 'male', clothing: 'hoodie', hair: 'short', size: 'regular' },
    from: DOOR,
    start: 1.2,
    path: [{ x: -170, y: -48 }],
    rest: 'right',
    reaction: { kind: 'wave', at: 8.0 },
  },
  {
    name: 'Priya',
    colour: '#ec4899',
    config: { gender: 'female', clothing: 'jumper', hair: 'bob', size: 'regular' },
    from: DOOR,
    start: 2.0,
    path: [
      { x: -170, y: 130 },
      { x: 6, y: 130 },
      { x: 6, y: 44 },
    ],
    rest: 'down',
  },
  {
    name: 'Leo',
    colour: '#f59e0b',
    config: { gender: 'male', clothing: 'flannel', hair: 'curly', size: 'regular' },
    from: DOOR,
    start: 2.8,
    path: [
      { x: -170, y: 206 },
      { x: 186, y: 206 },
      { x: 186, y: -48 },
    ],
    rest: 'left',
    reaction: { kind: 'cheer', at: 10.4 },
  },
  {
    name: 'Ana',
    colour: '#8b5cf6',
    config: { gender: 'female', clothing: 'suit', hair: 'long', size: 'regular' },
    from: { x: -392, y: 186 },
    start: 0,
    leaves: 2.8,
    path: [
      { x: -392, y: 196 },
      { x: 30, y: 196 },
      { x: 30, y: 44 },
      { x: 76, y: 44 },
    ],
    rest: 'down',
    holding: 'coffee',
  },
];

// What the room says once it is in, one at a time, on a loop of LOOP_S seconds (space.css's 12s): each bubble
// shows for SAY_S of it, so the lines stand far enough apart that two never share the room. `who` is a CAST name.
export const LOOP_S = 12;
export const SAY_S = LOOP_S * 0.23;
export const SPEECH: readonly { who: string; text: string; at: number }[] = [
  { who: 'Maya', text: 'Morning all! Stand-up?', at: 7.4 },
  { who: 'Leo', text: 'Beta is out! 🎉', at: 10.4 },
  { who: 'Priya', text: 'Two wins on the board', at: 13.4 },
  { who: 'Ana', text: 'Coffee first ☕', at: 16.4 },
];

// The Team Board's stickies (the template's): This week, Blocked on, Wins, Questions, 146 square from x 250.
export const BOARD = {
  thisWeek: { x: 250, y: -208 },
  blocked: { x: 404, y: -208 },
  wins: { x: 250, y: -54 },
  questions: { x: 404, y: -54 },
  size: 146,
} as const;

// A teammate on the board from their laptop: their cursor writes a note into Wins, then the room votes.
export const REMOTE = { name: 'Kit', colour: '#14b8a6' } as const;
export const NOTE = { text: 'Beta shipped', at: 8.0 } as const;
export const VOTES: readonly {
  sticky: keyof typeof BOARD;
  dx: number;
  colour: string;
  at: number;
}[] = [
  { sticky: 'wins', dx: 0, colour: '#10b981', at: 9.8 },
  { sticky: 'wins', dx: 1, colour: '#ec4899', at: 10.1 },
  { sticky: 'wins', dx: 2, colour: '#f59e0b', at: 10.4 },
  { sticky: 'thisWeek', dx: 0, colour: '#0ea5e9', at: 10.7 },
  { sticky: 'questions', dx: 0, colour: '#8b5cf6', at: 11.0 },
];

/** The straight legs of a walk: each waypoint's offset from the last, its duration and the way it faces. */
export function legsOf(member: CastMember): {
  dx: number;
  dy: number;
  start: number;
  duration: number;
  facing: AvatarFacing;
}[] {
  const legs = [];
  let at = member.leaves ?? member.start;
  let last = member.from;
  for (const point of member.path) {
    const dx = point.x - last.x;
    const dy = point.y - last.y;
    const duration = Math.hypot(dx, dy) / WALK_SPEED;
    const facing: AvatarFacing =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    legs.push({ dx, dy, start: at, duration, facing });
    at += duration;
    last = point;
  }
  return legs;
}

/** When the member stops for good. */
export function arrivalOf(member: CastMember): number {
  const legs = legsOf(member);
  const lastLeg = legs[legs.length - 1]!;
  return lastLeg.start + lastLeg.duration;
}

/** Where the member ends up. */
export function restOf(member: CastMember): Point {
  return member.path[member.path.length - 1] ?? member.from;
}

/** One still the scene shows of a character: how it stands or strides, and what it is doing. */
export type StillKey =
  'idle' | 'stand' | `walk-${AvatarFacing}-${0 | 1}` | `cheer-${0 | 1 | 2}` | `wave-${0 | 1}`;

/** A still's id in the sprite sheet. */
export function stillId(member: CastMember, key: StillKey): string {
  return `${member.name.toLowerCase()}-${key}`;
}

/** Every still the scene shows of the member, so the sheet holds exactly those. */
export function stillKeysOf(member: CastMember): StillKey[] {
  const keys: StillKey[] = member.leaves === undefined ? [] : ['idle'];
  for (const leg of legsOf(member)) {
    for (const step of [0, 1] as const) {
      const key: StillKey = `walk-${leg.facing}-${step}`;
      if (!keys.includes(key)) keys.push(key);
    }
  }
  keys.push('stand');
  if (member.reaction?.kind === 'cheer') keys.push('cheer-0', 'cheer-1', 'cheer-2');
  if (member.reaction?.kind === 'wave') keys.push('wave-0', 'wave-1');
  return keys;
}

// The cheer's three heights (Avatar mode's hop, arms up): on the ground, rising and at the top.
export const CHEER_LIFTS = [0, 12, 20] as const;
