// Refs, slug ids and kind words (docs/specs/024-agents, "Refs"): one copy for every product,
// @liveworkspace/element-model/element-refs, its kind words bound to the types and shape kinds this model knows.
import { elementKindsFor } from '@liveworkspace/element-model/element-refs';
import { ELEMENT_TYPES } from './validate';
import { isRetiredElementType } from './retired-kinds';
import { SHAPE_KINDS } from './shape-kinds';
import type { Element } from './index';

export {
  REF_MIN_LENGTH,
  SLUG_ID_MAX_LENGTH,
  computeRefs,
  isSlugId,
  resolveRef,
  slugIdFor,
  type RefTable,
} from '@liveworkspace/element-model/element-refs';

export const { isKnownElement, kindWordOf } = elementKindsFor<Element>({
  elementTypes: ELEMENT_TYPES,
  shapeKinds: SHAPE_KINDS,
  // A boxed type the element engine deleted, or a stored arrow (./retired-arrow), which has no box
  // (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine"): it prints as an unknown kind.
  isRetiredType: (type) => type === 'arrow' || isRetiredElementType(type),
});
