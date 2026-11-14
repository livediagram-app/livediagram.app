// Arrow type definitions (anchors, endpoints, arrowheads, the ArrowElement itself): one copy for livediagram and
// liveplanner, @liveworkspace/element-model/arrow-types, the arrow's link this model's own. Re-exported through
// index.ts so the package's public surface is unchanged.
import type { ArrowElementOf } from '@liveworkspace/element-model/arrow-types';
import type { ElementLink } from './index';

export {
  ALL_ANCHORS,
  type Anchor,
  type ArrowEnds,
  type Endpoint,
} from '@liveworkspace/element-model/arrow-types';

export type ArrowElement = ArrowElementOf<ElementLink>;
