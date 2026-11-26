// Real 3D's first models (docs/specs/008-canvas/3d-engine.md "Block models"), kept as the kit's worked examples.
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
    // The meeting Screen, hung on the wall at its back: a dark bezel, the panel, a small camera on top.
    const { x0, x1 } = f.foot;
    const y = -f.D / 2;
    m.b(x0, y, 40, x1, y + 4, 96, 0x1f2430, { top: 0x2b3040 });
    m.b(x0 + 3, y + 4, 44, x1 - 3, y + 4.6, 92, 0x24324a, { bare: true });
    m.b(x0 + 6, y + 4.7, 66, x0 + 16, y + 5, 68, 0x3a4a66, { bare: true });
    m.b(-3, y + 2, 96, 3, y + 5, 99, 0x111111, { bare: true });
  },

  'room-sign': (m, { f, t }) => {
    // A Room Sign by the door: a small board at eye height with its lamp.
    const { x0, x1 } = f.foot;
    const y = -f.D / 2;
    m.b(x0, y, 52, x1, y + 3, 76, 0xf8f4e8, { top: 0xffffff });
    m.b(x0 + 4, y + 3, 58, x1 - 4, y + 3.5, 62, mix(t.stroke, 0xffffff, 0.4), { bare: true });
    m.b(x0 + 4, y + 3, 66, x0 + 9, y + 4, 71, 0x22c55e, { bare: true });
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
    m.c(cx, y0 + 6, (x1 - x0) * 0.42, 3, H + 6, H + 26, 0x1e293b, { front: 0x60a5fa });
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
