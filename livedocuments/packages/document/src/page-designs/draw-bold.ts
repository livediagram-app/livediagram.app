// The Bold family (docs/specs/011-theme/page-designs.md "The catalogue"): flat blocks, Memphis confetti, a Swiss grid,
// split fields and one oversized decorative glyph. Pure.
import { between, n, pick, trio, unit, type Drawer } from './draw-kit';

// Brutalist Blocks: big flat slabs of the palette and the ink on a coarse grid, hard-edged, kept to the edges.
const brutalistBlocks: Drawer = (c) => {
  const cell = unit(c) * 12;
  const cols = Math.ceil(c.w / cell);
  const rows = Math.ceil(c.h / cell);
  const colours = [...trio(c), c.p.ink];
  const outlined = c.t.variant === 'outlined';
  const blocks: string[] = [];
  for (let i = 0; i < 9; i += 1) {
    // Along an edge: a column or row at the rim, so the middle stays open.
    const edge = i % 4;
    const bw = Math.ceil(between(c.rnd, 1, 3.5));
    const bh = Math.ceil(between(c.rnd, 1, 3));
    const col =
      edge === 1
        ? cols - bw
        : edge === 3
          ? 0
          : Math.floor(between(c.rnd, 0, Math.max(1, cols - bw)));
    const row =
      edge === 0
        ? 0
        : edge === 2
          ? rows - bh
          : Math.floor(between(c.rnd, 0, Math.max(1, rows - bh)));
    const colour = colours[i % colours.length]!;
    const ink = colour === c.p.ink;
    blocks.push(
      `<rect x="${n(col * cell)}" y="${n(row * cell)}" width="${n(bw * cell)}" height="${n(bh * cell)}" fill="${colour}" fill-opacity="${ink ? 0.85 : 0.9}"` +
        (outlined ? ` stroke="${c.p.ink}" stroke-width="${n(unit(c) * 0.5)}"` : '') +
        '/>',
    );
  }
  return [{ svg: blocks.join('') }];
};

// Memphis: squiggles, zigzags, triangles, rings, dot patches and pills in the palette, scattered round the edges.
const memphis: Drawer = (c) => {
  const u = unit(c);
  const colours = trio(c);
  const count = c.t.variant === 'sparse' ? 12 : 26;
  const sw = n(u * 0.7);
  const shapes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    // Pushed toward the rim: a point near one edge or another.
    const side = i % 4;
    const t = c.rnd();
    const inset = between(c.rnd, 0.02, 0.22);
    const x =
      side === 0 ? t * c.w : side === 1 ? c.w * (1 - inset) : side === 2 ? t * c.w : c.w * inset;
    const y = side === 0 ? c.h * inset : side === 1 ? t * c.h : c.h * (1 - inset);
    const s = u * between(c.rnd, 3, 6);
    const colour = colours[i % 3]!;
    const turn = n(between(c.rnd, 0, 360));
    const kind = pick(c.rnd, [
      'squiggle',
      'zigzag',
      'triangle',
      'ring',
      'dots',
      'pill',
      'cross',
    ] as const);
    const g = (inner: string) =>
      `<g transform="translate(${n(x)} ${n(y)}) rotate(${turn})">${inner}</g>`;
    if (kind === 'squiggle')
      shapes.push(
        g(
          `<path d="M${n(-s)} 0q${n(s / 4)} ${n(-s / 2)} ${n(s / 2)} 0t${n(s / 2)} 0t${n(s / 2)} 0t${n(s / 2)} 0" fill="none" stroke="${colour}" stroke-width="${sw}" stroke-linecap="round"/>`,
        ),
      );
    else if (kind === 'zigzag')
      shapes.push(
        g(
          `<path d="M${n(-s)} 0l${n(s / 3)} ${n(-s / 3)}l${n(s / 3)} ${n(s / 3)}l${n(s / 3)} ${n(-s / 3)}l${n(s / 3)} ${n(s / 3)}l${n(s / 3)} ${n(-s / 3)}l${n(s / 3)} ${n(s / 3)}" fill="none" stroke="${c.p.ink}" stroke-width="${sw}" stroke-linejoin="round"/>`,
        ),
      );
    else if (kind === 'triangle')
      shapes.push(
        g(
          `<path d="M0 ${n(-s / 2)}L${n(s / 2)} ${n(s / 2)}L${n(-s / 2)} ${n(s / 2)}Z" fill="${colour}"/>`,
        ),
      );
    else if (kind === 'ring')
      shapes.push(
        g(`<circle r="${n(s / 2)}" fill="none" stroke="${colour}" stroke-width="${n(u * 1.1)}"/>`),
      );
    else if (kind === 'dots') {
      let d = '';
      for (let gx = 0; gx < 4; gx += 1)
        for (let gy = 0; gy < 3; gy += 1)
          d += `M${n(gx * u * 1.6)} ${n(gy * u * 1.6)}m${n(-u * 0.3)} 0a${n(u * 0.3)} ${n(u * 0.3)} 0 1 0 ${n(u * 0.6)} 0a${n(u * 0.3)} ${n(u * 0.3)} 0 1 0 ${n(-u * 0.6)} 0`;
      shapes.push(g(`<path d="${d}" fill="${c.p.ink}" fill-opacity="0.75"/>`));
    } else if (kind === 'pill')
      shapes.push(
        g(
          `<rect x="${n(-s / 2)}" y="${n(-u)}" width="${n(s)}" height="${n(u * 2)}" rx="${n(u)}" fill="${colour}" stroke="${c.p.ink}" stroke-width="${n(u * 0.35)}"/>`,
        ),
      );
    else
      shapes.push(
        g(
          `<path d="M${n(-s / 3)} 0H${n(s / 3)}M0 ${n(-s / 3)}V${n(s / 3)}" stroke="${colour}" stroke-width="${n(u * 0.9)}" stroke-linecap="round"/>`,
        ),
      );
  }
  return [{ svg: shapes.join('') }];
};

// Swiss Grid: a twelve-column (or modular) grid in hairlines, a bold bar, a big circle running off the page.
const swissGrid: Drawer = (c) => {
  const u = unit(c);
  const margin = u * 6;
  const cols = 12;
  const colW = (c.w - margin * 2) / cols;
  let lines = '';
  for (let i = 0; i <= cols; i += 1)
    lines += `M${n(margin + i * colW)} ${n(margin)}V${n(c.h - margin)}`;
  if (c.t.variant === 'modular') {
    const rows = 6;
    const rowH = (c.h - margin * 2) / rows;
    for (let i = 0; i <= rows; i += 1)
      lines += `M${n(margin)} ${n(margin + i * rowH)}H${n(c.w - margin)}`;
  }
  const circleR = Math.min(c.w, c.h) * between(c.rnd, 0.32, 0.42) * c.t.scale;
  const barCols = Math.round(between(c.rnd, 3, 5));
  return [
    {
      svg:
        `<path d="${lines}" fill="none" stroke="${c.p.ink}" stroke-opacity="0.12" stroke-width="1"/>` +
        `<circle cx="${n(c.w - margin - colW * 1.5)}" cy="${n(c.h - margin)}" r="${n(circleR)}" fill="${c.p.a}" fill-opacity="0.85"/>` +
        `<rect x="${n(margin)}" y="${n(margin)}" width="${n(colW * barCols)}" height="${n(u * 2.2)}" fill="${c.p.ink}" fill-opacity="0.9"/>` +
        `<rect x="${n(margin + colW * barCols)}" y="${n(margin)}" width="${n(colW)}" height="${n(u * 2.2)}" fill="${c.p.b}"/>`,
    },
  ];
};

// Split Fields: the page split into fields of colour: down one side, across a slant at the angle, or in a corner.
const splitFields: Drawer = (c) => {
  const v = c.t.variant;
  if (v === 'vertical')
    return [
      {
        svg:
          `<rect width="${n(c.w * 0.36)}" height="${n(c.h)}" fill="${c.p.a}" fill-opacity="0.85"/>` +
          `<rect x="${n(c.w * 0.36)}" width="${n(c.w * 0.04)}" height="${n(c.h)}" fill="${c.p.b}" fill-opacity="0.8"/>`,
      },
    ];
  if (v === 'corner')
    return [
      {
        svg:
          `<rect x="${n(c.w * 0.62)}" width="${n(c.w * 0.38)}" height="${n(c.h * 0.46)}" fill="${c.p.a}" fill-opacity="0.85"/>` +
          `<rect x="${n(c.w * 0.62)}" y="${n(c.h * 0.46)}" width="${n(c.w * 0.38)}" height="${n(c.h * 0.08)}" fill="${c.p.b}" fill-opacity="0.8"/>` +
          `<rect y="${n(c.h * 0.86)}" width="${n(c.w * 0.62)}" height="${n(c.h * 0.14)}" fill="${c.p.c}" fill-opacity="0.55"/>`,
      },
    ];
  // Diagonal: a slanted edge through the page at the angle, the field beyond it in colour.
  const a = (c.t.angle * Math.PI) / 180;
  const cx = c.w * 0.72;
  const reach = Math.hypot(c.w, c.h);
  const dx = Math.cos(a) * reach;
  const dy = Math.sin(a) * reach;
  return [
    {
      svg:
        `<path d="M${n(cx - dx)} ${n(c.h / 2 - dy)}L${n(cx + dx)} ${n(c.h / 2 + dy)}L${n(c.w + reach)} ${n(c.h + reach)}L${n(c.w + reach)} ${n(-reach)}Z" fill="${c.p.a}" fill-opacity="0.85"/>` +
        `<path d="M${n(cx - dx - c.w * 0.03)} ${n(c.h / 2 - dy)}L${n(cx + dx - c.w * 0.03)} ${n(c.h / 2 + dy)}" stroke="${c.p.b}" stroke-width="${n(unit(c) * 1.2)}"/>`,
    },
  ];
};

// The glyphs Type Watermark draws: decorative marks, never words.
const GLYPHS: Record<string, string> = {
  ampersand: '&amp;',
  asterisk: '*',
  hash: '#',
  section: '§',
  quote: '“',
  question: '?',
};

// Type Watermark: one oversized decorative glyph in the tab's font at the focus, half off the page, faint.
const typeWatermark: Drawer = (c) => {
  const [fx, fy] = c.t.focus;
  const size = Math.min(c.w, c.h) * 1.15 * c.t.scale;
  const glyph = GLYPHS[c.t.variant] ?? GLYPHS.ampersand!;
  return [
    {
      svg:
        `<text x="${n(fx * c.w)}" y="${n(fy * c.h + size * 0.35)}" font-size="${n(size)}" font-weight="800" text-anchor="middle" ` +
        `transform="rotate(${n(c.t.angle)} ${n(fx * c.w)} ${n(fy * c.h)})" style="font-family:${c.font}" fill="${c.p.a}" fill-opacity="0.22" ` +
        `stroke="${c.p.b}" stroke-opacity="0.35" stroke-width="${n(unit(c) * 0.25)}">${glyph}</text>`,
    },
  ];
};

export const BOLD_DRAWERS = {
  'brutalist-blocks': brutalistBlocks,
  memphis,
  'swiss-grid': swissGrid,
  'split-fields': splitFields,
  'type-watermark': typeWatermark,
} as const;
