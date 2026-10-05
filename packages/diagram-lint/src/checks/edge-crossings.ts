// `edge-crossings` (warning): more crossing pairs than LINT_CROSSINGS_PER_ARROW × arrows, one finding for
// the tab naming the most-crossed arrows (LN9). Skipped with the pair count above LINT_MAX_ARROWS (N2).

import { arrowName } from '../arrow-names';
import { LINT_CROSSINGS_PER_ARROW, LINT_REFS_PER_FINDING_MAX } from '../constants';
import { refOf } from '../context';
import { fixes } from '../fixes';
import type { Check } from './types';

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
  const more = crossed.length - named.length;
  return [
    {
      code: 'edge-crossings' as const,
      refs: crossed.map((d) => refOf(ctx, d.arrow.id)),
      message: `${named.join(', ')}${more > 0 ? ` +${more}` : ''}: ${crossings.pairs} crossings among ${ctx.drawable.length} arrows, limit ${Math.floor(limit)}`,
      fix: fixes.edgeCrossings(ctx.source),
      at: crossed[0]!.polyline[0]!,
    },
  ];
};
