// A board's preview growth (docs/specs/015-api/mcp-server.md §5): a board scrolls on its tab, so its image grows to every
// card it holds; off a Board tab, only where the grown board would cover nothing else. Render-free, so it is tested
// without the rasteriser image-result.ts loads.
import { isBoxed, type Element } from '@livedesign/document';

// Whether a board grown down from `bottom` (its own height) to `grown`'s would reach an element that starts below it in
// its columns, so growing it would draw the board over that element.
export function coversAnother(
  grown: { id: string; x: number; width: number; y: number; height: number },
  bottom: number,
  elements: readonly Element[],
): boolean {
  return elements.some(
    (o) =>
      o.id !== grown.id &&
      isBoxed(o) &&
      o.y >= bottom &&
      o.y < grown.y + grown.height &&
      o.x < grown.x + grown.width &&
      o.x + o.width > grown.x,
  );
}
