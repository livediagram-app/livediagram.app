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
  | 'rug'
  | 'jukebox'
  | 'arcade-machine'
  | 'notice-board'
  | 'ping-pong-table'
  | 'fireplace'
  | 'office-pod'
  | 'drinks-fridge';
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
  // Below lg, where the wide stage hides its wings (BACK_ROW_Y, FLOOR_CLIP_Y), the path walked instead, for a walker
  // whose own path crosses a clip line: so nobody vanishes mid-walk at tablet widths (FLOOR_ONLY).
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

// The wide stage: 1600 by 1152 (the band's tallest, hero-tall.css's 72rem cap), its foot on the band's foot. The
// copy stands on the floor (Hero.tsx keeps none of the band's extra height under it), so it is always at the same
// place on the stage: the calls to action's foot FLOOR_ROOM over the foot (y 836) and the badges 352px over that
// (y 484). The headline is the widest line, 792px at 72px type, over x 404..1196 at any window from lg, so the
// keep-clear column is a little wider. The band is never shorter than 748px from lg, so everything from y 404 down
// always shows: the wings either side of the copy hold the coffee corner and the desks, the floor under the calls to
// action the meeting table. A taller window shows more of the room above, the back of the office (BACK_ROW_Y), and a
// shorter one crops it from the top, as a narrower one crops the wings.
const WIDE: FloorStage = {
  key: 'wide',
  width: 1600,
  height: 1152,
  clear: { x: 380, y: 470, width: 840, height: 376 },
  furniture: [
    // The back of the office, one row standing on y 280: a bookshelf, the jukebox and the arcade machine on the
    // left, the notice board, the ping-pong table and the fireplace in the middle, an office pod, a drinks fridge and
    // a plant on the right. It spans y 150..298 (BACK_ROW_SPAN), so a 1440x900 window (its band showing from y 324)
    // leaves it out whole and a 1920x1080 one (from y 144) shows it whole.
    { kind: 'bookshelf', x: 104, y: 174 },
    { kind: 'jukebox', x: 226, y: 190 },
    { kind: 'arcade-machine', x: 300, y: 190 },
    { kind: 'notice-board', x: 470, y: 178 },
    { kind: 'ping-pong-table', x: 727, y: 190 },
    { kind: 'fireplace', x: 1010, y: 184 },
    { kind: 'office-pod', x: 1236, y: 165 },
    { kind: 'drinks-fridge', x: 1404, y: 178 },
    { kind: 'plant', x: 1470, y: 210 },
    // The coffee corner, on the left wing.
    { kind: 'rug', x: 190, y: 590, width: 186 },
    { kind: 'bookshelf', x: 96, y: 442 },
    { kind: 'coffee-machine', x: 226, y: 470 },
    { kind: 'water-cooler', x: 300, y: 458 },
    { kind: 'plant', x: 120, y: 660 },
    // The desks and the sofa, on the right wing.
    { kind: 'desk', x: 1236, y: 434, facing: 'n' },
    { kind: 'desk', x: 1340, y: 434, facing: 'n' },
    { kind: 'plant', x: 1460, y: 450 },
    { kind: 'sofa', x: 1288, y: 620, facing: 's' },
    { kind: 'plant', x: 1430, y: 630 },
    // The floor under the calls to action: Leo's desks on the left (his way up to the coffee corner beside them, never
    // through them), the meeting table on its rug in the middle, the water cooler and a bookshelf on the right.
    { kind: 'desk', x: 130, y: 942, facing: 'n' },
    { kind: 'desk', x: 234, y: 942, facing: 'n' },
    { kind: 'plant', x: 516, y: 964 },
    { kind: 'rug', x: 640, y: 892, width: 320 },
    { kind: 'meeting-table', x: 707, y: 916 },
    { kind: 'plant', x: 1020, y: 964 },
    { kind: 'water-cooler', x: 1140, y: 938 },
    { kind: 'bookshelf', x: 1290, y: 912 },
  ],
  cast: [
    // At the table: Maya and Sam, one at each end, talking across it; Maya turns to answer Jo's wave.
    {
      name: 'Maya',
      colour: '#10b981',
      config: tee('female', 'ponytail', 'tee'),
      from: { x: 676, y: 1044 },
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
      from: { x: 924, y: 1044 },
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
      from: { x: 290, y: 630 },
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
      from: { x: 282, y: 1072 },
      beats: [
        { stay: 1.9, face: 'up' },
        { to: { x: 355, y: 1072 } },
        { to: { x: 355, y: 630 } },
        { stay: 3.7, face: 'left' },
        { stay: 3, face: 'left', say: 'Always ☕' },
        { stay: 3.4, face: 'left' },
        { stay: 3, face: 'left', say: 'Sounds good' },
        { to: { x: 355, y: 1072 } },
        { to: { x: 282, y: 1072 } },
        { stay: 3, face: 'up' },
      ],
      // Below lg the coffee corner is clipped away, so Leo stays on the floor: he joins the table as Sam heads off
      // to stand-up, and goes back to his desk.
      floorBeats: [
        { stay: 14.5, face: 'up' },
        { to: { x: 590, y: 1072 } },
        { stay: 5.5, face: 'right' },
        { stay: 3, face: 'right', say: 'Right behind you' },
        { to: { x: 282, y: 1072 } },
        { stay: 0.1, face: 'up' },
      ],
    },
    // At the back of the office, either end of the ping-pong table: Noor and Ravi, a game and a rematch, inside the
    // back row's span with their bubbles and chips.
    {
      name: 'Noor',
      colour: '#6366f1',
      config: tee('female', 'bun', 'varsity'),
      from: { x: 700, y: 276 },
      beats: [
        { stay: 2, face: 'right' },
        { stay: 3, face: 'right', say: 'Your serve!' },
        { stay: 11, face: 'right' },
        { stay: 3, face: 'right', say: 'Best of three?' },
        { stay: 11, face: 'right' },
      ],
    },
    {
      name: 'Ravi',
      colour: '#f97316',
      config: tee('male', 'buzz', 'turtleneck'),
      from: { x: 900, y: 276 },
      beats: [
        { stay: 6, face: 'left' },
        { stay: 3, face: 'left', say: 'Ready? Here it comes' },
        { stay: 11, face: 'left' },
        { stay: 3, face: 'left', say: 'You’re on!' },
        { stay: 7, face: 'left' },
      ],
    },
    // On the sofa: Priya and Kit, sitting and catching up.
    {
      name: 'Priya',
      colour: '#ec4899',
      config: tee('female', 'bob', 'jumper'),
      seated: true,
      from: { x: 1324, y: 682 },
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
      from: { x: 1378, y: 682 },
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
      from: { x: 1220, y: 1052 },
      beats: [
        { stay: 4, face: 'left' },
        { to: { x: 1220, y: 1124 } },
        { to: { x: 800, y: 1124 } },
        { stay: 3, face: 'down', say: 'Morning all!', wave: true },
        { stay: 3, face: 'up' },
        { to: { x: 1220, y: 1124 } },
        { to: { x: 1220, y: 1052 } },
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

// Below lg the copy spans the window, so the wide stage hides its wings: it shows the back of the office above
// BACK_ROW_Y (higher than the copy's top at every width from sm) and the floor below FLOOR_CLIP_Y (the calls to
// action's foot), both in stage px (app/hero-scenes/space-floor.css `.hsf-floor-only`). From lg the band is never
// shorter than 748px, so from BACK_ROW_Y down the stage always shows.
export const BACK_ROW_Y = 404;
export const FLOOR_CLIP_Y = 842;

// Where the back of the office stands, top and foot in stage px: wholly hidden by a 1440x900 window (its band
// showing from y 324) and wholly shown by a 1920x1080 one (from y 144), the commonest laptop and desktop screens.
export const BACK_ROW_SPAN = { top: 144, foot: 324 } as const;

// The wide stage below lg: not a stage of its own (it draws on the wide stage, over its floor), only the walkers whose
// own path crosses a clip line, each on its floor path. Between the lines is all copy to them.
export const FLOOR_ONLY: FloorStage = {
  key: 'floor',
  width: WIDE.width,
  height: WIDE.height,
  clear: { x: 0, y: BACK_ROW_Y, width: WIDE.width, height: FLOOR_CLIP_Y - BACK_ROW_Y },
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
