// A piece's type within its kind (docs/specs/009-elements/room-builder.md "Door types", office.md "Rug types",
// corridor.md, office.md "Glass walls"): the stored `variant` a Door, a Rug, a Corridor and a Room's walls draw from.
// Absent is a kind's first type, and a value its kind does not take draws as the first, so an unknown value never
// breaks a drawing.
//
// A LEAF module: types only from './index'.

import { CORRIDOR_VARIANTS, corridorShape } from '@livehuddle/avatar/corridor';

export {
  CORRIDOR_ARM,
  CORRIDOR_VARIANTS,
  corridorShape,
  corridorVariant,
  corridorWalls,
  type CorridorVariant,
} from '@livehuddle/avatar/corridor';

/** A Door's types (room-builder.md "Door types"), the first the one an absent `variant` draws. */
export const DOOR_VARIANTS = ['swing', 'double', 'sliding', 'revolving'] as const;

/** A Rug's types (office.md "Rug types"), the first the one an absent `variant` draws. */
export const RUG_VARIANTS = [
  'oval',
  'round',
  'bordered',
  'runner',
  'striped',
  'persian',
  'kilim',
  'doormat',
] as const;

/** A Room's wall styles (office.md "Glass walls"), the first the one an absent `variant` draws. */
export const ROOM_WALL_VARIANTS = ['solid', 'glass'] as const;

/** The kinds whose drawing reads a stored `variant`, each with its types in order. */
const STORED_VARIANTS: Readonly<Record<string, readonly string[]>> = {
  // A Room's walls (office.md "Glass walls"): Solid or Glass. Its presets are not stored (room-preset-shapes).
  room: ROOM_WALL_VARIANTS,
  // The Meeting Table and its Long Table (office.md "Long Table").
  'meeting-table': ['standard', 'long'],
  door: DOOR_VARIANTS,
  rug: RUG_VARIANTS,
  corridor: CORRIDOR_VARIANTS,
};

/** Whether a kind keeps its type in `variant`. */
export function storesVariant(kind: string): boolean {
  return Object.hasOwn(STORED_VARIANTS, kind);
}

/** The types a kind takes, in palette order; none for a kind that stores no variant. */
export function variantsOf(kind: string): readonly string[] {
  return Object.hasOwn(STORED_VARIANTS, kind) ? STORED_VARIANTS[kind]! : [];
}

/** The type a piece draws: its stored `variant` when its kind takes it, else the kind's first (or '' for none). */
export function pieceVariant(el: { shape: string; variant?: unknown }): string {
  const types = variantsOf(el.shape);
  return typeof el.variant === 'string' && types.includes(el.variant)
    ? el.variant
    : (types[0] ?? '');
}

// The longest a stored variant may be, and what it may be made of: a short lowercase word or words joined by hyphens.
export const PIECE_VARIANT_MAX = 32;

/** Whether a stored `variant` is well formed (validate-shape): 1 to 32 lowercase letters and hyphens. */
export function isPieceVariant(v: unknown): v is string {
  if (typeof v !== 'string' || v.length === 0 || v.length > PIECE_VARIANT_MAX) return false;
  for (const ch of v) if (ch !== '-' && (ch < 'a' || ch > 'z')) return false;
  return true;
}

/** Each type's size where it is not its kind's default (DEFAULTS.md D221, D223, D225). */
export const PIECE_VARIANT_SIZES: Readonly<
  Record<string, Readonly<Record<string, { width: number; height: number }>>>
> = {
  'meeting-table': { long: { width: 560, height: 168 } },
  door: { double: { width: 144, height: 24 }, sliding: { width: 120, height: 24 } },
  rug: {
    round: { width: 160, height: 160 },
    bordered: { width: 240, height: 160 },
    runner: { width: 320, height: 88 },
    striped: { width: 220, height: 150 },
    persian: { width: 260, height: 170 },
    kilim: { width: 240, height: 150 },
    doormat: { width: 120, height: 72 },
  },
  corridor: {
    corner: { width: 360, height: 360 },
    tee: { width: 480, height: 360 },
    cross: { width: 480, height: 480 },
  },
};

const r2 = (v: number) => Math.round(v * 100) / 100;

/** A run of points as an SVG path, closed (a floor) or open (a wall run). */
function pointsPath(pts: readonly { x: number; y: number }[], closed: boolean): string {
  return (
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${r2(p.x)} ${r2(p.y)}`).join(' ') +
    (closed ? ' Z' : '')
  );
}

/** A Corridor's drawing in its own px as SVG paths (corridor.md): its floor, and its wall runs (open at the ends),
 *  stroked ROOM_WALL wide by the canvas and the export alike. */
export function corridorPaths(
  width: number,
  height: number,
  variant: unknown,
): { floor: string; walls: string } {
  const { floor, walls } = corridorShape(width, height, variant);
  return {
    floor: pointsPath(floor, true),
    walls: walls.map((run) => pointsPath(run, false)).join(' '),
  };
}
