// What the drawn kinds share. The diagram shapes' silhouette table (the diamond, the cylinder, the actor and the
// rest) left with them (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 5); the Space
// pieces paint their own faces (svg-render-faces here, FurnitureView in apps/editor).
import { colorWash } from '@liveworkspace/model-core/color-wash';

/** A chair's seat colour: its own fill, or with none (the default is
 *  `transparent`) a wash of its stroke, so it follows the tab theme rather
 *  than staying a fixed light grey on a dark canvas. */
export function chairSeatFill(fillColor: string | undefined, stroke: string): string {
  return fillColor && fillColor !== 'transparent' ? fillColor : colorWash(stroke, 0.32);
}
