import { SHAPE_KINDS, type ShapeKind } from '@livehuddle/document';

// Which shapes the element wrapper paints as a CSS box (a fill, a border, a corner) and which paint their own body
// over a transparent wrapper. The diagram shapes that drew a geometric outline in an inner SVG (a diamond, a
// cylinder) and the CSS-drawn square, circle and stadium left livehuddle with the element engine's part 5
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine"); a stored one is a retired element and
// paints its placeholder.
//
// On the box path: the filled rounded boxes with their own content drawn on top, the mode button
// (docs/specs/009-elements/mode-button.md), Bring Focus (docs/specs/012-collaboration/bring-focus.md) and the portal
// (docs/specs/009-elements/portal-element.md); and the chair, desk, sofa (docs/specs/009-elements/chair.md), fence and
// Avatar Pad (docs/specs/009-elements/avatar-pad.md), which draw themselves over the box path's transparent defaults.
const BOX_PATH_KINDS: ReadonlySet<string> = new Set<ShapeKind>([
  'mode-button',
  'focus-button',
  'portal',
  'chair',
  'fence',
  'avatar-pad',
  'desk',
  'sofa',
]);

// Whether the wrapper carries no box border or background for this kind: it paints its own body. An unknown kind
// (a retired one) is on the box path, where its placeholder is drawn.
export function isSvgRenderedShape(kind: ShapeKind): boolean {
  return SHAPE_KINDS.has(kind) && !BOX_PATH_KINDS.has(kind);
}
