// The loading picture's two characters (docs/specs/007-editor/blueprints/opening-screen.md "Geometry"), drawn as
// the Avatar sprite draws them (packages/avatar avatar-sprite.tsx: the tee, the `short` and `bob` hair, the walk's
// two stride frames, the seated pose) on its 16 x 24 grid and from its palette. Each view is a handful of paths, one
// per colour, so the figures cost a few hundred bytes rather than a sprite module and its walk code.

import { AVATAR_PALETTE as P } from '@liveworkspace/avatar/palette';

export type Who = 'you' | 'sam';
export type Pose = 'up' | 'left' | 'right' | 'seated';
type Figure = { shirt: string; shirtDark: string; hair: 'short' | 'bob'; female: boolean };

// The shirt takes the participant's colour on the canvas: brand cyan for you (the sprite's default), violet for
// Sam. The darker side is the sprite's own shade (22% toward black).
export const FIGURES: Record<Who, Figure> = {
  you: { shirt: P.shirt, shirtDark: '#0b81b6', hair: 'short', female: false },
  sam: { shirt: '#8b5cf6', shirtDark: '#6c48c0', hair: 'bob', female: true },
};

/** Colour → one path of every pixel run in it, in sprite grid units. */
export type Pixels = [colour: string, d: string][];

// One view, as the sprite assembles it: legs, torso and arms, head and hair. `mid` is the mid-stride frame (body a
// pixel up, arms and legs swapped). A profile is drawn facing left; facing right mirrors it.
export function figure(who: Who, pose: Pose, mid = false): Pixels {
  const f = FIGURES[who];
  const runs = new Map<string, string>();
  const mirror = pose === 'right';
  const bob = mid ? -1 : 0;
  const px = (c: string, x: number, y: number, w: number, h: number, dx = 0, dy = 0) => {
    const left = mirror ? 16 - (x + dx) - w : x + dx;
    runs.set(c, `${runs.get(c) ?? ''}M${left} ${y + dy + bob}h${w}v${h}h${-w}z`);
  };
  const leg = (x: number, lift: number) => {
    px(P.trousers, x, 15, 3, 6, 0, -lift);
    px(P.trousersDark, x + 2, 15, 1, 6, 0, -lift);
    px(P.shoe, x, 21, 3, 2, 0, -lift);
  };

  if (pose === 'left' || pose === 'right') {
    leg(mid ? 8 : 6, 0);
    leg(mid ? 5 : 7, 1);
    px(f.shirt, 5, 9, 7, 6);
    px(f.shirtDark, 10, 9, 2, 6);
    // One arm, swinging fore and aft.
    const swing = mid ? -1 : 1;
    px(f.shirt, 4, 10, 2, 4, swing);
    px(P.skin, 4, 14, 2, 2, swing);
    // The head in profile: nose pixel, hair over the back of the head.
    px(P.skin, 4, 1, 7, 8);
    px(P.skin, 3, 5, 1, 2);
    px(P.hair, 4, 0, 9, 3);
    px(P.hair, 9, 3, 4, 5);
    px(P.hairDark, 11, 3, 2, 5);
    if (f.hair === 'bob') px(P.hair, 9, 6, 4, 2);
    px(P.eye, 5, 5, 1, 1);
    px(P.skinDark, 4, 7, 2, 1);
  } else {
    const seated = pose === 'seated';
    // Seated, the body drops five rows onto the seat and the legs fold: a foreshortened thigh, the shin in front.
    const sit = seated ? 5 : 0;
    if (seated) {
      for (const x of [4, 10]) {
        px(P.trousers, x - 1, 16, 5, 2, 0, sit);
        px(P.trousersDark, x + 3, 16, 1, 2, 0, sit);
        px(P.trousersDark, x, 18, 3, 3, 0, sit);
        px(P.shoe, x, 21, 3, 2, 0, sit);
      }
    } else {
      leg(5, mid ? 1 : 0);
      leg(9, mid ? 0 : 1);
    }
    const i = f.female ? 1 : 0;
    const swing = seated ? 0 : mid ? 1 : -1;
    px(f.shirt, 4 + i, 9, 8 - i * 2, 6, 0, sit);
    px(f.shirtDark, 10 - i, 9, 2, 6, 0, sit);
    px(f.shirt, 2 + i, 9, 2, 4, 0, sit + swing);
    px(P.skin, 2 + i, 13, 2, 2, 0, sit + swing);
    px(f.shirtDark, 12 - i, 9, 2, 4, 0, sit - swing);
    px(P.skinDark, 12 - i, 13, 2, 2, 0, sit - swing);
    if (seated) {
      // Facing you: the face and the front of the hair.
      px(P.skin, 4, 1, 8, 8, 0, sit);
      px(P.skinDark, 10, 1, 2, 8, 0, sit);
      if (f.female) px(P.skinDark, 4, 8, 1, 1, 0, sit);
      px(P.hair, 3, 0, 10, 3, 0, sit);
      if (f.hair === 'short') {
        px(P.hairDark, 3, 3, 2, 3, 0, sit);
        px(P.hairDark, 11, 3, 2, 3, 0, sit);
      } else {
        px(P.hair, 2, 2, 2, 5, 0, sit);
        px(P.hairDark, 12, 2, 2, 5, 0, sit);
        px(P.hairDark, 2, 6, 12, 1, 0, sit);
      }
      px(P.eye, 6, 5, 1, 1, 0, sit);
      px(P.eye, 9, 5, 1, 1, 0, sit);
      px(P.skinDark, 7, 7, 2, 1, 0, sit);
    } else {
      // Walking away: the back of the head.
      px(P.skinDark, 4, 1, 8, 8);
      px(P.hair, 3, 0, 10, 7);
      px(P.hairDark, 11, 0, 2, 7);
      if (f.hair === 'bob') px(P.hair, 3, 5, 10, 3);
      px(P.skinDark, 5, 7, 6, 1);
    }
  }
  return [...runs];
}
