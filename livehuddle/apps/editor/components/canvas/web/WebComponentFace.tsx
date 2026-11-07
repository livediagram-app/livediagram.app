import type { WebComponentShape } from '@livehuddle/document';
import { CardFace } from '@/components/canvas/web/CardFace';
import type { WebFaceProps } from '@/components/canvas/web/web-face-props';

// The web components' faces (docs/specs/009-elements/web-components-and-no-groups.md) livehuddle still carries: the
// card, and a callout not yet migrated, which draws as the badge card it becomes (docs/specs/009-elements/card.md).
// It lays itself out from the element's size via the shared layouts in @livehuddle/document, so a resize re-flows the
// content rather than zooming it.
export function WebComponentFace({
  kind: _kind,
  ...props
}: WebFaceProps & { kind: WebComponentShape }) {
  return <CardFace {...props} />;
}
