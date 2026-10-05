// The Plan board's colours (docs/specs/025-plan/plan-board.md "Theme and style") come from
// @livediagram/document, shared with the SVG export; this module adds the editor's own bits.
import type { ShapeElement } from '@livediagram/document';

export { planPalette, type PlanPalette } from '@livediagram/document';

// A board's or card's own colours, as planPalette reads them.
export const planOwnColours = (el: ShapeElement) => ({
  fill: el.fillColor,
  stroke: el.strokeColor,
  text: el.textColor,
});

export const PRIORITY_COLOURS = {
  urgent: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#64748b',
} as const;

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
