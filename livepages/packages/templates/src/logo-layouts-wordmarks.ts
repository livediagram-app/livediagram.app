// Logo wordmarks (docs/specs/007-editor/logo-pages.md "Logo layouts"): the name is the mark.
import type { Element } from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import { INITIALS, NAME, SECOND, TAGLINE, stacked, word } from './logo-layout-kit';
export function wordmark(k: Kit): Element[] {
  const S = k.box.width;
  return stacked(k, [
    {
      h: S * 0.22,
      gap: S * 0.03,
      make: (y) => [
        word(k, 0, y, S, S * 0.22, NAME, 0.16, { fontWeight: 700, letterSpacing: -0.03 }),
      ],
    },
    {
      h: S * 0.063,
      make: (y) => [
        word(k, 0, y, S, S * 0.063, TAGLINE, 0.035, {
          textCase: 'upper',
          letterSpacing: 0.35,
          fontWeight: 500,
        }),
      ],
    },
  ]);
}

export function monogram(k: Kit): Element[] {
  const S = k.box.width;
  const side = S * 0.62;
  const x = (S - side) / 2;
  return [
    k.shape('square', x, x, side, side, {
      label: '',
      borderRadius: 'lg',
      fillColor: 'transparent',
      strokeWidth: 'extra-thick',
    }),
    word(k, x, x, side, side, INITIALS, 0.26, { fontWeight: 700, letterSpacing: -0.04 }),
  ];
}

export function underlined(k: Kit): Element[] {
  const S = k.box.width;
  const x = S * 0.22;
  const nameH = S * 0.2;
  const barH = S * 0.03;
  const y = (S - nameH - S * 0.02 - barH) / 2;
  return [
    word(k, x, y, S - x, nameH, NAME, 0.15, {
      textAlignX: 'left',
      fontWeight: 700,
      letterSpacing: -0.02,
    }),
    k.shape('square', x, y + nameH + S * 0.02, S * 0.24, barH, {
      label: '',
      borderRadius: 'full',
    }),
  ];
}

// Two words stacked: the name bold, the second word tracked wide under it.
export function twoLines(k: Kit): Element[] {
  const S = k.box.width;
  return stacked(k, [
    {
      h: S * 0.2,
      make: (y) => [
        word(k, 0, y, S, S * 0.2, NAME, 0.15, {
          textCase: 'upper',
          fontWeight: 700,
          letterSpacing: -0.01,
        }),
      ],
    },
    {
      h: S * 0.1,
      make: (y) => [
        word(k, 0, y, S, S * 0.1, SECOND, 0.06, {
          textCase: 'upper',
          fontWeight: 400,
          letterSpacing: 0.55,
        }),
      ],
    },
  ]);
}

// The name in widely spaced capitals between two thin rules.
export function spaced(k: Kit): Element[] {
  const S = k.box.width;
  const h = S * 0.14;
  const y = (S - h) / 2;
  const ruleW = S * 0.62;
  const line = (top: number) =>
    k.shape('square', (S - ruleW) / 2, top, ruleW, S * 0.006, { label: '', borderRadius: 'full' });
  return [
    line(y - S * 0.05),
    word(k, 0, y, S, h, NAME, 0.075, { textCase: 'upper', letterSpacing: 0.6, fontWeight: 500 }),
    line(y + h + S * 0.044),
  ];
}

// The first letter set in a ring, the rest of the name beside it.
export function initialAccent(k: Kit): Element[] {
  const S = k.box.width;
  const d = S * 0.28;
  const nameW = S * 0.46;
  const gap = S * 0.04;
  const x0 = (S - (d + gap + nameW)) / 2;
  const y0 = (S - d) / 2;
  return [
    k.shape('circle', x0, y0, d, d, {
      label: '',
      fillColor: 'transparent',
      strokeWidth: 'extra-thick',
    }),
    word(k, x0, y0, d, d, NAME.slice(0, 1), 0.17, { fontWeight: 700 }),
    word(k, x0 + d + gap, y0, nameW, d, NAME.slice(1), 0.12, {
      textAlignX: 'left',
      textCase: 'lower',
      fontWeight: 700,
      letterSpacing: -0.02,
    }),
  ];
}
