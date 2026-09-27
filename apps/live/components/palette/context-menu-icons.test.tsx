import { centreOffsetPx } from '@livediagram/icons/centring';
import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import * as icons from './context-menu-icons';
import { MENU_ICON_PX, QUICK_ACTION_ICON_PX } from './context-menu-icons';

// One menu, one size step (docs/specs/004-interface-design/iconography.md, "Relation to optical
// alignment"): every menu glyph renders at MENU_ICON_PX, the quick-action verbs at
// QUICK_ACTION_ICON_PX, and each sits centred. Option previews carry their own sizes.
const PREVIEWS = new Set([
  'DirArrow',
  'RotationGlyph',
  'AnimationKindGlyph',
  'FlowKindGlyph',
  'IconAnimKindGlyph',
  'ProgressAnimKindGlyph',
]);
// Asymmetric by design (named exceptions to the centring rule).
const ASYMMETRIC = new Map([
  ['RotationMenuIcon', 'Lucide rotate-cw-square: the turn arrow overhangs the top-left'],
]);
const QUICK = new Set(['CutIcon', 'CopyIcon', 'DuplicateMenuIcon', 'RemoveIcon', 'PasteMenuIcon']);

const glyphs = Object.entries(icons as Record<string, unknown>).filter(
  (e): e is [string, ComponentType] =>
    typeof e[1] === 'function' && /(Icon|Glyph)$/.test(e[0]) && !PREVIEWS.has(e[0]),
);

function measure(C: ComponentType) {
  const svg = renderToStaticMarkup(<C />);
  const units = Number(/viewBox="0 0 ([\d.]+)/.exec(svg)![1]);
  const size = Number(/width="([\d.]+)"/.exec(svg)![1]);
  const px = Number(/stroke-width="([\d.]+)"/.exec(svg)?.[1] ?? 0);
  return {
    size,
    off: centreOffsetPx(svg, { units, sizePx: size, strokeUnits: (px * units) / size }),
  };
}

describe('context menu icons', () => {
  it.each(glyphs)('%s renders at its size step', (name, C) => {
    expect(measure(C).size).toBe(QUICK.has(name) ? QUICK_ACTION_ICON_PX : MENU_ICON_PX);
  });

  it.each(glyphs.filter(([n]) => !ASYMMETRIC.has(n)))('%s is centred', (_name, C) => {
    const { off } = measure(C);
    expect(off).not.toBeNull();
    expect(Math.abs(off!.dx)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(off!.dy)).toBeLessThanOrEqual(0.5);
  });
});
