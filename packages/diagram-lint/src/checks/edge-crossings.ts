// `edge-crossings` (warning): more crossing pairs than LINT_CROSSINGS_PER_ARROW × arrows, one finding for
// the tab naming the most-crossed arrows (LN9). Skipped with the pair count above LINT_MAX_ARROWS (N2).

import {
  arrowRoutePoints,
  arrowStyleOf,
  pathsCross,
  type ArrowElement,
} from '@livediagram/document';
import { arrowName, arrowSelector } from '../arrow-names';
import { LINT_CROSSINGS_PER_ARROW, LINT_REFS_PER_FINDING_MAX } from '../constants';
import { framedTab, refOf } from '../context';
import { fixes } from '../fixes';
import type { Check } from './types';

const RESTYLES = ['angled', 'curved', 'straight'] as const;

export const edgeCrossings: Check = (ctx) => {
  const { crossings } = ctx;
  if (!crossings) return [];
  const limit = LINT_CROSSINGS_PER_ARROW * ctx.drawable.length;
  if (crossings.pairs <= limit) return [];
  const crossed = ctx.drawable
    .filter((d) => crossings.perArrow.has(d.arrow.id))
    .map((d, index) => ({ d, index, count: crossings.perArrow.get(d.arrow.id)! }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map(({ d }) => d);
  const named = crossed.slice(0, LINT_REFS_PER_FINDING_MAX).map((d) => arrowName(ctx, d.arrow));
  // Of the most-crossed arrows, the first a line style takes across fewer lines, re-routed without its old bends.
  const restyle = () => {
    for (const d of crossed.slice(0, LINT_REFS_PER_FINDING_MAX)) {
      const now = crossings.perArrow.get(d.arrow.id)!;
      for (const style of RESTYLES) {
        if (style === arrowStyleOf(d.arrow)) continue;
        const { curvePoints: _bends, curveOffset: _bow, ...plain } = d.arrow;
        const trial: ArrowElement = { ...plain, arrowStyle: style };
        const route = arrowRoutePoints(trial, ctx.visible as never);
        const count = ctx.drawable.filter(
          (o) => o.arrow.id !== d.arrow.id && pathsCross(route, o.polyline),
        ).length;
        if (count < now) return { arrow: arrowSelector(ctx, d.arrow), style };
      }
    }
    return { arrow: arrowSelector(ctx, crossed[0]!.arrow), style: null };
  };
  const more = crossed.length - named.length;
  return [
    {
      code: 'edge-crossings' as const,
      refs: crossed.map((d) => refOf(ctx, d.arrow.id)),
      message: `${named.join(', ')}${more > 0 ? ` +${more}` : ''}: ${crossings.pairs} crossings among ${ctx.drawable.length} arrows, limit ${Math.floor(limit)}`,
      fix: fixes.edgeCrossings(ctx.source, framedTab(ctx) ? restyle() : null),
      at: crossed[0]!.polyline[0]!,
    },
  ];
};
