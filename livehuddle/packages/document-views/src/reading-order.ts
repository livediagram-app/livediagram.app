// Reading order (docs/specs/024-agents/blueprints/document-views.md "Reading order", VW25), shared in
// `@liveworkspace/document-views`; `Placed` is bound to this product's elements.
import type { Element } from '@livehuddle/document';
import type { Placed as PlacedOf } from '@liveworkspace/document-views/reading-order';

export { readingOrder, rowsOf } from '@liveworkspace/document-views/reading-order';
export type Placed = PlacedOf<Element>;
