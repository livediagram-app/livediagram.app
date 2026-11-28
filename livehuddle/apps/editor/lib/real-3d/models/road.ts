// Real 3D's Road (docs/specs/009-elements/road.md): its two kerbs, standing a little proud of the asphalt (the
// carriageway and its lines are the floor's flat drawing), and the traffic's car, built once with its body apart from
// the parts that keep their colour, so one instanced mesh tints every car's body. Pure: no three.js, no DOM.
import { ROAD_KERB, ROAD_TONES } from '@livehuddle/document';
import { parseColour } from '../mesh-builder';
import { Builder, RISE, type ModelTable } from './kit';
import { car } from './rounded';

/** How high a kerb stands as built (about 3 canvas px as the pieces rise). */
export const KERB_Z = 2.2;
/** The traffic's car, canvas px: across and nose to tail (road-traffic.ts drives it). */
export const CAR_WIDTH = 48;
export const CAR_LENGTH = 92;

const KERB = parseColour(ROAD_TONES.kerb);

export const ROAD_MODELS: ModelTable = {
  road: (m, { f }) => {
    // The kerbs run along the longer side, whichever way the road is turned.
    const { x0, y0, x1, y1 } = f.foot;
    const along = x1 - x0 >= y1 - y0;
    const across = along ? y1 - y0 : x1 - x0;
    const k = Math.min(ROAD_KERB, across / 10);
    if (along) {
      m.rounded(x0, y0, 0, x1, y0 + k, KERB_Z, KERB, 0.8);
      m.rounded(x0, y1 - k, 0, x1, y1, KERB_Z, KERB, 0.8);
    } else {
      m.rounded(x0, y0, 0, x0 + k, y1, KERB_Z, KERB, 0.8);
      m.rounded(x1 - k, y0, 0, x1, y1, KERB_Z, KERB, 0.8);
    }
  },
};

/** One part of the car: its corners, their colours and normals (three numbers each). */
export type CarPart = { positions: Float32Array; colours: Float32Array; normals: Float32Array };

/**
 * The traffic's car, centred on the origin with its nose toward +y, risen as the pieces are: `body` is the shell a
 * car's colour tints (its corners in shades of white), `trim` what keeps its own colour (wheels, glass, lamps,
 * plates). Found by building the car twice, once white and once black: a corner whose colour differs is body.
 */
export function roadCar(): { body: CarPart; trim: CarPart } {
  const white = new Builder();
  car(white, 0, 0, CAR_WIDTH, CAR_LENGTH, 0xffffff, 0x9a9a9a);
  const black = new Builder();
  car(black, 0, 0, CAR_WIDTH, CAR_LENGTH, 0x000000, 0x000000);
  white.rise(RISE);
  const body = { p: [] as number[], c: [] as number[], n: [] as number[] };
  const trim = { p: [] as number[], c: [] as number[], n: [] as number[] };
  // Whole triangles go one way, by their first corner, so no triangle is split between the two.
  for (let t = 0; t < white.positions.length; t += 9) {
    const i = t;
    const tinted =
      Math.abs(white.colours[i]! - black.colours[i]!) +
        Math.abs(white.colours[i + 1]! - black.colours[i + 1]!) +
        Math.abs(white.colours[i + 2]! - black.colours[i + 2]!) >
      0.01;
    const to = tinted ? body : trim;
    for (let j = 0; j < 9; j++) {
      to.p.push(white.positions[t + j]!);
      to.c.push(white.colours[t + j]!);
      to.n.push(white.normals[t + j]!);
    }
  }
  const part = (b: typeof body): CarPart => ({
    positions: new Float32Array(b.p),
    colours: new Float32Array(b.c),
    normals: new Float32Array(b.n),
  });
  return { body: part(body), trim: part(trim) };
}
