import {
  accentEdgeColour,
  accentEdgeThickness,
  resolvedAccentEdge,
  type Element,
} from '@liveplanner/document';

// The accent edge (docs/specs/008-canvas/accent-edge.md) on the canvas: a bar inside the wrapper's border, clipped by
// the wrapper's own corner radius (`border-radius: inherit` + `overflow: hidden`), so it follows the corner exactly as
// the export's clip path does. Nothing renders when the element has no edge.
export function AccentEdgeOverlay({ element, stroke }: { element: Element; stroke: string }) {
  if (element.type !== 'shape') return null;
  const edge = resolvedAccentEdge(element);
  if (!edge) return null;
  // Anchored to its edge of the padding box, so it stays there while a resize is previewed; the thickness is the
  // element's own, in element px (accentEdgeRect's numbers, as CSS insets).
  const t = accentEdgeThickness(element.width, element.height);
  const style =
    edge === 'left'
      ? { left: 0, top: 0, bottom: 0, width: t }
      : edge === 'top'
        ? { left: 0, right: 0, top: 0, height: t }
        : { left: 0, right: 0, bottom: 0, height: t };
  return (
    <div
      aria-hidden
      data-accent-edge={edge}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ borderRadius: 'inherit' }}
    >
      <div
        className="absolute"
        style={{ ...style, backgroundColor: accentEdgeColour(element, stroke) }}
      />
    </div>
  );
}
