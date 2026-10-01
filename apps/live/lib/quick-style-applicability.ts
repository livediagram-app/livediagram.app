// Which selected elements the quick style panel styles (docs/specs/008-canvas/quick-style-panel.md
// "Multi-selection"): any mix of kinds works. The theme rows style unlocked shapes, arrows, paths
// and text; a whiteboard's marker rows style its marker strokes; every other element is passed over,
// neither styled nor counted, and never hides the panel from the rest.
import type { Element, FreehandElement } from '@livediagram/document';
import { isQuickStyleTarget, type QuickStyleTarget } from './quick-style';
import { isPenStroke } from './quick-style-pen';

export type QuickStyleApplicability = {
  targets: QuickStyleTarget[];
  strokes: FreehandElement[];
};

export function quickStyleApplicability(selected: readonly Element[]): QuickStyleApplicability {
  return { targets: selected.filter(isQuickStyleTarget), strokes: selected.filter(isPenStroke) };
}

/**
 * The whiteboard caption over the rows: the strokes when only strokes are styled, the count of
 * styled elements when strokes mix with others, and none without strokes (the rows name themselves).
 */
export function quickStyleCaption({
  targets,
  strokes,
}: QuickStyleApplicability): string | undefined {
  if (strokes.length === 0) return undefined;
  if (targets.length === 0) {
    return strokes.length === 1 ? 'Marker stroke' : `${strokes.length} marker strokes`;
  }
  return `${targets.length + strokes.length} elements`;
}
