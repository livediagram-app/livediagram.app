import { inkColour, scribble } from './backing';
import type { NoteSpec } from './layout';
import { eachNear, scaleAt, type Plane } from './raster';
import type { Rng } from './rng';

// One sticky note, painted the way a camera sees it: the shadow it casts on
// whatever is under it, a paper edge that is sometimes a dark line and
// sometimes nothing at all (two flush notes of one colour then share no visible
// seam, which is exactly the case the model must learn to cut anyway), a
// bottom that curls off the wall into light or shade, and handwriting.

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function castShadow(
  plane: Plane,
  rng: Rng,
  note: NoteSpec,
  light: { dx: number; dy: number },
): void {
  const s = Math.min(note.w, note.h);
  const soft = Math.max(0.6, s * rng.range(0.02, 0.1));
  const strength = rng.range(0.08, 0.45);
  const shifted = { ...note, cx: note.cx + light.dx * s, cy: note.cy + light.dy * s };
  eachNear(plane, shifted, soft, (p, sd) => {
    scaleAt(plane, p, 1 - strength * (1 - smooth(-soft, soft, sd)));
  });
}

export function paintNote(
  plane: Plane,
  rng: Rng,
  note: NoteSpec,
  light: { dx: number; dy: number },
): void {
  if (rng.chance(0.85)) castShadow(plane, rng, note, light);
  const s = Math.min(note.w, note.h);
  const curl = rng.range(-0.3, 0.12);
  const curlFrom = rng.range(0.5, 0.85);
  const sideShade = rng.range(-0.08, 0.08);
  const edgeWidth = Math.max(0.7, s * rng.range(0.01, 0.04));
  const edge = rng.chance(0.35) ? 1 : rng.range(0.7, 1.12);
  const grain = rng.range(0, 0.03);
  const [r, g, b] = note.colour;
  eachNear(plane, note, 0.5, (p, sd, u, v) => {
    const cover = Math.max(0, Math.min(1, 0.5 - sd));
    let f =
      1 + sideShade * (u - 0.5) + (v > curlFrom ? (curl * (v - curlFrom)) / (1 - curlFrom) : 0);
    if (sd > -edgeWidth) f *= edge;
    f *= 1 + (rng.next() - 0.5) * grain;
    const o = p * 3;
    plane.rgb[o] = plane.rgb[o]! * (1 - cover) + r * f * cover;
    plane.rgb[o + 1] = plane.rgb[o + 1]! * (1 - cover) + g * f * cover;
    plane.rgb[o + 2] = plane.rgb[o + 2]! * (1 - cover) + b * f * cover;
    if (sd < 0) plane.ids[p] = note.id;
  });
  if (rng.chance(0.9)) handwriting(plane, rng, note);
}

// Lines of writing across the note, kept inside its paper.
function handwriting(plane: Plane, rng: Rng, note: NoteSpec): void {
  const lines = rng.int(1, 4);
  const lineH = note.h * rng.range(0.1, 0.22);
  const ink = inkColour(rng);
  const width = Math.max(0.6, Math.min(note.w, note.h) * rng.range(0.012, 0.045));
  const cos = Math.cos(note.angle);
  const sin = Math.sin(note.angle);
  const top = rng.range(0.12, 0.3);
  for (let l = 0; l < lines; l += 1) {
    const v = top + l * (lineH / note.h) * rng.range(1.2, 1.6);
    if (v > 0.88) break;
    const u0 = rng.range(0.08, 0.2);
    const u1 = rng.range(0.55, 0.9);
    // Scribble in the note's own frame, then turn it with the note.
    const lx = (u0 - 0.5) * note.w;
    const ly = (v - 0.5) * note.h;
    const x = note.cx + lx * cos - ly * sin;
    const y = note.cy + lx * sin + ly * cos;
    scribble(plane, rng, x, y, (u1 - u0) * note.w, lineH, ink, width);
  }
}
