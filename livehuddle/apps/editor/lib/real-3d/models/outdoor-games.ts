// Real 3D's games tables (docs/specs/008-canvas/3d-engine.md "Block models"): ping-pong, pool and foosball. Part of
// OUTDOOR_MODELS (outdoor.ts).
import { type Rgb } from '../mesh-builder';
import { KIND_HEIGHT, METAL_DARK, mix, WOOD_DARK, type ModelTable } from './kit';
import { BLUE, FELT, FELT_DARK, FLAME, INK, OAK, OAK_DARK, PITCH, RED, WHITE } from './outdoor-kit';

export const GAMES_MODELS: ModelTable = {
  'ping-pong-table': (m) => {
    // A green table on dark legs, its white edge lines and centre line, the net across the middle, a red and a
    // black bat lying on either half.
    const H = KIND_HEIGHT['ping-pong-table']!;
    const hw = 62;
    const hd = 34;
    m.legs(-hw + 10, -hd + 6, hw - 10, hd - 6, H - 3, 3, METAL_DARK);
    m.b(-hw + 12, -1, H - 8, hw - 12, 1, H - 6, METAL_DARK, { bare: true });
    m.b(-hw, -hd, H - 3, hw, hd, H, FELT_DARK, { top: FELT });
    const z = H + 0.25;
    m.b(-hw, -hd, H, hw, -hd + 1.5, z, WHITE, { bare: true });
    m.b(-hw, hd - 1.5, H, hw, hd, z, WHITE, { bare: true });
    m.b(-hw, -hd, H, -hw + 1.5, hd, z, WHITE, { bare: true });
    m.b(hw - 1.5, -hd, H, hw, hd, z, WHITE, { bare: true });
    m.b(-hw, -0.6, H, hw, 0.6, z, WHITE, { bare: true });
    // The net, on its two posts.
    m.b(-0.8, -hd - 2, H, 0.8, hd + 2, H + 6, WHITE, { top: 0xe2e8f0 });
    for (const yy of [-hd - 3, hd + 1])
      m.b(-1.2, yy, H - 2, 1.2, yy + 2, H + 6.5, 0x1f2937, { bare: true });
    // The bats.
    m.c(-34, -12, 8, 8, H, H + 1.2, RED);
    m.c(-29, -7, 4, 2, H, H + 1, WOOD_DARK);
    m.c(36, 12, 8, 8, H, H + 1.2, 0x1f2937);
    m.c(31, 7, 4, 2, H, H + 1, WOOD_DARK);
  },

  'pool-table': (m, { f }) => {
    // Chunky wooden legs, a wooden body and rails round green felt, six black pockets, a rack of balls, the cue ball
    // and a cue lying on the felt.
    const H = KIND_HEIGHT['pool-table']!;
    const { x0, y0, x1, y1 } = f.foot;
    const cy = (y0 + y1) / 2;
    const hw = (x1 - x0) / 2;
    const hd = (y1 - y0) / 2;
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        m.c(sx * (hw - 16), cy + sy * (hd - 12), 11, 11, 0, 3, OAK_DARK);
        m.c(sx * (hw - 16), cy + sy * (hd - 12), 8, 8, 3, 16, OAK_DARK);
      }
    m.b(-hw + 4, cy - hd + 4, 14, hw - 4, cy + hd - 4, H - 4, OAK);
    const r = 8;
    m.b(-hw, cy - hd, H - 4, hw, cy - hd + r, H, OAK);
    m.b(-hw, cy + hd - r, H - 4, hw, cy + hd, H, OAK);
    m.b(-hw, cy - hd + r, H - 4, -hw + r, cy + hd - r, H, OAK);
    m.b(hw - r, cy - hd + r, H - 4, hw, cy + hd - r, H, OAK);
    m.b(-hw + r, cy - hd + r, H - 4, hw - r, cy + hd - r, H - 2, FELT_DARK, {
      top: FELT,
      bare: true,
    });
    // Cushions inside the rails.
    m.b(-hw + r, cy - hd + r, H - 2, hw - r, cy - hd + r + 2, H - 1, FELT_DARK, { bare: true });
    m.b(-hw + r, cy + hd - r - 2, H - 2, hw - r, cy + hd - r, H - 1, FELT_DARK, { bare: true });
    m.b(-hw + r, cy - hd + r, H - 2, -hw + r + 2, cy + hd - r, H - 1, FELT_DARK, { bare: true });
    m.b(hw - r - 2, cy - hd + r, H - 2, hw - r, cy + hd - r, H - 1, FELT_DARK, { bare: true });
    // Pockets at the corners and the middles of the long sides.
    for (const x of [-hw + 5, 0, hw - 5])
      for (const yy of [cy - hd + 5, cy + hd - 5])
        m.c(x, yy, 7, 7, H, H + 0.4, INK, { bare: true });
    // Sights on the long rails.
    for (const x of [-hw * 0.5, -hw * 0.25, hw * 0.25, hw * 0.5])
      for (const yy of [cy - hd + 3, cy + hd - 3])
        m.c(x, yy, 1.6, 1.6, H, H + 0.3, 0xeedd99, { bare: true });
    // The rack of balls and the cue ball.
    const z = H - 2;
    const rx = hw * 0.42;
    const rack: [number, number, Rgb][] = [
      [rx, 0, 0xdcba33],
      [rx + 4, -2.2, RED],
      [rx + 4, 2.2, BLUE],
      [rx + 8, -4.4, 0x804bdc],
      [rx + 8, 0, 0x111827],
      [rx + 8, 4.4, FLAME],
    ];
    for (const [x, dy, c] of rack) m.c(x, cy + dy, 3.4, 3.4, z, z + 3.4, c, { bare: true });
    m.c(-hw * 0.35, cy + 4, 3.4, 3.4, z, z + 3.4, WHITE, { bare: true });
    // The cue, a stepped line from the butt to its blue tip.
    const n = 9;
    for (let k = 0; k < n; k++) {
      const x = -hw * 0.75 + k * 7;
      const yy = cy + 14 - k * 1.3;
      m.c(x, yy, 7.2, 1.6, z, z + 1.6, k < 3 ? OAK_DARK : 0xe5c48d, { bare: true });
    }
    m.c(-hw * 0.75 + n * 7 - 2.5, cy + 14 - n * 1.3, 2, 1.6, z, z + 1.6, 0x50b4e0, { bare: true });
  },

  'foosball-table': (m, { f }) => {
    // A wooden cabinet on legs, a green pitch inside its walls with its white markings and goals, six rods across
    // it with their red and blue players, each team's handles out of the side it plays from.
    const H = KIND_HEIGHT['foosball-table']!;
    const { x0, y0, x1, y1 } = f.foot;
    const cy = (y0 + y1) / 2;
    const hw = (x1 - x0) / 2 - 2;
    const hd = (y1 - y0) / 2 - 4;
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) m.c(sx * (hw - 10), cy + sy * (hd - 7), 8, 8, 0, 14, OAK_DARK);
    const wall = 5;
    m.b(-hw, cy - hd, 12, hw, cy + hd, 17, OAK);
    m.b(-hw, cy - hd, 17, hw, cy - hd + wall, H, OAK);
    m.b(-hw, cy + hd - wall, 17, hw, cy + hd, H, OAK);
    m.b(-hw, cy - hd + wall, 17, -hw + wall, cy + hd - wall, H, OAK);
    m.b(hw - wall, cy - hd + wall, 17, hw, cy + hd - wall, H, OAK);
    const px = hw - wall;
    const py = hd - wall;
    m.b(-px, cy - py, 17, px, cy + py, 19, PITCH, { bare: true });
    const zl = 19.2;
    const line = (a: number, b: number, c: number, d: number) =>
      m.b(a, cy + b, 19, c, cy + d, zl, WHITE, { bare: true });
    line(-0.6, -py, 0.6, py);
    line(-5, -5, 5, -4);
    line(-5, 4, 5, 5);
    line(-5, -5, -4, 5);
    line(4, -5, 5, 5);
    for (const sx of [-1, 1]) {
      const a = sx * px;
      const b = sx * (px - 10);
      line(Math.min(a, b), -9, Math.max(a, b), -8);
      line(Math.min(a, b), 8, Math.max(a, b), 9);
      line(Math.min(b, b + sx), -9, Math.max(b, b + sx), 9);
      // The goal mouth through the end wall.
      m.b(sx * (hw - wall - 0.5), cy - 6, 17, sx * (hw + 0.5), cy + 6, 24, INK, { bare: true });
    }
    const counts = [1, 2, 3, 3, 2, 1];
    const zr = H - 3;
    counts.forEach((n, i) => {
      const x = -px + ((2 * px) / counts.length) * (i + 0.5);
      const red = i % 2 === 0;
      const c = red ? RED : BLUE;
      m.b(x - 0.8, cy - hd - 4, zr, x + 0.8, cy + hd + 4, zr + 1.6, 0x475569);
      const hy = red ? cy + hd + 4 : cy - hd - 10;
      m.b(x - 1.6, hy, zr - 0.8, x + 1.6, hy + 6, zr + 2.4, INK);
      for (let k = 0; k < n; k++) {
        const yy = cy - py + ((2 * py) / n) * (k + 0.5);
        m.c(x, yy, 3, 3.4, 19, zr + 2.5, c, { top: mix(c, 0xffffff, 0.2) });
      }
    });
  },
};
