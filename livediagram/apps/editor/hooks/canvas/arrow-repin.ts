import type { ArrowElement, Endpoint } from '@livediagram/document';

/**
 * An arrow with one end moved by hand. Its `to` end leaves an import's exact end behind, so it fans
 * with the others at its new anchor (docs/specs/008-canvas/arrow-anchors.md "Exact ends");
 * `exactStart` is the user's switch and stays.
 */
export function repinnedArrow(
  arrow: ArrowElement,
  end: 'from' | 'to',
  endpoint: Endpoint,
): ArrowElement {
  if (end === 'from') return { ...arrow, from: endpoint };
  const { exactEnd: _exact, ...rest } = arrow;
  void _exact;
  return { ...rest, to: endpoint };
}
