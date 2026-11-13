// The authoring normaliser for the shared element model's own tests, bound to the product-neutral shape builder
// (./elements): any kind a string names, and no stored-element migrations. Tests only.
import type { Element } from '../element';
import { elementNormaliserFor } from '../element-normalise';
import { createShape } from './elements';

export const { normaliseElement, normaliseElements, mergeElementUpdate, lanesToFront } =
  elementNormaliserFor({
    createShape,
    coerceShapeKind: (kind: unknown) => (typeof kind === 'string' ? kind : 'square'),
    migrateStoredElementsUnsettled: (elements: Element[]) => elements,
  });
