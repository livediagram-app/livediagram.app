// Logo marks (docs/specs/007-editor/logo-pages.md "Logo layouts"): a symbol alone, no name, to
// build a mark from (several are shapes to Combine into one).
import type { Element } from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import { iconDisc } from './page-layout-parts';
import { ICON, NAME, icon, word } from './logo-layout-kit';

// The icon in a large disc, filling the safe area's middle.
export function markDisc(k: Kit): Element[] {
  const S = k.box.width;
  const d = S * 0.78;
  return iconDisc(k, (S - d) / 2, (S - d) / 2, d, ICON).els;
}

// An app icon: a filled rounded square with the icon in it.
export function markApp(k: Kit): Element[] {
  const S = k.box.width;
  const side = S * 0.82;
  const x = (S - side) / 2;
  const ic = side * 0.5;
  return [
    k.shape('square', x, x, side, side, { label: '', borderRadius: 'lg' }),
    icon(k, S / 2, x + (side - ic) / 2, ic),
  ];
}

// Two overlapping rings, ready to Unite or Exclude into one mark.
export function markRings(k: Kit): Element[] {
  const S = k.box.width;
  const d = S * 0.56;
  const y = (S - d) / 2;
  const ring = (x: number) =>
    k.shape('circle', x, y, d, d, {
      label: '',
      fillColor: 'transparent',
      strokeWidth: 'extra-thick',
    });
  return [ring(S * 0.1), ring(S - S * 0.1 - d)];
}

// The name's first letter, large, in a ring.
export function markInitial(k: Kit): Element[] {
  const S = k.box.width;
  const d = S * 0.8;
  const x = (S - d) / 2;
  return [
    k.shape('circle', x, x, d, d, {
      label: '',
      fillColor: 'transparent',
      strokeWidth: 'extra-thick',
    }),
    word(k, x, x, d, d, NAME.slice(0, 1), 0.42, { fontWeight: 700 }),
  ];
}

// Two overlapping peaks, a large and a small triangle, ready to Unite.
export function markPeaks(k: Kit): Element[] {
  const S = k.box.width;
  const big = S * 0.62;
  const small = S * 0.44;
  const base = S * 0.78;
  return [
    k.shape('triangle', S * 0.1, base - big, big, big, { label: '' }),
    k.shape('triangle', S * 0.9 - small, base - small, small, small, { label: '' }),
  ];
}

// A star with a disc at its heart, ready to Subtract into a ring of points.
export function markStar(k: Kit): Element[] {
  const S = k.box.width;
  const d = S * 0.8;
  const x = (S - d) / 2;
  const core = S * 0.22;
  return [
    k.shape('star', x, x, d, d, { label: '' }),
    k.shape('circle', (S - core) / 2, (S - core) / 2, core, core, { label: '' }),
  ];
}
