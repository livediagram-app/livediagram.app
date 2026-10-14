// `aspect-extreme` (info): with at least LINT_ASPECT_MIN_BOXES boxes, the drawing is more than
// LINT_MAX_ASPECT times wider than tall or the reverse (LN16). It names no element and reads first.

import { LINT_ASPECT_MIN_BOXES, LINT_MAX_ASPECT } from '../constants';
import { framedTab } from '../context';
import { fixes } from '../fixes';
import { lintExtent } from '../measures';
import type { Check } from './types';

export const aspectExtreme: Check = (ctx) => {
  const extent = lintExtent(ctx);
  // A tab whose boxes sit in frames or lanes takes its shape from its groups, and no layout keeps them (LN16).
  if (!extent || ctx.boxes.length < LINT_ASPECT_MIN_BOXES || framedTab(ctx)) return [];
  const { width, height } = extent;
  if (width < 1 || height < 1) return [];
  const ratio = Math.max(width / height, height / width);
  if (ratio <= LINT_MAX_ASPECT) return [];
  const wide = width > height;
  return [
    {
      code: 'aspect-extreme' as const,
      refs: [],
      message: `drawing: ${width}×${height}, ${ratio.toFixed(1)} times ${wide ? 'wider than tall' : 'taller than wide'}`,
      fix: fixes.aspectExtreme(ctx.source, wide ? 'down' : 'right'),
      at: null,
    },
  ];
};
