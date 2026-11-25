// The Light family (docs/specs/011-theme/page-designs.md "The catalogue"): frosted glass, a spotlight,
// out-of-focus lights, soft shadows and things lifted off the page (cards and instant photos). Shadows are stacked
// translucent shapes and soft lights radial gradients, never blur filters, so nothing here needs a filter to draw. Pure.
import {
  between,
  glowDef,
  linearDef,
  n,
  trio,
  unit,
  type DesignLayer,
  type DesignPlate,
  type DrawCtx,
  type Drawer,
} from './draw-kit';

// A soft shadow under a rounded rect: a few widening, fading copies offset away from the light.
function softShadow(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  dx: number,
  dy: number,
  strength: number,
): string {
  let out = '';
  for (let i = 4; i >= 1; i -= 1) {
    const g = i * 3;
    out += `<rect x="${n(x + dx * (i / 4) - g)}" y="${n(y + dy * (i / 4) - g)}" width="${n(w + g * 2)}" height="${n(h + g * 2)}" rx="${n(r + g)}" fill="#0f172a" fill-opacity="${n(strength / (i + 1))}"/>`;
  }
  return out;
}

// Glass Panels: bright lights behind frosted rounded panels (or orbs), each with a lit rim.
const glassPanels: Drawer = (c) => {
  const colours = trio(c);
  const max = Math.max(c.w, c.h) * c.t.scale;
  const lights = colours
    .map((col, i) => {
      const id = `${c.uid}-gl${i}`;
      const x = [0.82, 0.12, 0.6][i]! * c.w + between(c.rnd, -0.06, 0.06) * c.w;
      const y = [0.2, 0.78, 0.92][i]! * c.h;
      return `<defs>${glowDef(id, col, 0.9, c.t.blur)}</defs><circle cx="${n(x)}" cy="${n(y)}" r="${n(max * 0.36)}" fill="url(#${id})"/>`;
    })
    .join('');
  const glass = `${c.uid}-glass`;
  const rim = `${c.uid}-rim`;
  const defs = `<defs>${linearDef(
    glass,
    [
      [0, '#ffffff', c.p.dark ? 0.16 : 0.42],
      [1, '#ffffff', c.p.dark ? 0.04 : 0.12],
    ],
    150,
  )}${linearDef(
    rim,
    [
      [0, '#ffffff', 0.8],
      [1, '#ffffff', 0.1],
    ],
    150,
  )}</defs>`;
  const u = unit(c);
  const panels =
    c.t.variant === 'orbs'
      ? [
          [0.84, 0.22, 16],
          [0.14, 0.8, 11],
          [0.7, 0.86, 7],
        ]
          .map(
            ([x, y, r]) =>
              `<circle cx="${n(x! * c.w)}" cy="${n(y! * c.h)}" r="${n(r! * u)}" fill="url(#${glass})" stroke="url(#${rim})" stroke-width="1.5"/>`,
          )
          .join('')
      : [
          [0.66, 0.06, 30, 22, -6],
          [0.04, 0.62, 26, 30, 5],
          [0.74, 0.7, 18, 14, 3],
        ]
          .map(([x, y, w, h, turn]) => {
            const px = x! * c.w;
            const py = y! * c.h;
            return `<rect x="${n(px)}" y="${n(py)}" width="${n(w! * u)}" height="${n(h! * u)}" rx="${n(u * 2.4)}" fill="url(#${glass})" stroke="url(#${rim})" stroke-width="1.5" transform="rotate(${turn} ${n(px)} ${n(py)})"/>`;
          })
          .join('');
  return [{ svg: lights + defs + panels }];
};

// Spotlight: a beam of light falling from the focus, a pool of light where it lands, swinging a little when it moves.
const spotlight: Drawer = (c) => {
  const [fx, fy] = c.t.focus;
  const sx = fx * c.w;
  const sy = fy * c.h;
  const reach = Math.hypot(c.w, c.h) * 0.95 * c.t.scale;
  const spread = 0.26 + c.t.blur * 0.2;
  // The beam points through the page's middle.
  const toward = Math.atan2(c.h * 0.85 - sy, c.w / 2 - sx);
  const l = [sx + Math.cos(toward - spread) * reach, sy + Math.sin(toward - spread) * reach];
  const r = [sx + Math.cos(toward + spread) * reach, sy + Math.sin(toward + spread) * reach];
  const beam = `${c.uid}-beam`;
  const pool = `${c.uid}-pool`;
  const light = c.p.dark ? '#ffffff' : c.p.a;
  const land = [sx + Math.cos(toward) * reach * 0.62, sy + Math.sin(toward) * reach * 0.62];
  return [
    {
      svg:
        `<defs><radialGradient id="${beam}" cx="${n(sx)}" cy="${n(sy)}" r="${n(reach)}" gradientUnits="userSpaceOnUse">` +
        `<stop offset="0" stop-color="${light}" stop-opacity="${c.p.dark ? 0.42 : 0.35}"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>` +
        `${glowDef(pool, light, c.p.dark ? 0.3 : 0.22, c.t.blur)}</defs>` +
        `<path d="M${n(sx)} ${n(sy)}L${n(l[0]!)} ${n(l[1]!)}L${n(r[0]!)} ${n(r[1]!)}Z" fill="url(#${beam})"/>` +
        `<ellipse cx="${n(land[0]!)}" cy="${n(land[1]!)}" rx="${n(reach * 0.32)}" ry="${n(reach * 0.1)}" fill="url(#${pool})"/>`,
      motion: { kind: 'swing', seconds: 16, turn: 7, origin: [sx, sy] },
    },
  ];
};

// Bokeh: out-of-focus lights of the palette clustered toward the focus, in three layers that float and glow.
const bokeh: Drawer = (c) => {
  const colours = trio(c);
  const [fx, fy] = c.t.focus;
  const u = unit(c);
  const sharp = c.t.variant === 'sharp';
  const layers: DesignLayer[] = [0, 1, 2].map((layer) => {
    const defs: string[] = [];
    const dots: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      const colour = colours[(i + layer) % 3]!;
      const id = `${c.uid}-bk${layer}-${i}`;
      const spread = 0.55;
      const x = (fx + between(c.rnd, -spread, spread)) * c.w;
      const y = (fy + between(c.rnd, -spread, spread)) * c.h;
      const r = u * between(c.rnd, 2, 9) * (1 + layer * 0.35);
      const op = between(c.rnd, 0.35, 0.8);
      if (sharp)
        dots.push(
          `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${colour}" fill-opacity="${n(op * 0.55)}" stroke="${colour}" stroke-opacity="${n(op)}" stroke-width="1.2"/>`,
        );
      else {
        defs.push(glowDef(id, colour, op, 0.35 + c.t.blur * 0.6));
        dots.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="url(#${id})"/>`);
      }
    }
    return {
      svg: `${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${dots.join('')}`,
      motion:
        layer === 1
          ? { kind: 'twinkle', seconds: 7 }
          : {
              kind: 'drift',
              seconds: 24 + layer * 8,
              x: c.w * 0.03,
              y: -c.h * (0.04 + layer * 0.02),
            },
    };
  });
  return layers;
};

function lightOffset(c: DrawCtx, by: number): [number, number] {
  const a = (c.t.angle * Math.PI) / 180;
  return [Math.cos(a) * by, Math.sin(a) * by];
}

// Soft Shadows: pale shapes lifted off the page, their shadows falling away from the light at the angle.
const softShadows: Drawer = (c) => {
  const u = unit(c);
  const [dx, dy] = lightOffset(c, u * 2.4);
  const fill = c.p.dark ? c.p.base : '#ffffff';
  const shapes = [
    { x: c.w * 0.72, y: -u * 6, w: u * 40, h: u * 32, r: u * 4 },
    { x: -u * 10, y: c.h * 0.6, w: u * 34, h: u * 36, r: u * 18 },
    { x: c.w * 0.82, y: c.h * 0.72, w: u * 20, h: u * 20, r: u * 10 },
  ].map((s, i) => {
    const jitter = between(c.rnd, -u * 3, u * 3);
    const x = s.x + jitter;
    const y = s.y - jitter;
    return (
      softShadow(x, y, s.w, s.h, s.r, dx, dy, c.p.dark ? 0.3 : 0.1) +
      `<rect x="${n(x)}" y="${n(y)}" width="${n(s.w)}" height="${n(s.h)}" rx="${n(s.r)}" fill="${fill}" fill-opacity="${c.p.dark ? 0.6 : 0.92}"/>` +
      `<rect x="${n(x)}" y="${n(y)}" width="${n(s.w)}" height="${n(s.h)}" rx="${n(s.r)}" fill="${trio(c)[i]}" fill-opacity="0.12"/>`
    );
  });
  return [{ svg: shapes.join('') }];
};

// Layered Cards: a stack (or a fan) of rounded cards in the palette at the focus, each lifted by its shadow.
const layeredCards: Drawer = (c) => {
  const u = unit(c) * 1.2;
  const [fx, fy] = c.t.focus;
  const cx = fx * c.w;
  const cy = fy * c.h;
  const colours = [c.p.c, c.p.b, c.p.a];
  const fan = c.t.variant === 'fan';
  const cards = colours.map((col, i) => {
    const turn = fan ? -24 + i * 16 : -10 + i * 6 + between(c.rnd, -2, 2);
    const w = u * 30;
    const h = u * 20;
    const x = cx - w / 2 + (fan ? 0 : (i - 1) * u * 2.5);
    const y = cy - h / 2 - (fan ? 0 : i * u * 2);
    return (
      `<g transform="rotate(${n(turn)} ${n(fan ? cx : x + w / 2)} ${n(fan ? cy + h : y + h / 2)})">` +
      softShadow(x, y, w, h, u * 2.4, u * 0.6, u * 1.6, c.p.dark ? 0.32 : 0.12) +
      `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(u * 2.4)}" fill="${col}" fill-opacity="${n(0.55 + i * 0.15)}"/>` +
      `<rect x="${n(x + u * 3)}" y="${n(y + u * 3)}" width="${n(w * 0.4)}" height="${n(u * 1.4)}" rx="${n(u * 0.7)}" fill="#ffffff" fill-opacity="0.45"/></g>`
    );
  });
  return [{ svg: cards.join('') }];
};

// Card Cascade: a diagonal run of small cards dealt out of the focus's corner toward the middle, each smaller and
// paler than the one before it, the largest (in the corner) on top.
const cardCascade: Drawer = (c) => {
  const u = unit(c) * 1.2;
  const [fx, fy] = c.t.focus;
  const sx = fx * c.w;
  const sy = fy * c.h;
  const toward = Math.atan2(c.h / 2 - sy, c.w / 2 - sx);
  const step = u * 10;
  const colours = trio(c);
  const cards: string[] = [];
  for (let i = 4; i >= 0; i -= 1) {
    const k = 0.86 ** i;
    const w = u * 34 * k;
    const h = u * 22 * k;
    const cx = sx + Math.cos(toward) * step * i;
    const cy = sy + Math.sin(toward) * step * i;
    const x = cx - w / 2;
    const y = cy - h / 2;
    const turn = -8 + i * 3 + between(c.rnd, -2, 2);
    cards.push(
      `<g transform="rotate(${n(turn)} ${n(cx)} ${n(cy)})">` +
        softShadow(x, y, w, h, u * 1.8 * k, u * 0.5, u * 1.3, c.p.dark ? 0.28 : 0.1) +
        `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(u * 1.8 * k)}" fill="${colours[i % 3]}" fill-opacity="${n(0.85 - i * 0.12)}"/>` +
        `<rect x="${n(x + w * 0.1)}" y="${n(y + h * 0.16)}" width="${n(w * 0.42)}" height="${n(u * 1.2 * k)}" rx="${n(u * 0.6 * k)}" fill="#ffffff" fill-opacity="0.5"/>` +
        `<rect x="${n(x + w * 0.1)}" y="${n(y + h * 0.16 + u * 2.4 * k)}" width="${n(w * 0.28)}" height="${n(u * 0.9 * k)}" rx="${n(u * 0.45 * k)}" fill="#ffffff" fill-opacity="0.32"/></g>`,
    );
  }
  return [{ svg: cards.join('') }];
};

// How far a Polaroid reaches into the page from its corner, in units (a hundredth of the short side): about 7% of
// the short side down, under an article's header band (72 px from the top on an A4 page of 794 px), and 9% across.
const POLAROID_REACH_X = 9;
const POLAROID_REACH_Y = 7;

// Polaroids: small instant photos tucked into the page's four corners, each hanging well off its edges so only a
// margin's worth shows (owner's verifier, 2026-11-25: a full photo covered the layouts' titles and author lines): a
// frame (white, a little see-through on a dark page) with a soft picture in the palette (a sky, a sun and a hill), a
// strip of tape and a tilt of its own. Each frame is a plate, so the guard sees it under any text that still meets it.
const polaroids: Drawer = (c) => {
  const u = unit(c);
  const colours = trio(c);
  const frame = c.p.dark ? '#e2e8f0' : '#ffffff';
  const frameOpacity = c.p.dark ? 0.82 : 0.95;
  const w = u * 17;
  const h = u * 20;
  const plates: DesignPlate[] = [];
  // Each corner, and which way is into the page across and down.
  const corners: [number, number, number, number][] = [
    [0, 0, 1, 1],
    [1, 0, -1, 1],
    [1, 1, -1, -1],
    [0, 1, 1, -1],
  ];
  const photos = corners.map(([fx, fy, sx, sy], i) => {
    // The turned frame's box (its tape and shadow too), so it can be placed by how far it reaches in.
    const turn = between(c.rnd, -14, 14);
    const r = (Math.abs(turn) * Math.PI) / 180;
    const hx = (w * Math.cos(r) + h * Math.sin(r)) / 2 + u * 1.5;
    const hy = (w * Math.sin(r) + h * Math.cos(r)) / 2 + u * 1.5;
    // A corner of a photo, reaching POLAROID_REACH_X across and POLAROID_REACH_Y down into the page: clear of a
    // slide's margins and of an article's header and footer bands (verifier, 2026-11-25).
    const cx = fx * c.w + sx * (u * POLAROID_REACH_X - hx);
    const cy = fy * c.h + sy * (u * POLAROID_REACH_Y - hy);
    const x = cx - w / 2;
    const y = cy - h / 2;
    const pad = u * 1.1;
    const pw = w - pad * 2;
    const ph = pw;
    const sky = `${c.uid}-po${i}`;
    const a = colours[i % 3]!;
    const b = colours[(i + 1) % 3]!;
    const land = colours[(i + 2) % 3]!;
    const hill = `M${n(x + pad)} ${n(y + pad + ph * 0.72)}Q${n(x + pad + pw * 0.35)} ${n(y + pad + ph * between(c.rnd, 0.45, 0.6))} ${n(x + pad + pw * 0.65)} ${n(y + pad + ph * 0.68)}T${n(x + pad + pw)} ${n(y + pad + ph * 0.62)}V${n(y + pad + ph)}H${n(x + pad)}Z`;
    plates.push({
      x: cx - hx,
      y: cy - hy,
      w: hx * 2,
      h: hy * 2,
      colours: [frame, a, b, land],
      opacity: frameOpacity,
    });
    return (
      `<g transform="rotate(${n(turn)} ${n(cx)} ${n(cy)})">` +
      softShadow(x, y, w, h, u * 0.4, u * 0.4, u * 1.2, c.p.dark ? 0.3 : 0.1) +
      `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(u * 0.4)}" fill="${frame}" fill-opacity="${frameOpacity}"/>` +
      `<defs>${linearDef(
        sky,
        [
          [0, a, 0.75],
          [1, b, 0.45],
        ],
        170,
      )}</defs>` +
      `<rect x="${n(x + pad)}" y="${n(y + pad)}" width="${n(pw)}" height="${n(ph)}" fill="url(#${sky})"/>` +
      `<circle cx="${n(x + pad + pw * between(c.rnd, 0.6, 0.8))}" cy="${n(y + pad + ph * 0.32)}" r="${n(pw * 0.1)}" fill="#ffffff" fill-opacity="0.75"/>` +
      `<path d="${hill}" fill="${land}" fill-opacity="0.8"/>` +
      `<rect x="${n(cx - u * 3)}" y="${n(y - u * 1)}" width="${n(u * 6)}" height="${n(u * 2)}" fill="${frame}" fill-opacity="0.55" stroke="${c.p.ink}" stroke-opacity="0.08" transform="rotate(${n(between(c.rnd, -8, 8))} ${n(cx)} ${n(y)})"/></g>`
    );
  });
  return [{ svg: photos.join(''), plates }];
};

export const LIGHT_DRAWERS = {
  'glass-panels': glassPanels,
  spotlight,
  bokeh,
  'soft-shadows': softShadows,
  'layered-cards': layeredCards,
  'card-cascade': cardCascade,
  polaroids,
} as const;
