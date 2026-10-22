// Brush tips (docs/specs/031-photo/photo-tools.md "Shared gestures and options"): a round tip with a
// hardness (full strength out to the hardness, then falling smoothly to nothing at its edge), the
// Pencil's hard round or square tip, each as a coverage map one byte a pixel, centred on the dab's
// sub-pixel position so a slow stroke stays smooth.

export type TipShape = 'round' | 'square';

export type Tip = {
  // The map's side and where its centre falls (the dab's centre is at `ox`, `oy` in it).
  size: number;
  ox: number;
  oy: number;
  data: Float32Array;
};

/** How strong a round soft tip is at `r` (0 at the centre, 1 at the edge), for a hardness 0..1. */
export function roundFalloff(r: number, hardness: number): number {
  if (r >= 1) return 0;
  if (r <= hardness) return 1;
  const t = (r - hardness) / (1 - hardness);
  // A smooth shoulder: Photoshop's soft round is close to this.
  const s = 1 - t * t;
  return s * s;
}

/** The tip for a dab of `diameter` px at the sub-pixel position (fx, fy) within its pixel (0..1). */
export function makeTip(
  diameter: number,
  hardness: number,
  shape: TipShape = 'round',
  aliased = false,
  fx = 0.5,
  fy = 0.5,
): Tip {
  const d = Math.max(1, diameter);
  const radius = d / 2;
  const size = Math.ceil(d) + 2;
  // The dab's centre in the map: its pixel is the map's middle one (floor of half its side), so the
  // map's left edge sits at that pixel less floor(size / 2) (tipOrigin).
  const ox = Math.floor(size / 2) + (fx - 0.5);
  const oy = Math.floor(size / 2) + (fy - 0.5);
  const data = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = x - ox;
      const dy = y - oy;
      let v: number;
      if (shape === 'square') {
        const m = Math.max(Math.abs(dx), Math.abs(dy));
        v = aliased ? (m <= radius - 0.5 ? 1 : 0) : Math.min(1, Math.max(0, radius - m + 0.5));
      } else if (aliased) {
        // A pixel is in when its centre is inside the circle; the centre pixel always is.
        v = Math.hypot(dx, dy) < Math.max(0.5, radius) ? 1 : 0;
      } else {
        const r = Math.hypot(dx, dy) / radius;
        // A hard tip still gets a pixel of anti-aliasing at its edge.
        const edge = Math.min(1, Math.max(0, radius - Math.hypot(dx, dy) + 0.5));
        v = hardness >= 1 ? edge : Math.min(edge, roundFalloff(r, hardness));
      }
      data[y * size + x] = v;
    }
  return { size, ox, oy, data };
}

/** The layer pixel the tip map's top-left pixel lands on, for a dab centred at (cx, cy). */
export function tipOrigin(tip: Tip, cx: number, cy: number): { x: number; y: number } {
  const half = Math.floor(tip.size / 2);
  return { x: Math.floor(cx) - half, y: Math.floor(cy) - half };
}

// Tips of the same size and hardness repeat: cached by their rounded settings.
const CACHE = new Map<string, Tip>();
const CACHE_MAX = 64;

/** A cached tip (sub-pixel positions in quarters). */
export function tipFor(
  diameter: number,
  hardness: number,
  shape: TipShape,
  aliased: boolean,
  fx: number,
  fy: number,
): Tip {
  // An aliased tip sits on a pixel's centre when its size is odd and on a corner when even, so its
  // pixels are whole either way.
  const even = Math.round(diameter) % 2 === 0;
  const qx = aliased ? (even ? 0 : 2) : Math.round(fx * 4);
  const qy = aliased ? (even ? 0 : 2) : Math.round(fy * 4);
  const key = `${Math.round(diameter * 4)}|${Math.round(hardness * 100)}|${shape}|${aliased ? 1 : 0}|${qx}|${qy}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const tip = makeTip(Math.round(diameter * 4) / 4, hardness, shape, aliased, qx / 4, qy / 4);
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value!);
  CACHE.set(key, tip);
  return tip;
}
