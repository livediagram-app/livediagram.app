// A sent element's chip on the canvas (liveworkspace/docs/specs/004-index/send-to-plan.md "The chip"): one of the
// element's own indicators (each app's docs/specs/008-canvas/element-indicators.md), so it sits where the element's
// link, note and comment glyphs do, in the person's style, quiet at rest, never in an export or a thumbnail. The plan
// glyph, a tick once the card is done; clicking opens the card in liveplanner.
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideCircleCheck, lucideSquareKanban } from '@liveworkspace/icons/lucide';
import type { SentCardIndicator } from '../canvas/indicator-items';
import { useSends } from './send-store';
import { chipWords, openSentCard } from './SentChip';

/** The glyphs each app's ElementIndicators draws for the two card kinds. */
export const SENT_CARD_GLYPHS = {
  card: lucideGlyph(lucideSquareKanban, 12),
  'card-done': lucideGlyph(lucideCircleCheck, 12),
} as const;

/** The element's sent-card indicator, or undefined when nothing was sent from it; live. */
export function useSentCardIndicator(elementId: string): SentCardIndicator | undefined {
  const sends = useSends(elementId, 'element');
  const newest = sends[0];
  if (!newest) return undefined;
  const more = sends.length - 1;
  return {
    onOpen: () => openSentCard(newest),
    done: newest.card.done,
    title: newest.card.title || 'Card',
    where: `${chipWords(newest)}${more > 0 ? `, and ${more} more` : ''}`,
  };
}
