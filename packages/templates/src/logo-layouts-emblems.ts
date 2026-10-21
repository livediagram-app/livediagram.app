// Logo emblems (docs/specs/007-editor/logo-pages.md "Logo layouts"): the name inside or round a shape.
import type { Element } from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import { iconDisc } from './page-layout-parts';
import { ICON, INITIALS, NAME, TAGLINE, arched, icon, stacked, word } from './logo-layout-kit';
export function badge(k: Kit): Element[] {
  const S = k.box.width;
  const inner = S * 0.6;
  const ic = S * 0.26;
  return [
    k.shape('circle', 0, 0, S, S, { label: '', fillColor: 'transparent', strokeWidth: 'thick' }),
    k.shape('circle', (S - inner) / 2, (S - inner) / 2, inner, inner, {
      label: '',
      fillColor: 'transparent',
      strokeWidth: 'thin',
    }),
    icon(k, S / 2, (S - ic) / 2, ic),
    arched(k, NAME, 0.37, 0.065, 180, { fontWeight: 700, letterSpacing: 0.3 }),
    arched(k, TAGLINE, 0.42, 0.038, -180, { fontWeight: 500, letterSpacing: 0.25 }),
  ];
}

export function seal(k: Kit): Element[] {
  const S = k.box.width;
  const d = S * 0.62;
  // The name arched round the disc's top and the tagline round its bottom, both just outside it.
  return [
    ...iconDisc(k, (S - d) / 2, (S - d) / 2, d, ICON).els,
    arched(k, NAME, 0.34, 0.07, 180, { fontWeight: 700, letterSpacing: 0.3 }),
    arched(k, TAGLINE, 0.37, 0.036, -180, { fontWeight: 500, letterSpacing: 0.25 }),
  ];
}

export function hexagon(k: Kit): Element[] {
  const S = k.box.width;
  const w = S * 0.5;
  const h = S * 0.44;
  const ic = S * 0.2;
  return stacked(k, [
    {
      h,
      gap: S * 0.05,
      make: (y) => [
        k.shape('hexagon', (S - w) / 2, y, w, h, { label: '' }),
        k.shape('icon', (S - ic) / 2, y + (h - ic) / 2, ic, ic, { iconId: ICON }),
      ],
    },
    {
      h: S * 0.12,
      make: (y) => [
        word(k, 0, y, S, S * 0.12, NAME, 0.085, {
          textCase: 'upper',
          letterSpacing: 0.12,
          fontWeight: 700,
        }),
      ],
    },
  ]);
}

// A double ring, the name arched over the top and the tagline under, the initials in the middle.
export function stamp(k: Kit): Element[] {
  const S = k.box.width;
  const inner = S * 0.66;
  const ring = (d: number, w: 'thick' | 'thin') =>
    k.shape('circle', (S - d) / 2, (S - d) / 2, d, d, {
      label: '',
      fillColor: 'transparent',
      strokeWidth: w,
    });
  return [
    ring(S, 'thick'),
    ring(inner, 'thin'),
    word(k, (S - inner) / 2, (S - inner) / 2, inner, inner, INITIALS, 0.15, { fontWeight: 700 }),
    arched(k, NAME, 0.38, 0.06, 200, { fontWeight: 700, letterSpacing: 0.35 }),
    arched(k, TAGLINE, 0.43, 0.034, -170, { fontWeight: 500, letterSpacing: 0.25 }),
  ];
}

// An outlined rounded square holding the icon over the name.
export function squareBadge(k: Kit): Element[] {
  const S = k.box.width;
  const side = S * 0.72;
  const x = (S - side) / 2;
  const ic = side * 0.34;
  return [
    k.shape('square', x, x, side, side, {
      label: '',
      borderRadius: 'lg',
      fillColor: 'transparent',
      strokeWidth: 'extra-thick',
    }),
    icon(k, S / 2, x + side * 0.18, ic),
    word(k, x, x + side * 0.6, side, side * 0.2, NAME, 0.08, {
      textCase: 'upper',
      letterSpacing: 0.15,
      fontWeight: 700,
    }),
  ];
}

// An outlined diamond holding the initials, the name under it.
export function diamond(k: Kit): Element[] {
  const S = k.box.width;
  const d = S * 0.5;
  return stacked(k, [
    {
      h: d,
      gap: S * 0.05,
      make: (y) => [
        k.shape('diamond', (S - d) / 2, y, d, d, {
          label: '',
          fillColor: 'transparent',
          strokeWidth: 'thick',
        }),
        word(k, (S - d) / 2, y, d, d, INITIALS, 0.1, { fontWeight: 700 }),
      ],
    },
    {
      h: S * 0.12,
      make: (y) => [
        word(k, 0, y, S, S * 0.12, NAME, 0.075, {
          textCase: 'upper',
          letterSpacing: 0.2,
          fontWeight: 700,
        }),
      ],
    },
  ]);
}
