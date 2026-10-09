// Logo lockups (docs/specs/007-editor/logo-pages.md "Logo layouts"): an icon and the name together.
import type { Element } from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import { iconDisc } from './page-layout-parts';
import { ICON, NAME, TAGLINE, icon, rule, stacked, tagline, word } from './logo-layout-kit';
export function iconAbove(k: Kit): Element[] {
  const S = k.box.width;
  const d = S * 0.36;
  return stacked(k, [
    { h: d, gap: S * 0.05, make: (y) => iconDisc(k, (S - d) / 2, y, d, ICON).els },
    {
      h: S * 0.15,
      gap: S * 0.02,
      make: (y) => [
        word(k, 0, y, S, S * 0.15, NAME, 0.11, { fontWeight: 700, letterSpacing: -0.02 }),
      ],
    },
    { h: S * 0.063, make: (y) => [tagline(k, y)] },
  ]);
}

export function iconBeside(k: Kit): Element[] {
  const S = k.box.width;
  const d = S * 0.24;
  const gap = S * 0.05;
  const nameW = S * 0.5;
  const x0 = (S - (d + gap + nameW)) / 2;
  const y0 = (S - d) / 2;
  const nameH = S * 0.13;
  const tagH = S * 0.06;
  const textTop = y0 + (d - nameH - tagH) / 2;
  const left = { textAlignX: 'left' as const };
  const ic = d * 0.55;
  return [
    k.shape('square', x0, y0, d, d, { label: '', borderRadius: 'lg' }),
    k.shape('icon', x0 + (d - ic) / 2, y0 + (d - ic) / 2, ic, ic, { iconId: ICON }),
    word(k, x0 + d + gap, textTop, nameW, nameH, NAME, 0.1, {
      ...left,
      fontWeight: 700,
      letterSpacing: -0.02,
    }),
    word(k, x0 + d + gap, textTop + nameH, nameW, tagH, TAGLINE, 0.03, {
      ...left,
      textCase: 'upper',
      letterSpacing: 0.2,
      fontWeight: 500,
    }),
  ];
}

export function stackedMark(k: Kit): Element[] {
  const S = k.box.width;
  const d = S * 0.28;
  return stacked(k, [
    { h: d, gap: S * 0.05, make: (y) => [icon(k, S / 2, y, d)] },
    {
      h: S * 0.12,
      gap: S * 0.035,
      make: (y) => [
        word(k, 0, y, S, S * 0.12, NAME, 0.085, {
          textCase: 'upper',
          letterSpacing: 0.12,
          fontWeight: 700,
        }),
      ],
    },
    { h: S * 0.012, gap: S * 0.035, make: (y) => [rule(k, y, S * 0.12)] },
    { h: S * 0.063, make: (y) => [tagline(k, y)] },
  ]);
}

// The name and tagline on the left, the icon in a disc on the right.
export function iconRight(k: Kit): Element[] {
  const S = k.box.width;
  const d = S * 0.26;
  const gap = S * 0.05;
  const nameW = S * 0.5;
  const x0 = (S - (nameW + gap + d)) / 2;
  const y0 = (S - d) / 2;
  const nameH = S * 0.13;
  const tagH = S * 0.06;
  const textTop = y0 + (d - nameH - tagH) / 2;
  const right = { textAlignX: 'right' as const };
  return [
    word(k, x0, textTop, nameW, nameH, NAME, 0.1, { ...right, fontWeight: 700 }),
    word(k, x0, textTop + nameH, nameW, tagH, TAGLINE, 0.03, {
      ...right,
      textCase: 'upper',
      letterSpacing: 0.2,
      fontWeight: 500,
    }),
    ...iconDisc(k, x0 + nameW + gap, y0, d, ICON).els,
  ];
}

// The icon, a thin upright rule, then the name over the tagline.
export function divided(k: Kit): Element[] {
  const S = k.box.width;
  const ic = S * 0.2;
  const gap = S * 0.05;
  const nameW = S * 0.46;
  const x0 = (S - (ic + gap * 2 + nameW)) / 2;
  const h = S * 0.22;
  const y0 = (S - h) / 2;
  const left = { textAlignX: 'left' as const };
  return [
    icon(k, x0 + ic / 2, y0 + (h - ic) / 2, ic),
    k.shape('square', x0 + ic + gap, y0, S * 0.008, h, { label: '', borderRadius: 'full' }),
    word(k, x0 + ic + gap * 2, y0 + h * 0.08, nameW, h * 0.55, NAME, 0.1, {
      ...left,
      textCase: 'upper',
      letterSpacing: 0.08,
      fontWeight: 700,
    }),
    word(k, x0 + ic + gap * 2, y0 + h * 0.62, nameW, h * 0.3, TAGLINE, 0.028, {
      ...left,
      textCase: 'upper',
      letterSpacing: 0.2,
      fontWeight: 500,
    }),
  ];
}

// The icon and the name together inside an outlined pill.
export function pill(k: Kit): Element[] {
  const S = k.box.width;
  const w = S * 0.86;
  const h = S * 0.26;
  const x0 = (S - w) / 2;
  const y0 = (S - h) / 2;
  const ic = h * 0.5;
  return [
    k.shape('stadium', x0, y0, w, h, { label: '', fillColor: 'transparent', strokeWidth: 'thick' }),
    icon(k, x0 + h * 0.6, y0 + (h - ic) / 2, ic),
    word(k, x0 + h * 0.95, y0, w - h * 1.25, h, NAME, 0.1, {
      textAlignX: 'left',
      fontWeight: 700,
      letterSpacing: -0.01,
    }),
  ];
}

// The name, then the tagline, then the icon in a disc under them.
export function iconBelow(k: Kit): Element[] {
  const S = k.box.width;
  const d = S * 0.26;
  return stacked(k, [
    {
      h: S * 0.15,
      gap: S * 0.015,
      make: (y) => [word(k, 0, y, S, S * 0.15, NAME, 0.11, { fontWeight: 700 })],
    },
    { h: S * 0.063, gap: S * 0.06, make: (y) => [tagline(k, y)] },
    { h: d, make: (y) => iconDisc(k, (S - d) / 2, y, d, ICON).els },
  ]);
}
