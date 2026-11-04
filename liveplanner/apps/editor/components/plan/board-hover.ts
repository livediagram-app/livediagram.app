// The pointer's own feedback on a Plan board (docs/specs/026-plan/plan-board.md "Column hover", "Card hover"): the
// column under it tinted (useColumnHover) and the light that follows it across a card (useCardSpotlight), both written
// straight to the DOM. Whatever re-takes a face on a change (the Marker pass, docs/specs/008-canvas/finish.md
// "Marker") skips these: a hover changes nothing it draws, and re-taking a 200-card board on every pointer move cost
// a full redraw a second.
import { SPOTLIGHT_X, SPOTLIGHT_Y } from './useCardSpotlight';
import { COLUMN_HOVER_ATTR } from './useColumnHover';

const SPOTLIGHT = new RegExp(`(?:^|;)\\s*(?:${SPOTLIGHT_X}|${SPOTLIGHT_Y})\\s*:[^;]*`, 'g');

// An inline style without the light's two properties.
const withoutSpotlight = (style: string | null) =>
  (style ?? '').replace(SPOTLIGHT, '').replace(/^;\s*/, '').trim();

/** Whether a mutation is only the pointer's feedback: a column's hover mark, or a style change that moves nothing but
 *  a card's light (read against the record's `oldValue`, so the observer needs `attributeOldValue`). */
export function isBoardHoverWrite(r: MutationRecord): boolean {
  if (r.type !== 'attributes') return false;
  if (r.attributeName === COLUMN_HOVER_ATTR) return true;
  // A style attribute the light itself added has no old value.
  if (r.attributeName !== 'style' || !(r.target instanceof Element)) return false;
  return withoutSpotlight(r.oldValue) === withoutSpotlight(r.target.getAttribute('style'));
}
