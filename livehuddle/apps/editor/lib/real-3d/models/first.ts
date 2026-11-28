// Real 3D's first models (docs/specs/008-canvas/3d-engine.md "Block models"), kept as the kit's worked examples.
import { faceText } from '../text-mesh';
import {
  chairAt,
  KIND_HEIGHT,
  METAL_DARK,
  mix,
  SEAT_Z,
  WOOD,
  WOOD_DARK,
  type ModelTable,
} from './kit';

export const FIRST_MODELS: ModelTable = {
  screen: (m, { f }) => {
    // The meeting Screen (screen-and-room-sign.md "Sizes"; 3d-engine.md "The Screen scales with its size"): a 16 by 9
    // panel as wide as the Screen, its bezel and depth growing with it. Up to a wall's height it hangs on its wall on
    // a slim bracket, its middle at eye height; a big one stands against its wall on a wide stand of splayed feet.
    const { x0, x1 } = f.foot;
    const W = x1 - x0;
    const cx = (x0 + x1) / 2;
    const back = -f.D / 2;
    const p = screenPanel(W);
    const { bezel, depth, z0, z1 } = p;
    const frame = 0x1f2430;
    const metal = 0x2b3040;
    let y: number;
    if (p.stand) {
      // Two posts behind the panel up to its middle, each on a foot splayed out toward the room.
      const foot = Math.max(16, W * 0.06);
      for (const s of [-1, 1] as const) {
        const px = cx + s * W * 0.3;
        m.b(px - 1.8, back + 0.5, 0, px + 1.8, back + 4.1, z0 + (z1 - z0) * 0.5, metal);
        m.b(px - 2.6, back + 0.5, 0, px + 2.6, back + foot, 2.4, metal, { top: 0x3a4152 });
      }
      y = back + 4.1;
    } else {
      // A slim bracket on the wall behind the panel's middle.
      m.b(
        cx - W * 0.14,
        back,
        (z0 + z1) / 2 - 6,
        cx + W * 0.14,
        back + 1.4,
        (z0 + z1) / 2 + 6,
        metal,
        {
          bare: true,
        },
      );
      y = back + 1.4;
    }
    // The body and its bezel, then the dark glass set in it and a soft glint across its top corner.
    m.b(x0, y, z0, x1, y + depth, z1, frame, { top: 0x2b3040 });
    const face = y + depth;
    m.b(x0 + bezel, face, z0 + bezel, x1 - bezel, face + 0.5, z1 - bezel, 0x24324a, { bare: true });
    // The glass's place, just proud of it: an idle Screen's logo is drawn there (idle-screens.ts), never in this
    // geometry, so the logo's turn never rebuilds the pieces.
    m.picture(x0 + bezel, face + 0.55, z0 + bezel, x1 - bezel, z1 - bezel);
    const gx = x0 + bezel + W * 0.05;
    m.b(
      gx,
      face + 0.5,
      z1 - bezel - (z1 - z0) * 0.22,
      gx + W * 0.07,
      face + 0.7,
      z1 - bezel - (z1 - z0) * 0.19,
      0x3a4a66,
      {
        bare: true,
      },
    );
    // A camera bar on top, and the status light on its lower edge (screen-and-room-sign.md "Screen").
    const cam = Math.max(4, Math.min(W * 0.06, 24));
    m.b(
      cx - cam,
      y + depth * 0.3,
      z1,
      cx + cam,
      y + depth + 0.6,
      z1 + Math.max(1.6, bezel * 0.6),
      0x111111,
      {
        bare: true,
      },
    );
    const led = Math.max(0.8, bezel * 0.35);
    m.b(
      x1 - bezel - led * 4,
      face,
      z0 + bezel * 0.5 - led / 2,
      x1 - bezel - led * 2,
      face + 0.4,
      z0 + bezel * 0.5 + led / 2,
      0x22c55e,
      {
        bare: true,
        sharp: true,
      },
    );
  },

  'room-sign': (m, { f, label }) => {
    // A Room Sign by the door: a walnut-framed cream plaque at eye height, its room's name across it in dark ink,
    // crisp at any zoom (text-mesh.ts), and its status lamp under the name (screen-and-room-sign.md "Room Sign").
    const { x0, x1 } = f.foot;
    const y = -f.D / 2;
    const walnut = 0x5b3a24;
    m.b(x0, y, 50, x1, y + 2.5, 78, walnut, { top: 0x6e4a30 });
    m.b(x0 + 2, y + 2.5, 52, x1 - 2, y + 3.3, 76, 0xf8f4e8, { bare: true });
    m.b(x0 + 2, y + 3.3, 52, x0 + 4, y + 3.6, 76, 0x22c55e, { bare: true });
    m.sphere(x0 + 9, y + 3.4, 57, 1.9, 1.3, 1.9, 0x22c55e, { segments: 14, rings: 7 });
    for (const [sx, sz] of [
      [x0 + 1.2, 51.2],
      [x1 - 1.2, 51.2],
      [x0 + 1.2, 76.8],
      [x1 - 1.2, 76.8],
    ] as const)
      m.b(sx - 0.6, y + 2.5, sz - 0.6, sx + 0.6, y + 3, sz + 0.6, 0xc9a24a, { bare: true });
    faceText(m, label ?? 'Room', {
      at: [(x0 + x1) / 2 + 1, y + 3.45, 67],
      right: [1, 0, 0],
      up: [0, 0, 1],
      normal: [0, 1, 0],
      // Its capitals as big as the plaque allows (a wider sign, bigger letters), a long name shrunk to fit.
      height: Math.min(11, (x1 - x0) * 0.1),
      maxWidth: x1 - x0 - 14,
      colour: 0x1f2430,
    });
  },

  portal: (m, { f, t }) => {
    // A standing ring of energy you walk through: a stepped oval rim in its colour, lit at the crown, a dark mouth.
    const w = Math.min(f.W, 72);
    const h = 104;
    const rx = w / 2;
    const rz = h / 2;
    const rim = 7;
    const steps = 13;
    const energy = t.stroke;
    const bright = mix(energy, 0xffffff, 0.45);
    for (let i = 0; i < steps; i++) {
      const z0 = (i / steps) * h;
      const z1 = ((i + 1) / steps) * h;
      const zm = (z0 + z1) / 2 - rz;
      const half = rx * Math.sqrt(Math.max(0, 1 - (zm / rz) ** 2));
      const inner = Math.max(0, (rx - rim) * Math.sqrt(Math.max(0, 1 - (zm / (rz - rim)) ** 2)));
      const lit = mix(energy, bright, i / steps);
      if (inner <= 0.5 || i === 0 || i === steps - 1) {
        m.b(-half, -3, z0, half, 3, z1, lit, { bare: true });
        continue;
      }
      m.b(-half, -3, z0, -inner, 3, z1, lit, { bare: true });
      m.b(inner, -3, z0, half, 3, z1, lit, { bare: true });
      m.b(-inner, -0.5, z0, inner, 0.5, z1, mix(0x0b1020, energy, 0.25), { bare: true });
    }
    // The ring glows on the floor at its foot.
    m.b(-rx, -8, 0, rx, 8, 0.6, mix(energy, 0x000000, 0.35), { bare: true });
  },

  chair: (m, { f, t }) => {
    const w = Math.min(f.W, f.D) * 0.6;
    chairAt(m, 0, 0, w, t);
  },

  bench: (m, { f, t }) => {
    // A two-seater: slats on two frames, no back.
    const { x0, y0, x1, y1 } = f.foot;
    const wood = t.top;
    m.b(x0 + 6, y0 + 2, 0, x0 + 10, y1 - 2, SEAT_Z - 4, t.stroke, { bare: true });
    m.b(x1 - 10, y0 + 2, 0, x1 - 6, y1 - 2, SEAT_Z - 4, t.stroke, { bare: true });
    const n = 3;
    const d = (y1 - y0) / n;
    for (let i = 0; i < n; i++)
      m.b(
        x0,
        y0 + i * d + 0.6,
        SEAT_Z - 4,
        x1,
        y0 + (i + 1) * d - 0.6,
        SEAT_Z,
        mix(wood, 0x000000, 0.08),
        { top: wood },
      );
  },

  'phone-booth': (m, { f, t }) => {
    // A booth you step into: a back, two sides and a roof, open at the front, a seat inside, a glass door panel.
    const { x0, y0, x1, y1 } = f.foot;
    const H = KIND_HEIGHT['phone-booth']!;
    const wall = t.face;
    const k = 4;
    m.b(x0, y0, 0, x1, y0 + k, H, wall, { top: t.top });
    m.b(x0, y0, 0, x0 + k, y1, H, wall, { top: t.top });
    m.b(x1 - k, y0, 0, x1, y1, H, wall, { top: t.top });
    m.b(x0, y0, H - 6, x1, y1, H, t.top);
    m.b(x0, y0, 0, x1, y1, 2, mix(wall, 0x000000, 0.2), { bare: true });
    // The seat inside, against the back.
    const sd = (y1 - y0) * 0.38;
    m.b(x0 + k, y0 + k, 0, x1 - k, y0 + k + sd, SEAT_Z, mix(t.seat, t.stroke, 0.25), {
      top: t.seat,
    });
    // A little shelf and the phone on the back wall.
    m.b(x0 + k + 4, y0 + k, 44, x1 - k - 4, y0 + k + 5, 46, WOOD);
    // The light in the roof.
    m.b(-6, (y0 + y1) / 2 - 3, H - 7, 6, (y0 + y1) / 2 + 3, H - 6, 0xfff7d6, { bare: true });
  },

  'reception-desk': (m, { f, t }) => {
    // A counter at standing height with a lower desk behind it for the receptionist.
    const { x0, y0, x1, y1 } = f.foot;
    const H = KIND_HEIGHT['reception-desk']!;
    const d = y1 - y0;
    m.b(x0, y0 + d * 0.45, 0, x1, y1, H, t.face, { top: t.top });
    m.b(x0 - 2, y0 + d * 0.45 - 2, H, x1 + 2, y1 + 2, H + 3, mix(t.top, 0xffffff, 0.15));
    m.b(x0, y0, 0, x0 + 6, y0 + d * 0.45, 26, t.face);
    m.b(x1 - 6, y0, 0, x1, y0 + d * 0.45, 26, t.face);
    m.b(x0 + 6, y0, 22, x1 - 6, y0 + d * 0.45, 26, mix(t.top, 0x000000, 0.1));
  },

  desk: (m, { f, t, seats }) => {
    const { x0, y0, x1, y1 } = f.foot;
    const H = 30;
    const wood = mix(t.top, WOOD, 0.3);
    m.legs(x0 + 2, y0 + 2, x1 - 2, y1 - 2, H - 3, 3, METAL_DARK);
    m.b(x0, y0, H - 3, x1, y1, H, mix(wood, 0x000000, 0.15), { top: wood });
    // The monitor on the far side, its screen toward the sitter.
    const cx = (x0 + x1) / 2;
    m.c(cx, y0 + 5, 6, 4, H, H + 8, METAL_DARK);
    m.c(cx, y0 + 6, (x1 - x0) * 0.42, 3, H + 6, H + 26, 0x1e293b);
    m.screen(() =>
      m.c(cx, y0 + 7.8, (x1 - x0) * 0.42 - 3, 0.6, H + 7.5, H + 24.5, 0x24324a, { bare: true }),
    );
    m.c(cx, y0 + (y1 - y0) * 0.6, (x1 - x0) * 0.32, 8, H, H + 1.5, 0x334155);
    for (const s of seats) chairAt(m, s.x, s.y + 4, 22, t);
  },

  sofa: (m, { f, t }) => {
    const { x0, y0, x1, y1 } = f.foot;
    const fab = t.seat;
    const dark = mix(fab, t.stroke, 0.25);
    const d = y1 - y0;
    m.b(x0, y0, 0, x1, y1, 4, WOOD_DARK, { bare: true });
    m.b(x0 + 8, y0 + d * 0.3, 4, x1 - 8, y1, SEAT_Z, dark, { top: fab });
    m.b(x0, y0, 4, x1, y0 + d * 0.32, 32, dark, { top: mix(fab, 0xffffff, 0.08) });
    m.b(x0, y0, 4, x0 + 9, y1, 24, dark, { top: fab });
    m.b(x1 - 9, y0, 4, x1, y1, 24, dark, { top: fab });
  },

  plant: (m, { f }) => {
    const r = Math.min(f.W, f.D) * 0.28;
    m.c(0, 0, r * 2, r * 2, 0, 16, 0xc96a3f, { top: 0x5b3a1f });
    m.c(0, 0, r * 2.6, r * 2.6, 18, 34, 0x428c46, { top: 0x63ad5c });
    m.c(0, 0, r * 2, r * 2, 34, 46, 0x428c46, { top: 0x63ad5c });
    m.c(0, 0, r * 1.1, r * 1.1, 46, 54, 0x428c46, { top: 0x63ad5c });
  },

  bookshelf: (m, { f, t }) => {
    const { x0, y0, x1, y1 } = f.foot;
    const H = KIND_HEIGHT.bookshelf!;
    const wood = mix(t.top, WOOD, 0.5);
    m.b(x0, y0, 0, x1, y1, H, mix(wood, 0x000000, 0.1), { top: wood });
    // Shelves of books on its front.
    const rows = 4;
    const cols = [0xc2410c, 0x1d4ed8, 0x15803d, 0xa16207, 0x7c3aed, 0xbe123c];
    for (let r = 0; r < rows; r++) {
      const z0 = 6 + r * ((H - 10) / rows);
      const z1 = z0 + (H - 10) / rows - 5;
      let x = x0 + 4;
      let i = r;
      while (x < x1 - 8) {
        const w = 4 + ((i * 3) % 4);
        m.b(
          x,
          y1 - 1,
          z0,
          Math.min(x + w, x1 - 4),
          y1 + 0.6,
          z1 - ((i * 5) % 4),
          cols[i % cols.length]!,
          { bare: true },
        );
        x += w + 1;
        i++;
      }
    }
  },

  'office-pod': (m, { t, seats }) => {
    // The pod's furniture (its walls are the 3D view's walls): a bench at each seat, backed against the pod's ends,
    // and the table between them.
    if (seats.length === 0) return;
    const fab = t.seat;
    const xs = seats.map((s) => s.x);
    const ys = seats.map((s) => s.y);
    const midX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const midY = ys.reduce((a, b) => a + b, 0) / ys.length;
    for (const s of seats) {
      // A bench across the pod, its back behind the sitter (away from the table).
      const away = { x: Math.sign(s.x - midX), y: Math.sign(s.y - midY) };
      const across = away.y !== 0;
      const w = 52;
      const dep = 16;
      const bx = s.x + away.x * 2;
      const by = s.y + away.y * 2;
      if (across) {
        m.c(bx, by, w, dep, 0, SEAT_Z, mix(fab, t.stroke, 0.25), { top: fab });
        m.c(bx, by + away.y * (dep / 2 + 3), w, 6, 0, SEAT_Z + 22, mix(fab, t.stroke, 0.2));
      } else {
        m.c(bx, by, dep, w, 0, SEAT_Z, mix(fab, t.stroke, 0.25), { top: fab });
        m.c(bx + away.x * (dep / 2 + 3), by, 6, w, 0, SEAT_Z + 22, mix(fab, t.stroke, 0.2));
      }
    }
    // The table between them, with a mug.
    const spreadX = Math.max(...xs) - Math.min(...xs);
    const spreadY = Math.max(...ys) - Math.min(...ys);
    const tw = spreadY > spreadX ? 44 : Math.max(18, spreadX * 0.45);
    const td = spreadY > spreadX ? Math.max(18, spreadY * 0.45) : 44;
    m.c(midX, midY, 4, 4, 0, 26, METAL_DARK, { bare: true });
    m.c(midX, midY, tw, td, 26, 29, mix(WOOD, 0x000000, 0.1), { top: WOOD });
    m.c(midX + 6, midY, 4, 4, 29, 34, 0xf8fafc);
  },
};

/** The tallest a Screen hung on its wall stands, and where its middle hangs (eye height), as built. */
const SCREEN_HUNG_MAX = 96;
const SCREEN_EYE = 66;
/** A Screen this wide or wider stands on its own stand; the tallest one stands at a cinema's 280. */
export const SCREEN_STAND_FROM = 260;

/**
 * A Screen `width` wide's panel as built (3d-engine.md "The Screen scales with its size"): 16 by 9, its bezel and depth
 * 2 to 8, hung at eye height up to SCREEN_HUNG_MAX tall; a wide one on a stand from just off the floor, as tall as 112
 * (under the walls) up to 400 wide, growing to 280 by 700.
 */
export function screenPanel(width: number): {
  stand: boolean;
  bezel: number;
  depth: number;
  z0: number;
  z1: number;
} {
  const bezel = Math.min(8, Math.max(2, width * 0.02));
  const depth = Math.min(8, Math.max(3, width * 0.02));
  const want = (width * 9) / 16;
  if (width < SCREEN_STAND_FROM) {
    const h = Math.min(want, SCREEN_HUNG_MAX);
    const z0 = Math.max(14, SCREEN_EYE - h / 2);
    return { stand: false, bezel, depth, z0, z1: z0 + h };
  }
  const cap = 112 + Math.min(1, Math.max(0, (width - 400) / 300)) * 168;
  const z0 = 16;
  return { stand: true, bezel, depth, z0, z1: z0 + Math.min(want, cap) };
}
