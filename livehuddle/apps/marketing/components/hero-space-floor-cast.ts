// The landing hero's Space (docs/specs/019-marketing/marketing-site.md "Hero"): the band is the floor, the office
// furniture stands round its edges and the team walks about it, stops in small groups and talks. Pure data, in stage
// px: each stage is drawn 1:1 (never scaled), centred on the band's foot, so a narrower window crops its edges and
// the characters keep their size. hero-space-floor-motion.ts turns the walks into keyframes; HeroSpaceStage.tsx draws
// it; lib/hero-space-floor.test.tsx writes the furniture, the sprite sheet and the keyframes from it.

import type { AvatarConfig } from '@liveworkspace/avatar/config';
import type { AvatarFacing } from '@liveworkspace/avatar/walk';

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

// Every character at 1.2, a touch under the canvas's Regular (1.5), so a sprite grid pixel is a whole 3 px; the
// furniture is drawn at the same ratio of its canvas size, so a character still fits a seat.
export const FLOOR_AVATAR_SCALE = 1.2;
export const FLOOR_FURNITURE_SCALE = FLOOR_AVATAR_SCALE / 1.5;

// One loop of the whole floor, in seconds: every walk, stop and line repeats on it.
export const LOOP_S = 30;
// Strolling pace, in stage px per second (Avatar mode walks at 260; a hero strolls).
export const WALK_SPEED = 90;
// One stride frame, as the editor's walk cycle alternates its two frames.
export const STRIDE_S = 0.3;
// One swing of a wave, as Avatar mode's raised hand crosses back and forth.
export const WAVE_SWING_S = 0.4;
// The moment of the loop reduced motion shows, held still.
export const SETTLED_AT = 14;

// A piece of the editor's office furniture, at its top left in stage px. `facing` is the seating's (chair.md);
// `width` overrides the drawing's size (its proportion kept), scaled with everything else.
export type FurnitureKind =
  | 'desk'
  | 'sofa'
  | 'chair'
  | 'meeting-table'
  | 'plant'
  | 'bookshelf'
  | 'water-cooler'
  | 'coffee-machine'
  | 'rug';
export type Furniture = {
  kind: FurnitureKind;
  x: number;
  y: number;
  facing?: 'n' | 's' | 'e' | 'w';
  width?: number;
};

// What a character does, in turn: walk straight to a point, or stop facing a way for a while, perhaps saying a
// line, perhaps waving. A walk's legs are straight, so every path is a run of horizontal and vertical moves.
export type Beat = { to: Point } | { stay: number; face: AvatarFacing; say?: string; wave?: true };

export type Walker = {
  name: string;
  // The participant colour: the shirt, the name chip and the bubble's edge.
  colour: string;
  config: AvatarConfig;
  // Where the loop starts and ends: the walks come back here.
  from: Point;
  beats: Beat[];
  holding?: 'coffee';
  // Sitting on the sofa the whole loop (the sprite's seated pose).
  seated?: true;
  // Below lg, where the wide stage shows its floor alone (FLOOR_CLIP_Y), the path walked instead, for a walker whose
  // own path crosses the clip line: so nobody vanishes mid-walk at tablet widths (FLOOR_ONLY).
  floorBeats?: Beat[];
};

export type FloorStage = {
  key: 'wide' | 'floor' | 'phone';
  width: number;
  height: number;
  // Where the copy stands over the stage, in stage px: nothing here enters it.
  clear: Rect;
  furniture: Furniture[];
  cast: Walker[];
};

const tee = (
  gender: 'male' | 'female',
  hair: AvatarConfig['hair'],
  clothing: AvatarConfig['clothing'],
) => ({ gender, hair, clothing, size: 'regular' }) as AvatarConfig;

// The wide stage: 1600 by 800, its foot on the band's foot. At 1440px the copy stands over x 470..1130 and down to
// y 485 (the calls to action's foot), so the keep-clear column is a little wider; the wings either side hold the
// coffee corner and the desks, the floor under the calls to action holds the meeting table.
const WIDE: FloorStage = {
  key: 'wide',
  width: 1600,
  height: 800,
  clear: { x: 440, y: 40, width: 720, height: 460 },
  furniture: [
    // The coffee corner, on the left wing.
    { kind: 'rug', x: 206, y: 262, width: 220 },
    { kind: 'bookshelf', x: 96, y: 112 },
    { kind: 'coffee-machine', x: 226, y: 140 },
    { kind: 'water-cooler', x: 300, y: 128 },
    { kind: 'plant', x: 372, y: 148 },
    { kind: 'plant', x: 120, y: 330 },
    // The desks and the sofa, on the right wing.
    { kind: 'desk', x: 1196, y: 104, facing: 'n' },
    { kind: 'desk', x: 1300, y: 104, facing: 'n' },
    { kind: 'plant', x: 1420, y: 120 },
    { kind: 'sofa', x: 1248, y: 290, facing: 's' },
    { kind: 'plant', x: 1390, y: 300 },
    // The floor under the calls to action: Leo's desks on the left, the meeting table on its rug in the middle,
    // the water cooler and a bookshelf on the right.
    { kind: 'desk', x: 270, y: 590, facing: 'n' },
    { kind: 'desk', x: 374, y: 590, facing: 'n' },
    { kind: 'plant', x: 540, y: 612 },
    { kind: 'rug', x: 640, y: 540, width: 320 },
    { kind: 'meeting-table', x: 707, y: 564 },
    { kind: 'plant', x: 1020, y: 612 },
    { kind: 'water-cooler', x: 1140, y: 586 },
    { kind: 'bookshelf', x: 1290, y: 560 },
  ],
  cast: [
    // At the table: Maya and Sam, one at each end, talking across it; Maya turns to answer Jo's wave.
    {
      name: 'Maya',
      colour: '#10b981',
      config: tee('female', 'ponytail', 'tee'),
      from: { x: 676, y: 692 },
      beats: [
        { stay: 0.5, face: 'right' },
        { stay: 3, face: 'right', say: 'Got a minute?' },
        { stay: 9.1, face: 'right' },
        { stay: 3, face: 'down', say: 'Morning, Jo!' },
        { stay: 1.4, face: 'right' },
        { stay: 3, face: 'right', say: 'Stand-up in 5' },
        { stay: 10, face: 'right' },
      ],
    },
    {
      name: 'Sam',
      colour: '#0ea5e9',
      config: tee('male', 'short', 'hoodie'),
      from: { x: 924, y: 692 },
      beats: [
        { stay: 3.9, face: 'left' },
        { stay: 3, face: 'left', say: 'Sure, pull up a chair' },
        { stay: 13.5, face: 'left' },
        { stay: 3, face: 'left', say: 'On my way' },
        { stay: 6.6, face: 'left' },
      ],
    },
    // The coffee corner: Ana by the machine with her cup; Leo comes up from his desk for one and goes back.
    {
      name: 'Ana',
      colour: '#8b5cf6',
      config: tee('female', 'long', 'suit'),
      holding: 'coffee',
      from: { x: 290, y: 300 },
      beats: [
        { stay: 7.6, face: 'right' },
        { stay: 3, face: 'right', say: 'Coffee?' },
        { stay: 3.8, face: 'right' },
        { stay: 3, face: 'right', say: 'Catch up after?' },
        { stay: 12.6, face: 'down' },
      ],
    },
    {
      name: 'Leo',
      colour: '#f59e0b',
      config: tee('male', 'curly', 'flannel'),
      from: { x: 322, y: 720 },
      beats: [
        { stay: 1.9, face: 'up' },
        { to: { x: 410, y: 720 } },
        { to: { x: 410, y: 300 } },
        { stay: 3.8, face: 'left' },
        { stay: 3, face: 'left', say: 'Always ☕' },
        { stay: 3.4, face: 'left' },
        { stay: 3, face: 'left', say: 'Sounds good' },
        { to: { x: 410, y: 720 } },
        { to: { x: 322, y: 720 } },
        { stay: 3, face: 'up' },
      ],
      // Below lg the coffee corner is clipped away, so Leo stays on the floor: he joins the table as Sam heads off
      // to stand-up, and goes back to his desk.
      floorBeats: [
        { stay: 14.5, face: 'up' },
        { to: { x: 604, y: 720 } },
        { stay: 6.1, face: 'right' },
        { stay: 3, face: 'right', say: 'Right behind you' },
        { to: { x: 322, y: 720 } },
        { stay: 0.1, face: 'up' },
      ],
    },
    // On the sofa: Priya and Kit, sitting and catching up.
    {
      name: 'Priya',
      colour: '#ec4899',
      config: tee('female', 'bob', 'jumper'),
      seated: true,
      from: { x: 1284, y: 352 },
      beats: [
        { stay: 1, face: 'down' },
        { stay: 3, face: 'down', say: 'How was the trip?' },
        { stay: 8, face: 'down' },
        { stay: 3, face: 'down', say: 'Lunch later?' },
        { stay: 15, face: 'down' },
      ],
    },
    {
      name: 'Kit',
      colour: '#14b8a6',
      config: tee('male', 'spiky', 'polo'),
      seated: true,
      from: { x: 1338, y: 352 },
      beats: [
        { stay: 4.4, face: 'down' },
        { stay: 3, face: 'down', say: 'Lovely, thanks!' },
        { stay: 8, face: 'down' },
        { stay: 3, face: 'down', say: 'Yes please' },
        { stay: 11.6, face: 'down' },
      ],
    },
    // Jo, the long way round: from the water cooler along the front of the floor, a wave to the table, and back.
    {
      name: 'Jo',
      colour: '#ef4444',
      config: tee('female', 'afro', 'stripes'),
      from: { x: 1220, y: 700 },
      beats: [
        { stay: 4, face: 'left' },
        { to: { x: 1220, y: 772 } },
        { to: { x: 800, y: 772 } },
        { stay: 3, face: 'down', say: 'Morning all!', wave: true },
        { stay: 3, face: 'up' },
        { to: { x: 1220, y: 772 } },
        { to: { x: 1220, y: 700 } },
        { stay: 2, face: 'left' },
      ],
    },
  ],
};

// The phone's stage: 640 by 280, in the flow under the calls to action, centred, so a 390px phone sees its middle
// x 125..515. Three characters round the table, a plant and the coffee machine; nothing beside the copy.
const PHONE: FloorStage = {
  key: 'phone',
  width: 640,
  height: 280,
  clear: { x: 0, y: -400, width: 640, height: 400 },
  furniture: [
    { kind: 'rug', x: 196, y: 40, width: 248 },
    { kind: 'meeting-table', x: 227, y: 50 },
    { kind: 'plant', x: 146, y: 64 },
    { kind: 'coffee-machine', x: 446, y: 52 },
  ],
  cast: [
    {
      name: 'Maya',
      colour: '#10b981',
      config: tee('female', 'ponytail', 'tee'),
      from: { x: 206, y: 178 },
      beats: [
        { stay: 3, face: 'right', say: 'Got a minute?' },
        { stay: 9, face: 'right' },
        { stay: 3, face: 'right', say: 'Stand-up in 5' },
        { stay: 15, face: 'right' },
      ],
    },
    {
      name: 'Sam',
      colour: '#0ea5e9',
      config: tee('male', 'short', 'hoodie'),
      from: { x: 434, y: 178 },
      beats: [
        { stay: 3.4, face: 'left' },
        { stay: 3, face: 'left', say: 'Sure thing' },
        { stay: 9.6, face: 'left' },
        { stay: 3, face: 'left', say: 'On my way' },
        { stay: 11, face: 'left' },
      ],
    },
    {
      name: 'Jo',
      colour: '#ef4444',
      config: tee('female', 'afro', 'stripes'),
      from: { x: 480, y: 254 },
      beats: [
        { stay: 5, face: 'left' },
        { to: { x: 320, y: 254 } },
        { stay: 3, face: 'down', say: 'Morning all!', wave: true },
        { to: { x: 480, y: 254 } },
        { stay: 2, face: 'left' },
      ],
    },
  ],
};

export const FLOOR_STAGES: readonly FloorStage[] = [WIDE, PHONE];

// Below lg the copy spans the window, so the wide stage shows its floor alone, clipped above this line (stage px, the
// calls to action's foot; app/hero-scenes/space-floor.css `.hsf-floor-only`).
export const FLOOR_CLIP_Y = 490;

// The wide stage below lg: not a stage of its own (it draws on the wide stage, over its floor), only the walkers whose
// own path crosses the clip line, each on its floor path. Above the line is all copy to them.
export const FLOOR_ONLY: FloorStage = {
  key: 'floor',
  width: WIDE.width,
  height: WIDE.height,
  clear: { x: 0, y: 0, width: WIDE.width, height: FLOOR_CLIP_Y },
  furniture: [],
  cast: WIDE.cast.flatMap((walker) =>
    walker.floorBeats ? [{ ...walker, beats: walker.floorBeats }] : [],
  ),
};

// Every set of walkers the hero moves: its keyframes and sprite sheet cover them all.
export const FLOOR_MOTION: readonly FloorStage[] = [WIDE, FLOOR_ONLY, PHONE];

// The drawings, one per stage and appearance, and the characters' sprite sheet, from the app's public/ folder.
export const floorArtHref = (stage: FloorStage['key'], scheme: 'light' | 'dark') =>
  `/hero/floor-${stage}-${scheme}.svg`;
export const FLOOR_CAST_HREF = '/hero/floor-cast.svg';

// The ground each drawing is inked for: the hero band's own (packages/ui/hero-band.css), so the renderer picks the
// light canvas's ink on the pale emerald and the dark canvas's on the deepest slate.
export const FLOOR_PAPER = { light: '#ecfdf5', dark: '#020617' } as const;

// The rugs' weave: a warm sand on the pale emerald, a slate a step up from the dark band.
export const FLOOR_RUG = { light: '#fef9e7', dark: '#1e293b' } as const;
